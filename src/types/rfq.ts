export type FieldKey =
  | 'partType'
  | 'material'
  | 'thickness'
  | 'quantity'
  | 'drawing'
  | 'surfaceFinish'
  | 'toleranceAndFeatures'
  | 'deliveryTerms';

export type FieldStatus =
  | 'confirmed'
  | 'check_history'
  | 'pending_customer'
  | 'needs_clarification'
  | 'needs_disambiguation'
  | 'partial_detail'
  | 'optional_missing';

export type PriorityLevel = 'P0' | 'P1' | 'P2';

export interface EmailRound {
  id: string;
  roundNumber: number;
  label: string;
  text: string;
}

export interface EvidenceSpan {
  roundId: string;
  roundNumber: number;
  quote: string;
  start: number;
  end: number;
  fieldKey: FieldKey;
}

export interface ExtractedRoundData {
  roundId: string;
  roundNumber: number;
  zhTranslation?: string;
  partType?: {
    value: string;
    zhLabel: string;
    evidence: EvidenceSpan[];
  };
  scopeWarnings: string[];
  generalHistoryRef?: EvidenceSpan;
  material?: {
    family?: string;
    zhFamily?: string;
    grade?: string;
    isHistoryRef?: boolean;
    evidence: EvidenceSpan[];
  };
  thickness?: {
    valueDisplay?: string;
    numericMm?: number;
    gaugeNumber?: number;
    isHistoryRef?: boolean;
    evidence: EvidenceSpan[];
  };
  quantity?: {
    values: number[];
    mode: 'single' | 'tiered' | 'revised' | 'ambiguous' | 'confirm_previous';
    isOnly?: boolean;
    isAdditive?: boolean;
    evidence: EvidenceSpan[];
  };
  drawing?: {
    state: 'attached' | 'sketch_only' | 'pending_customer' | 'check_history' | 'missing';
    formatDetail?: string;
    evidence: EvidenceSpan[];
  };
  surfaceFinish?: {
    valueDisplay?: string;
    zhLabel?: string;
    isChoiceAmbiguous?: boolean;
    choiceOptions?: string[];
    missingColorDetail?: boolean;
    isExplicitRaw?: boolean;
    isHistoryRef?: boolean;
    evidence: EvidenceSpan[];
  };
  toleranceAndFeatures?: {
    numericTolerance?: string;
    vagueTightTolerance?: boolean;
    secondaryOps: string[];
    evidence: EvidenceSpan[];
  };
  deliveryTerms?: {
    incoterm?: string;
    leadTime?: string;
    isUrgent?: boolean;
    evidence: EvidenceSpan[];
  };
}

export interface HistoryResolution {
  value: string;
  source: 'imported_order' | 'manual_input';
  orderNo?: string;
  orderDate?: string;
}

export interface FactoryHistoryOrder {
  id: string;
  orderNo: string;
  customerName?: string;
  orderDate?: string;
  partName: string;
  materialSpec: string;
  thickness: string;
  surfaceFinish: string;
  drawingRef?: string;
  notes?: string;
}

export interface MatchedHistoryOrder {
  order: FactoryHistoryOrder;
  score: number;
  matchedReasons: string[];
}

export interface MergedField {
  key: FieldKey;
  title: string;
  englishTitle: string;
  status: FieldStatus;
  displayValue: string;
  subValue?: string;
  engineeringNote: string;
  evidence: EvidenceSpan[];
  updatedInRound?: number;
  previousSummary?: string;
  resolvedFromHistory?: HistoryResolution;
  priority: PriorityLevel;
}

export interface ClarificationQuestion {
  id: string;
  fieldKey: FieldKey;
  priority: PriorityLevel;
  priorityLabel: string;
  zhQuestion: string;
  zhReason: string;
  enQuestion: string;
  defaultSelected: boolean;
}

export interface SkippedReason {
  fieldKey: FieldKey;
  fieldTitle: string;
  reason: string;
  status: FieldStatus;
}

export interface ReadinessSummary {
  level: 'ready' | 'waiting_drawing' | 'needs_info';
  headline: string;
  detail: string;
  blockerCount: number;
  internalCheckCount: number;
}

export interface AnalysisAudit {
  engineUsed: 'local' | 'llm';
  ungroundedBlockedCount: number;
  totalGroundedSpans: number;
  fallbackReason?: string;
}

export interface AnalysisResult {
  fields: MergedField[];
  questions: ClarificationQuestion[];
  skippedQuestions: SkippedReason[];
  historyCheckItems: MergedField[];
  resolvedHistoryItems: MergedField[];
  scopeWarnings: string[];
  readinessSummary: ReadinessSummary;
  audit: AnalysisAudit;
  extractedRounds: ExtractedRoundData[];
}

export type ReplyTone = 'concise' | 'polite';

export interface EngineConfig {
  mode: 'local' | 'llm_proxy' | 'llm_byok';
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface PresetSample {
  id: string;
  shortTitle: string;
  badge: string;
  description: string;
  round1Text: string;
  round1ZhSummary: string;
  demoRound2Text: string;
  demoRound2ZhSummary: string;
}

export interface BenchmarkCaseExpected {
  mustAskFields: FieldKey[];
  forbiddenAskFields: FieldKey[];
  forbiddenConfirmedTokens: string[];
  expectedStatusByField?: Partial<Record<FieldKey, FieldStatus>>;
  expectedNotesSummary?: string;
}

export interface BenchmarkCase {
  id: string;
  title: string;
  category: string;
  rounds: EmailRound[];
  isKnownBoundaryCase?: boolean;
  boundaryNote?: string;
  expected: BenchmarkCaseExpected;
}

export interface BenchmarkCaseResult {
  caseId: string;
  title: string;
  category: string;
  passed: boolean;
  isKnownBoundaryCase: boolean;
  boundaryNote?: string;
  missedQuestions: FieldKey[];
  repeatedQuestions: FieldKey[];
  hallucinations: string[];
  statusMismatches: string[];
  actualAskedFields: FieldKey[];
  summaryNote: string;
  rounds: EmailRound[];
}

export interface BenchmarkReport {
  totalCases: number;
  targetSinglePartCases: number;
  passedTargetCases: number;
  knownBoundaryCount: number;
  totalMissedQuestions: number;
  totalRepeatedQuestions: number;
  totalHallucinations: number;
  results: BenchmarkCaseResult[];
}
