
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { sectionsData, painFieldsData, initialPainState, scenariosData, defaultLayoutSettings, complexityOptions } from './constants';
import type { FormState, PainState, Option, SavedState, LayoutSettings, Patient, SectionData, GeneratedNoteRecord } from './types';
import CollapsibleSection from './components/CollapsibleSection';
import RadioGroup from './components/RadioGroup';
import CheckboxGroup from './components/CheckboxGroup';
import PainSection from './components/PainSection';
import GeneratedNote from './components/GeneratedNote';
import Header from './components/Header';
import Footer from './components/Footer';
import ParticularitesSection from './components/ParticularitesSection';
import AccessCodeScreen from './components/AccessCodeScreen';
import ChangePasswordModal from './components/ChangePasswordModal';
import QuickScenarios from './components/QuickScenarios';
import AdmissionSection from './components/AdmissionSection';
import ClinicalAssistant from './components/ClinicalAssistant';
import SaveLoad from './components/SaveLoad';
import PatientManager from './components/PatientManager';
import PatientModal from './components/PatientModal';
import ShiftReportGenerator from './components/ShiftReportGenerator'; // New import

const App: React.FC = () => {
  const [accessCode, setAccessCode] = useState<string>(() => localStorage.getItem('APP_ACCESS_CODE') || '19960213');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('theme')) {
        return localStorage.getItem('theme') as 'light' | 'dark';
    }
    return 'light'; // Default theme
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const initialFormState: FormState = useMemo(() => ({
    quart: '',
    gender: '',
    heure: '',
    // Admission
    admissionCheckboxes: [],
    orientation: [],
    autonomie: '',
    effetsPersonnels: '',
    accesVeineux: false,
    accesVeineux_gauge: '',
    accesVeineux_site: '',
    piccLine: false,
    piccLine_site: '',
    drains: [],
    sondes: [],
    // Sections
    position: [],
    etatEveil: '',
    signesVitaux: '',
    signesNeuro: '',
    respiratoire: [],
    respiratoire_medicament: '',
    respiratoire_interventions: [],
    respiratoire_o2_litres: '',
    digestif: [],
    digestif_medicament: '',
    digestif_interventions: [],
    urinaire: [],
    urinaire_medicament: '',
    urinaire_interventions: [],
    tegumentaire: [],
    tegumentaire_medicament: '',
    tegumentaire_interventions: [],
    geriatrie: [],
    finDeVie: [], // Added for end-of-life symptoms
    finDeVie_other: '', // Added for custom end-of-life symptoms
    observations: [],
    visites: '',
    particularites: '',
    douleur: initialPainState, // Initialize douleur
  }), []);

  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [aiNote, setAiNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [openRightSectionId, setOpenRightSectionId] = useState<string | null>('assistant');
  
  // Patient Management State
  const [patients, setPatients] = useState<Patient[]>(() => {
    try {
        const saved = localStorage.getItem('appPatients');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error("Failed to parse patients from localStorage", e);
        return [];
    }
  });
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('appPatients', JSON.stringify(patients));
  }, [patients]);
  
  useEffect(() => {
    if (selectedPatientId) {
        const selectedPatient = patients.find(p => p.id === selectedPatientId);
        if (selectedPatient) {
            setFormState(prevState => ({...prevState, gender: selectedPatient.gender}));
        }
    } else {
        setFormState(prevState => ({...prevState, gender: ''}));
    }
  }, [selectedPatientId, patients]);

  const handleSavePatient = (patientToSave: Omit<Patient, 'id'> & { id?: string }) => {
    if (patientToSave.id) { // Update existing patient
        setPatients(prev => prev.map(p => p.id === patientToSave.id ? { ...p, ...patientToSave } as Patient : p));
    } else { // Add new patient
        const newPatient: Patient = { ...patientToSave, id: Date.now().toString() };
        setPatients(prev => [...prev, newPatient]);
    }
  };

  const handleDeletePatient = (patientId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) {
        setPatients(prev => prev.filter(p => p.id !== patientId));
        if (selectedPatientId === patientId) {
            setSelectedPatientId(null);
        }
    }
  };
  
  const [settings, setSettings] = useState<LayoutSettings>(() => {
    try {
        const savedSettings = localStorage.getItem('noteLayoutSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // One-time migration for old fontSize format (multiplier) to new format (points)
            if (parsed.fontSize && parsed.fontSize < 7) {
                parsed.fontSize = parsed.fontSize * 5;
            }
            return { ...defaultLayoutSettings, ...parsed };
        }
        return defaultLayoutSettings;
    } catch (e) {
        console.error("Failed to parse layout settings from localStorage", e);
        return defaultLayoutSettings;
    }
  });
  
  // Clinical Assistant State
  const [clinicalQuestion, setClinicalQuestion] = useState('');
  const [complexityLevel, setComplexityLevel] = useState('Simple');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [isGeneratingAssistant, setIsGeneratingAssistant] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  // Shift Report State
  const [generatedNotesHistory, setGeneratedNotesHistory] = useState<GeneratedNoteRecord[]>([]);
  const [shiftReportOutput, setShiftReportOutput] = useState('');
  const [isGeneratingShiftReport, setIsGeneratingShiftReport] = useState(false);
  const [shiftReportError, setShiftReportError] = useState<string | null>(null);

  // State for editable full shift notes content
  const [editableFullShiftNotesContentState, setEditableFullShiftNotesContentState] = useState<string | null>(null);

  const handleUpdateNoteInHistory = useCallback((patientId: string | null, timestamp: number, newContent: string) => {
    setGeneratedNotesHistory(prevHistory => 
      prevHistory.map(record => 
        (record.patientId === patientId && record.timestamp === timestamp)
          ? { ...record, noteContent: newContent }
          : record
      )
    );
  }, []);

  // Save/Load State
  const [savedStates, setSavedStates] = useState<Record<string, SavedState>>(() => {
    try {
        const saved = localStorage.getItem('savedNotes');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error("Failed to parse saved notes from localStorage", e);
        return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('savedNotes', JSON.stringify(savedStates));
  }, [savedStates]);

  useEffect(() => {
    localStorage.setItem('noteLayoutSettings', JSON.stringify(settings));
  }, [settings]);

  // FIX: Remove duplicate function declarations
  const handleSectionToggle = useCallback((sectionId: string) => {
    setOpenSectionId(prevId => (prevId === sectionId ? null : sectionId));
  }, []);
  
  // FIX: Remove duplicate function declarations
  const handleRightSectionToggle = useCallback((sectionId: string) => {
    setOpenRightSectionId(prevId => (prevId === sectionId ? null : sectionId));
  }, []);

  const isContextSectionFilled = useMemo((): boolean => {
    return formState.gender !== '' || formState.quart !== '' || formState.heure !== '';
  }, [formState]);

  const isAdmissionSectionFilled = useMemo((): boolean => {
    const { admissionCheckboxes, orientation, autonomie, effetsPersonnels, accesVeineux, piccLine, drains, sondes, accesVeineux_site, piccLine_site } = formState;
    return admissionCheckboxes.length > 0 || orientation.length > 0 || autonomie !== '' || effetsPersonnels.trim() !== '' || accesVeineux || piccLine || drains.length > 0 || sondes.length > 0 || accesVeineux_site.trim() !== '' || piccLine_site.trim() !== '';
  }, [formState]);

  // Fix: Refine sectionId type for more accurate type checking within the function.
  const isSectionFilled = useCallback((sectionId: SectionData['id'] | 'douleur' | 'particularites', state: FormState): boolean => {
    if (sectionId === 'douleur') {
      const { p, q, r, s, t, u, site, medicament, interventionsNonPharma } = state.douleur;
      return p.length > 0 || q.length > 0 || r.length > 0 || s !== '' || t.length > 0 || u.length > 0 || site.trim() !== '' || medicament.trim() !== '' || interventionsNonPharma.length > 0;
    }
    if (sectionId === 'particularites') {
      return state.particularites.trim() !== '';
    }
    // 'finDeVie' is a valid SectionData ID, so it will fall through to the general logic.
    // However, it has a specific `_other` field that needs to be checked.
    if (sectionId === 'finDeVie') {
      return state.finDeVie.length > 0 || state.finDeVie_other.trim() !== '';
    }
    const value = state[sectionId as keyof FormState];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }, []);

  const handleRadioChange = useCallback((sectionId: keyof FormState, value: string) => {
    setFormState(prevState => ({ ...prevState, [sectionId]: value }));
  }, []);

  const handleHeureChange = useCallback((value: string) => {
    setFormState(prevState => ({ ...prevState, heure: value }));
  }, []);

  const handleCheckboxChange = useCallback((sectionId: keyof FormState, value: string) => {
    setFormState(prevState => {
      const currentValues = prevState[sectionId] as string[];
      const newValues = currentValues.includes(value) ? currentValues.filter(item => item !== value) : [...currentValues, value];
      return { ...prevState, [sectionId]: newValues };
    });
  }, []);

  const handlePainCheckboxChange = useCallback((field: keyof PainState, value: string) => {
    setFormState(prevState => {
      const currentValues = prevState.douleur[field] as string[];
      const newValues = currentValues.includes(value) ? currentValues.filter(item => item !== value) : [...currentValues, value];
      return { ...prevState, douleur: { ...prevState.douleur, [field]: newValues } };
    });
  }, []);

  const handlePainRadioChange = useCallback((field: keyof PainState, value: string) => {
      setFormState(prevState => ({ ...prevState, douleur: { ...prevState.douleur, [field]: value } }));
  }, []);

  const handlePainSiteChange = useCallback((value: string) => {
    setFormState(prevState => ({ ...prevState, douleur: { ...prevState.douleur, site: value } }));
  }, []);

  const handleParticularitesChange = useCallback((value: string) => {
    setFormState(prevState => ({ ...prevState, particularites: value }));
  }, []);

  const handleMedicamentChange = useCallback((sectionId: string, value: string) => {
    const key = `${sectionId}_medicament` as keyof FormState;
    setFormState(prevState => ({ ...prevState, [key]: value }));
  }, []);

  const handleInterventionChange = useCallback((sectionId: string, value: string) => {
    setFormState(prevState => {
      const key = `${sectionId}_interventions` as keyof FormState;
      const currentValues = prevState[key] as string[];
      const newValues = currentValues.includes(value) ? currentValues.filter(item => item !== value) : [...currentValues, value];
      return { ...prevState, [key]: newValues };
    });
  }, []);

  const handlePainMedicamentChange = useCallback((value: string) => {
    setFormState(prevState => ({ ...prevState, douleur: { ...prevState.douleur, medicament: value } }));
  }, []);

  const handlePainNonPharmaChange = useCallback((value: string) => {
    setFormState(prevState => {
      const currentValues = prevState.douleur.interventionsNonPharma;
      const newValues = currentValues.includes(value) ? currentValues.filter(item => item !== value) : [...currentValues, value];
      return { ...prevState, douleur: { ...prevState.douleur, interventionsNonPharma: newValues } };
    });
  }, []);

  const handleRespiratoireO2LitresChange = useCallback((value: string) => {
    setFormState(prevState => ({ ...prevState, respiratoire_o2_litres: value }));
  }, []);

  const handleAdmissionChange = useCallback((field: keyof FormState, value: string | boolean | string[]) => {
      setFormState(prevState => ({...prevState, [field]: value}));
  }, []);

  const handleFinDeVieOtherChange = useCallback((value: string) => {
    setFormState(prevState => ({...prevState, finDeVie_other: value}));
  }, []);


  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    setAiNote('');
    setGenerationError(null);
    setIsGenerating(false);
    setSelectedPatientId(null);
    setEditableFullShiftNotesContentState(null); // Reset edited full shift notes content
  }, [initialFormState]);

  const handleScenarioSelect = useCallback((scenarioState: Partial<FormState>) => {
    setFormState(prevState => ({ ...initialFormState, quart: prevState.quart, gender: prevState.gender, ...scenarioState }));
    setOpenSectionId(null);
  }, [initialFormState]);

  const isFormEmpty = useMemo(() => {
    const { quart, gender, ...restOfForm } = formState;
    const { quart: initialQuart, gender: initialGender, ...restOfInitialForm } = initialFormState;
    return JSON.stringify(restOfForm) === JSON.stringify(restOfInitialForm);
  }, [formState, initialFormState]);

  const handleSaveState = useCallback((name: string) => {
    if (name.trim() === '') return;
    const newState: SavedState = {
        formState,
        aiNote,
        layoutSettings: settings,
        timestamp: Date.now(),
        editableFullShiftNotesContent: editableFullShiftNotesContentState, // Save edited full shift notes content
    };
    setSavedStates(prev => ({ ...prev, [name]: newState }));
  }, [formState, aiNote, settings, editableFullShiftNotesContentState]);

  const handleLoadState = useCallback((name: string) => {
    const stateToLoad = savedStates[name];
    if (stateToLoad) {
        setFormState(stateToLoad.formState);
        setAiNote(stateToLoad.aiNote);
        if (stateToLoad.layoutSettings) {
            setSettings(stateToLoad.layoutSettings);
        }
        setEditableFullShiftNotesContentState(stateToLoad.editableFullShiftNotesContent || null); // Load edited full shift notes content
    }
  }, [savedStates]);

  const handleDeleteState = useCallback((name: string) => {
    setSavedStates(prev => {
        const newStates = { ...prev };
        delete newStates[name];
        return newStates;
    });
  }, []);
  
  const buildClinicalData = (state: FormState): string => {
    const parts: string[] = [];
    const { douleur, particularites, quart, gender, heure, finDeVie, finDeVie_other } = state;
    
    const contextParts = [];
    if (quart) contextParts.push(`note rédigée durant le quart de ${quart}`);
    if (heure) contextParts.push(`observation faite vers ${heure}`);

    if (contextParts.length > 0) {
        parts.push(`Contexte: ${contextParts.join(', ')}.`);
    }

    if (gender) parts.push(`Genre du patient: ${gender}.`);

    // Section Admission
    const admissionDetails = [];
    if (state.admissionCheckboxes.length > 0) admissionDetails.push(...state.admissionCheckboxes);
    if (state.orientation.length > 0) admissionDetails.push(`Orientation: ${state.orientation.join(', ')}.`);
    else admissionDetails.push("Orientation: Non évaluée ou non orienté(e).");
    if (state.autonomie) admissionDetails.push(`Autonomie fonctionnelle: ${state.autonomie}.`);
    if (state.effetsPersonnels.trim()) admissionDetails.push(`Effets personnels: ${state.effetsPersonnels.trim()}.`);
    
    if (state.accesVeineux) {
        let accesVeineuxText = `Accès veineux (CVP) fonctionnel`;
        if (state.accesVeineux_gauge) accesVeineuxText += `, calibre ${state.accesVeineux_gauge}`;
        if (state.accesVeineux_site) accesVeineuxText += ` au ${state.accesVeineux_site}`;
        admissionDetails.push(accesVeineuxText + '.');
    }
    if (state.piccLine) {
        let piccLineText = 'PICC Line en place et fonctionnel';
        if (state.piccLine_site) piccLineText += ` au ${state.piccLine_site}`;
        admissionDetails.push(piccLineText + '.');
    }
    
    if (state.drains.length > 0) admissionDetails.push(`Drains en place: ${state.drains.join(', ')}.`);
    if (state.sondes.length > 0) admissionDetails.push(`Sondes en place: ${state.sondes.join(', ')}.`);
    
    if (admissionDetails.length > 0) {
        parts.push(`- Admission : ${admissionDetails.join(' ')}`);
    }

    sectionsData.forEach(section => {
        const content = [];
        const selection = state[section.id as keyof FormState];
        
        if (Array.isArray(selection) && selection.length > 0) {
            let processedSelection = selection;
            if (section.id === 'respiratoire' && selection.includes('Utilisation d’O₂') && state.respiratoire_o2_litres) {
                processedSelection = selection.map(item => item === 'Utilisation d’O₂' ? `Utilisation d’O₂ (${state.respiratoire_o2_litres} L/min)` : item);
            }
            content.push(processedSelection.join(', '));
        } else if (typeof selection === 'string' && selection) {
            content.push(section.title.startsWith('Signes vitaux') || section.title.startsWith('Signes neurologiques') ? `${selection}, voir feuille spéciale` : selection);
        }
        
        // Handle 'Fin de vie' section with 'Autre' field
        if (section.id === 'finDeVie') {
            const finDeVieContent = [];
            if (finDeVie.length > 0) {
                finDeVieContent.push(finDeVie.join(', '));
            }
            if (finDeVie.includes('Autre (à préciser)') && finDeVie_other.trim()) {
                finDeVieContent.push(`Autre: ${finDeVie_other.trim()}`);
            }
            if (finDeVieContent.length > 0) {
                parts.push(`- ${section.title} : ${finDeVieContent.join('; ')}.`);
            }
        } else if (content.length > 0) {
            parts.push(`- ${section.title} : ${content.join('; ')}.`);
        }
    });

    const { p, q, r, s, t, u, site, medicament: painMedicament, interventionsNonPharma } = douleur;
    const painDetails = Object.entries({p, q, r, s, t, u})
        .map(([key, value]) => {
            const fieldLabel = painFieldsData.find(f => f.id === key)?.label || key.toUpperCase();
            if (key === 'r') {
                const rValues = Array.isArray(value) ? value : [];
                if (rValues.length === 0 && !site) return null;
                let rText = rValues.join(', ');
                if (site) rText += `${rText ? '; ' : ''}Site: ${site}`;
                return `  - ${fieldLabel} : ${rText}`;
            }
            if ((Array.isArray(value) && value.length > 0) || (typeof value === 'string' && value)) {
                return `  - ${fieldLabel} : ${Array.isArray(value) ? value.join(', ') : value}`;
            }
            return null;
        }).filter(Boolean);

    if (painDetails.length > 0 || painMedicament || (interventionsNonPharma?.length > 0)) {
        let painString = "- Douleur (PQRSTU) :";
        if (painDetails.length > 0) painString += `\n${painDetails.join('\n')}`;
        if (painMedicament) painString += `\n  - Intervention pharmacologique (Médicament) : ${painMedicament}`;
        if (interventionsNonPharma?.length > 0) painString += `\n  - Interventions non pharmacologiques : ${interventionsNonPharma.join(', ')}`;
        parts.push(painString);
    }
      
    if (particularites.trim()) parts.push(`- Particularités / Événements notables : ${particularites.trim()}`);
      
    return parts.filter(Boolean).join('\n');
  };

  const handleGenerateNote = useCallback(async () => {
    if (isFormEmpty) return;
    setIsGenerating(true);
    setGenerationError(null);
    setAiNote('');

    const clinicalData = buildClinicalData(formState);
    if (!clinicalData.trim()) {
      setGenerationError("Le formulaire est vide.");
      setIsGenerating(false);
      return;
    }

    const prompt = `RÔLE : Tu es un infirmier ou une infirmière rédigeant une note d'évolution pour le dossier d'un patient, conformément aux standards du système de santé québécois.
TÂCHE : Rédige une note narrative professionnelle, fluide et concise en français. La note doit intégrer toutes les données cliniques fournies dans un ou deux paragraphes cohérents.
IMPORTANT :
- Ne commence PAS la note par "Note d'évolution :".
- N'inclus PAS la date dans le corps de la note. L'heure peut être incluse si spécifiée dans les données.
- Accorde IMPÉRATIVEMENT le genre de la note (pronoms, adjectifs) en fonction du "Genre du patient" spécifié. 'Masculin' -> "le patient", "il". 'Féminin' -> "la patiente", "elle".

DONNÉES CLINIQUES :
${clinicalData}

Réponds IMPÉRATIVEMENT au format JSON en respectant le schéma fourni.`;

    try {
      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { note: { type: Type.STRING, description: "La note d'évolution infirmière narrative et complète, correctement accordée en genre." } },
                required: ['note']
            }
        }
      });
      
      const jsonString = response.text.trim();
      const parsedResponse = JSON.parse(jsonString);
      const generatedNoteContent = parsedResponse.note || "La note n'a pas pu être générée.";
      setAiNote(generatedNoteContent);

      // Save to history for shift report
      const currentPatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;
      setGeneratedNotesHistory(prev => [
        ...prev,
        {
          patientId: selectedPatientId,
          patientName: currentPatient?.name || 'Patient Inconnu',
          noteContent: generatedNoteContent,
          timestamp: Date.now(),
        }
      ]);
      setEditableFullShiftNotesContentState(null); // Reset full shift notes editing on new AI note generation

    } catch (error) {
      console.error("Erreur lors de la génération de la note :", error);
      setGenerationError("Une erreur est survenue. L'IA a peut-être renvoyé une réponse inattendue. Veuillez réessayer.");
    } finally {
      setIsGenerating(false);
    }
  }, [formState, isFormEmpty, selectedPatientId, patients]);
  
  const handleGenerateAssistantResponse = useCallback(async () => {
    if (!clinicalQuestion.trim()) return;
    setIsGeneratingAssistant(true);
    setAssistantError(null);
    setAssistantResponse('');

    const prompt = `RÔLE: Tu es un assistant clinique IA expert, conçu pour le personnel infirmier travaillant dans le système de santé du Québec.
TÂCHE: Réponds à la question clinique suivante de manière scientifique, concise et adaptée au contexte québécois.
NIVEAU DE COMPLEXITÉ: "${complexityLevel}".
- Si 'Simple': Explique en termes clairs et accessibles, comme si tu t'adressais à un patient ou un étudiant débutant. Évite le jargon complexe.
- Si 'Détaillé': Fournis une réponse technique et précise pour un professionnel de la santé, en utilisant des termes cliniques appropriés et en mentionnant potentiellement des considérations spécifiques au Québec si pertinent.

QUESTION: "${clinicalQuestion}"

RÉPONSE:`;

    try {
      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      setAssistantResponse(response.text);
    } catch (error) {
      console.error("Erreur lors de la génération de la réponse de l'assistant :", error);
      setAssistantError("Une erreur est survenue. L'IA n'a pas pu générer de réponse. Veuillez réessayer.");
    } finally {
      setIsGeneratingAssistant(false);
    }
  }, [clinicalQuestion, complexityLevel]);


  const handleGenerateShiftReport = useCallback(async () => {
    if (generatedNotesHistory.length === 0) {
      setShiftReportError("Aucune note n'a été générée pour créer un rapport de garde.");
      return;
    }

    setIsGeneratingShiftReport(true);
    setShiftReportError(null);
    setShiftReportOutput('');

    // Group notes by patient
    const notesByPatient: { [patientId: string]: GeneratedNoteRecord[] } = {};
    generatedNotesHistory.forEach(note => {
      if (!notesByPatient[note.patientId || 'unknown']) {
        notesByPatient[note.patientId || 'unknown'] = [];
      }
      notesByPatient[note.patientId || 'unknown'].push(note);
    });

    let clinicalDataForShiftReport = '';
    for (const patientId in notesByPatient) {
      const patientNotes = notesByPatient[patientId];
      const patient = patients.find(p => p.id === patientId);
      const patientName = patient?.name || patientNotes[0].patientName || 'Patient Inconnu';
      const room = patient?.room ? ` (Ch. ${patient.room})` : '';

      clinicalDataForShiftReport += `--- Patient: ${patientName}${room} ---\n`;
      patientNotes.forEach((note, index) => {
        const time = new Date(note.timestamp).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
        clinicalDataForShiftReport += `Note ${index + 1} (${time}): ${note.noteContent}\n`;
      });
      clinicalDataForShiftReport += `\n`; // Separator between patient notes
    }

    const prompt = `RÔLE : Tu es un infirmier ou une infirmière expérimenté(e) rédigeant un rapport de garde concis et structuré pour l'équipe soignante suivante, basé sur les notes d'évolution fournies.
TÂCHE : Pour chaque patient, synthétise les informations des notes d'évolution en un paragraphe clair et professionnel. Mets en évidence les événements marquants, les changements d'état, les interventions effectuées et les éléments importants à surveiller pour le prochain quart. Utilise le format Markdown pour la mise en forme.
IMPORTANT :
- Chaque résumé de patient doit être précédé d'un titre de niveau 2 (## Nom du patient).
- N'inclus PAS la date, seulement l'heure si nécessaire.
- Garde les résumés concis, comme une transmission orale de fin de quart.

NOTES D'ÉVOLUTION DU QUART :
${clinicalDataForShiftReport}

RÉPONSE (en format Markdown) :`;

    try {
        // @ts-ignore
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro', // Using pro for more complex summarization
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 2000 } // Give it a bit more thinking power for complex summaries
            }
        });
        setShiftReportOutput(response.text);
    } catch (error) {
        console.error("Erreur lors de la génération du rapport de garde :", error);
        setShiftReportError("Une erreur est survenue lors de la génération du rapport de garde. Veuillez réessayer.");
    } finally {
        setIsGeneratingShiftReport(false);
    }
  }, [generatedNotesHistory, patients]);

  const handleClearShiftReport = useCallback(() => {
    setGeneratedNotesHistory([]);
    setShiftReportOutput('');
    setShiftReportError(null);
    setEditableFullShiftNotesContentState(null); // Clear edited full shift notes content
  }, []);

  const handleAccessSubmit = (code: string) => {
    if (code === accessCode) {
      setIsAuthenticated(true);
      setAccessError(null);
    } else {
      setAccessError("Code d'accès incorrect. Veuillez réessayer.");
    }
  };

  const handleChangePassword = ({ currentCode, newCode }: { currentCode: string, newCode: string }): { success: boolean, message: string } => {
    if (currentCode !== accessCode) return { success: false, message: "Le code d'accès actuel est incorrect." };
    if (!newCode || newCode.length < 4) return { success: false, message: "Le nouveau code doit contenir au moins 4 caractères." };
    setAccessCode(newCode);
    localStorage.setItem('APP_ACCESS_CODE', newCode);
    return { success: true, message: "Code d'accès mis à jour avec succès !" };
  };

  if (!isAuthenticated) {
    return <AccessCodeScreen onAccessGranted={handleAccessSubmit} error={accessError} />;
  }
  
  const quartOptions: Option[] = [
    { value: 'Jour', label: 'Jour' },
    { value: 'Soir', label: 'Soir' },
    { value: 'Nuit', label: 'Nuit' },
  ];

  const genderOptions: Option[] = [
    { value: 'Masculin', label: 'Masculin' },
    { value: 'Féminin', label: 'Féminin' },
  ];

  // Explicitly define painSectionMeta as it's a special section not found in sectionsData by design
  const painSectionMeta = { id: 'douleur' as const, title: 'Douleur – Méthode PQRSTU' };
  
  // Filter sectionsData based on IDs that are actually present in sectionsData,
  // and handle custom sections like 'douleur' and 'particularites' separately.
  const sectionsBeforeDouleur = sectionsData.filter(sec => 
    !['finDeVie', 'observations', 'visites'].includes(sec.id)
  );

  const sectionsAfterDouleur = sectionsData.filter(sec => 
    ['finDeVie', 'observations', 'visites'].includes(sec.id)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col">
      <Header 
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className="flex-grow container mx-auto p-4 lg:p-8">
        {/* Top Section: Patient Manager and Shift Report */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <PatientManager 
                patients={patients}
                selectedPatientId={selectedPatientId}
                onSelectPatient={setSelectedPatientId}
                onManagePatients={() => setIsPatientModalOpen(true)}
            />
            <ShiftReportGenerator 
                generatedNotesHistory={generatedNotesHistory}
                onGenerate={handleGenerateShiftReport}
                output={shiftReportOutput}
                isLoading={isGeneratingShiftReport}
                error={shiftReportError}
                onClear={handleClearShiftReport}
                hasNotesToReport={generatedNotesHistory.length > 0}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Form Inputs */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <QuickScenarios onScenarioSelect={handleScenarioSelect} />

            <CollapsibleSection
                title="Contexte de la Note"
                isOpen={openSectionId === 'contexte'}
                onToggle={() => handleSectionToggle('contexte')}
                isFilled={isContextSectionFilled}
            >
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Genre du patient</label>
                        <RadioGroup name="gender" options={genderOptions} selectedValue={formState.gender} onChange={(value) => handleRadioChange('gender', value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Quart de travail</label>
                        <RadioGroup name="quart" options={quartOptions} selectedValue={formState.quart} onChange={(value) => handleRadioChange('quart', value)} />
                    </div>
                    <div>
                        <label htmlFor="heure-note" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Heure de l'observation (facultatif)</label>
                        <input
                            type="time"
                            id="heure-note"
                            value={formState.heure}
                            onChange={(e) => handleHeureChange(e.target.value)}
                            className="w-full max-w-xs p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                        />
                    </div>
                </div>
            </CollapsibleSection>

            <AdmissionSection
                isOpen={openSectionId === 'admission'}
                onToggle={() => handleSectionToggle('admission')}
                isFilled={isAdmissionSectionFilled}
                state={formState}
                onChange={handleAdmissionChange}
            />


            {sectionsBeforeDouleur.map(section => (
              <CollapsibleSection 
                key={section.id} 
                title={section.title}
                isOpen={openSectionId === section.id}
                onToggle={() => handleSectionToggle(section.id)}
                isFilled={isSectionFilled(section.id, formState)}
              >
                {section.type === 'radio' && <RadioGroup name={section.id} options={section.options} selectedValue={formState[section.id as keyof FormState] as string} onChange={(value) => handleRadioChange(section.id as keyof FormState, value)} />}
                {section.type === 'checkbox' && <CheckboxGroup sectionId={section.id} options={section.options} selectedValues={formState[section.id as keyof FormState] as string[]} onChange={(value) => handleCheckboxChange(section.id as keyof FormState, value)} />}
                {section.id === 'respiratoire' && formState.respiratoire.includes('Utilisation d’O₂') && (
                    <div className="mt-4">
                        <label htmlFor="respiratoire_o2_litres" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Débit d'oxygène (L/min)</label>
                        <input type="number" id="respiratoire_o2_litres" value={formState.respiratoire_o2_litres} onChange={(e) => handleRespiratoireO2LitresChange(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors" placeholder="Ex: 2" min="0" step="0.5" />
                    </div>
                )}
                {section.hasIntervention && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                        <div>
                            <label htmlFor={`${section.id}-medicament`} className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Médicament administré</label>
                            <input type="text" id={`${section.id}-medicament`} value={formState[`${section.id}_medicament` as keyof FormState] as string} onChange={(e) => handleMedicamentChange(section.id as string, e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors" placeholder="Ex: Nom, dosage, voie..." />
                        </div>
                        {section.interventions && (
                           <div>
                                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Interventions Associées</h3>
                                <CheckboxGroup sectionId={`${section.id}_interventions`} options={section.interventions} selectedValues={formState[`${section.id}_interventions` as keyof FormState] as string[]} onChange={(value) => handleInterventionChange(section.id, value)} />
                           </div>
                        )}
                    </div>
                )}
              </CollapsibleSection>
            ))}

            {/* Use painSectionMeta instead of painSectionData */}
            {painSectionMeta && (
                <CollapsibleSection
                title={painSectionMeta.title}
                isOpen={openSectionId === painSectionMeta.id}
                onToggle={() => handleSectionToggle(painSectionMeta.id)}
                isFilled={isSectionFilled(painSectionMeta.id, formState)}
                >
                <PainSection
                    data={painFieldsData}
                    painState={formState.douleur}
                    onCheckboxChange={handlePainCheckboxChange}
                    onRadioChange={handlePainRadioChange}
                    onSiteChange={handlePainSiteChange}
                    onMedicamentChange={handlePainMedicamentChange}
                    onNonPharmaChange={handlePainNonPharmaChange}
                />
                </CollapsibleSection>
            )}

            {sectionsAfterDouleur.map(section => (
              <CollapsibleSection 
                key={section.id} 
                title={section.title}
                isOpen={openSectionId === section.id}
                onToggle={() => handleSectionToggle(section.id)}
                isFilled={isSectionFilled(section.id, formState)}
              >
                {section.type === 'radio' && <RadioGroup name={section.id} options={section.options} selectedValue={formState[section.id as keyof FormState] as string} onChange={(value) => handleRadioChange(section.id as keyof FormState, value)} />}
                {section.type === 'checkbox' && <CheckboxGroup sectionId={section.id} options={section.options} selectedValues={formState[section.id as keyof FormState] as string[]} onChange={(value) => handleCheckboxChange(section.id as keyof FormState, value)} />}
                {section.hasOtherField && section.id === 'finDeVie' && formState.finDeVie.includes('Autre (à préciser)') && (
                    <div className="mt-4">
                        <label htmlFor="finDeVie_other" className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Préciser autre symptôme de fin de vie</label>
                        <input
                            type="text"
                            id="finDeVie_other"
                            value={formState.finDeVie_other}
                            onChange={(e) => handleFinDeVieOtherChange(e.target.value)}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                            placeholder="Ex: Diminution des réflexes, incontinence..."
                        />
                    </div>
                )}
                 {section.hasIntervention && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                        <div>
                            <label htmlFor={`${section.id}-medicament`} className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Médicament administré</label>
                            <input type="text" id={`${section.id}-medicament`} value={formState[`${section.id}_medicament` as keyof FormState] as string} onChange={(e) => handleMedicamentChange(section.id as string, e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors" placeholder="Ex: Nom, dosage, voie..." />
                        </div>
                        {section.interventions && (
                           <div>
                                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Interventions Associées</h3>
                                <CheckboxGroup sectionId={`${section.id}_interventions`} options={section.interventions} selectedValues={formState[`${section.id}_interventions` as keyof FormState] as string[]} onChange={(value) => handleInterventionChange(section.id, value)} />
                           </div>
                        )}
                    </div>
                )}
              </CollapsibleSection>
            ))}

             <CollapsibleSection
                title="Particularités / Événements notables"
                isOpen={openSectionId === 'particularites'}
                onToggle={() => handleSectionToggle('particularites')}
                isFilled={isSectionFilled('particularites', formState)}
             >
                <ParticularitesSection 
                    value={formState.particularites}
                    onChange={handleParticularitesChange}
                />
             </CollapsibleSection>
          </div>

          {/* Right Column: Tools */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-8 flex flex-col gap-8">
                <CollapsibleSection
                    title="Assistant Clinique IA"
                    isOpen={openRightSectionId === 'assistant'}
                    onToggle={() => handleRightSectionToggle('assistant')}
                    isFilled={assistantResponse.trim() !== '' || clinicalQuestion.trim() !== ''}
                >
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Obtenez des réponses rapides à vos questions cliniques, adaptées au contexte québécois.</p>
                    <ClinicalAssistant
                        question={clinicalQuestion}
                        onQuestionChange={setClinicalQuestion}
                        complexity={complexityLevel}
                        onComplexityChange={setComplexityLevel}
                        response={assistantResponse}
                        isLoading={isGeneratingAssistant}
                        error={assistantError}
                        onGenerate={handleGenerateAssistantResponse}
                        complexityOptions={complexityOptions}
                    />
                </CollapsibleSection>
                <SaveLoad 
                  savedStates={savedStates}
                  onSave={handleSaveState}
                  onLoad={handleLoadState}
                  onDelete={handleDeleteState}
                />
            </div>
          </div>

           {/* Full-width Note Section at the bottom */}
          <div className="lg:col-span-3 mt-8">
            <GeneratedNote 
                value={aiNote}
                onValueChange={setAiNote}
                isGenerating={isGenerating}
                error={generationError}
                isFormEmpty={isFormEmpty}
                onGenerate={handleGenerateNote}
                onReset={resetForm}
                settings={settings}
                setSettings={setSettings}
                // New props for full shift notes
                patients={patients}
                generatedNotesHistory={generatedNotesHistory}
                onUpdateNoteInHistory={handleUpdateNoteInHistory}
                editableFullShiftNotesContentState={editableFullShiftNotesContentState}
                setEditableFullShiftNotesContentState={setEditableFullShiftNotesContentState}
                theme={theme}
            />
          </div>
        </div>
      </main>
      <Footer />
       {isChangePasswordModalOpen && <ChangePasswordModal onClose={() => setIsChangePasswordModalOpen(false)} onSubmit={handleChangePassword} />}
       {isPatientModalOpen && (
            <PatientModal
                isOpen={isPatientModalOpen}
                onClose={() => setIsPatientModalOpen(false)}
                patients={patients}
                onSave={handleSavePatient}
                onDelete={handleDeletePatient}
            />
       )}
    </div>
  );
};

export default App;