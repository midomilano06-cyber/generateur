
export interface Option {
  value: string;
  label: string;
}

export type SectionType = 'radio' | 'checkbox';

export interface Patient {
  id: string;
  name: string;
  room?: string;
  gender: 'Masculin' | 'Féminin';
}

export interface PainState {
  p: string[];
  q: string[];
  r: string[];
  site: string;
  s: string;
  t: string[];
  u: string[];
  medicament: string;
  interventionsNonPharma: string[];
}

export interface PainField {
  id: keyof Omit<PainState, 'medicament' | 'interventionsNonPharma' | 'site'>;
  label: string;
  type: 'radio' | 'checkbox';
  options: Option[];
}

export interface FormState {
  quart: string;
  gender: string;
  heure: string;
  // Admission fields
  admissionCheckboxes: string[];
  orientation: string[];
  autonomie: string;
  effetsPersonnels: string;
  accesVeineux: boolean;
  accesVeineux_gauge: string;
  accesVeineux_site: string;
  piccLine: boolean;
  piccLine_site: string;
  drains: string[];
  sondes: string[];
  // Other sections
  position: string[];
  etatEveil: string;
  signesVitaux: string;
  signesNeuro: string;
  respiratoire: string[];
  respiratoire_medicament: string;
  respiratoire_interventions: string[];
  respiratoire_o2_litres: string;
  digestif: string[];
  digestif_medicament: string;
  digestif_interventions: string[];
  urinaire: string[];
  urinaire_medicament: string;
  urinaire_interventions: string[];
  tegumentaire: string[];
  tegumentaire_medicament: string;
  tegumentaire_interventions: string[];
  geriatrie: string[];
  finDeVie: string[]; // Added for end-of-life symptoms
  finDeVie_other: string; // Added for custom end-of-life symptoms
  observations: string[];
  visites: string;
  particularites: string;
  douleur: PainState;
}

// Define explicitly all keys that should NOT be part of SectionData['id']
type OmittedSectionDataKeys =
  | 'quart'
  | 'gender'
  | 'heure'
  // Admission related
  | 'admissionCheckboxes'
  | 'orientation'
  | 'autonomie'
  | 'effetsPersonnels'
  | 'accesVeineux'
  | 'accesVeineux_gauge'
  | 'accesVeineux_site'
  | 'piccLine'
  | 'piccLine_site'
  | 'drains'
  | 'sondes'
  // Specific medication/intervention/value fields
  | 'respiratoire_medicament'
  | 'respiratoire_interventions'
  | 'respiratoire_o2_litres'
  | 'digestif_medicament'
  | 'digestif_interventions'
  | 'urinaire_medicament'
  | 'urinaire_interventions'
  | 'tegumentaire_medicament'
  | 'tegumentaire_interventions'
  | 'finDeVie_other'
  // Special root sections handled separately
  | 'douleur'
  | 'particularites';

export interface SectionData {
  id: keyof Omit<FormState, OmittedSectionDataKeys>;
  title: string;
  type: SectionType;
  options: Option[];
  hasIntervention?: boolean;
  interventions?: Option[];
  hasOtherField?: boolean; // Added for 'other' text input
}

export interface LayoutSettings {
    lineHeight: number;
    fontSize: number;
    textTopPosition: number;
    textLeftPosition: number;
    textBlockWidth: number;
    letterSpacing: number;
    fontWeight: number;
    fontFamily: string;
}

export interface SavedState {
  formState: FormState;
  aiNote: string;
  layoutSettings?: LayoutSettings;
  timestamp?: number;
  editableFullShiftNotesContent?: string | null; // New field for edited full shift notes
}

export interface Scenario {
  label: string;
  state: Partial<FormState>;
}

export interface ScenarioCategory {
  title: string;
  scenarios: Scenario[];
}

export interface GeneratedNoteRecord {
  patientId: string | null;
  patientName: string;
  noteContent: string;
  timestamp: number;
}