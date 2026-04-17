// ─── Scope Facts ───────────────────────────────────────────────────
// Every boolean fact a customer can declare about their environment.
// The mapping engine evaluates appliesWhen expressions against this object.

export interface ScopeFacts {
  hasAws: boolean;
  hasAzure: boolean;
  hasGcp: boolean;
  hasProduction: boolean;
  hasAdminUsers: boolean;
  hasOkta: boolean;
  hasGithub: boolean;
  hasEncryptionAtRest: boolean;
  hasEncryptionInTransit: boolean;
  hasLogging: boolean;
  hasAlertMonitoring: boolean;
  hasIncidentResponse: boolean;
  hasRootAccountMfa: boolean;
  hasRootAccountSsoOnly: boolean;
}

export const DEFAULT_SCOPE_FACTS: ScopeFacts = {
  hasAws: false,
  hasAzure: false,
  hasGcp: false,
  hasProduction: false,
  hasAdminUsers: false,
  hasOkta: false,
  hasGithub: false,
  hasEncryptionAtRest: false,
  hasEncryptionInTransit: false,
  hasLogging: false,
  hasAlertMonitoring: false,
  hasIncidentResponse: false,
  hasRootAccountMfa: false,
  hasRootAccountSsoOnly: false,
};

export const SCOPE_FACT_LABELS: Record<keyof ScopeFacts, string> = {
  hasAws: 'AWS',
  hasAzure: 'Azure',
  hasGcp: 'GCP',
  hasProduction: 'Production Environment',
  hasAdminUsers: 'Administrative Users',
  hasOkta: 'Okta SSO',
  hasGithub: 'GitHub',
  hasEncryptionAtRest: 'Encryption at Rest',
  hasEncryptionInTransit: 'Encryption in Transit',
  hasLogging: 'Centralized Logging',
  hasAlertMonitoring: 'Alert Monitoring',
  hasIncidentResponse: 'Incident Response',
  hasRootAccountMfa: 'Root Account MFA',
  hasRootAccountSsoOnly: 'Root Account SSO-Only',
};

export const SCOPE_FACT_CATEGORIES: Record<string, (keyof ScopeFacts)[]> = {
  'Cloud Providers': ['hasAws', 'hasAzure', 'hasGcp'],
  'Identity & Access': ['hasAdminUsers', 'hasOkta', 'hasRootAccountMfa', 'hasRootAccountSsoOnly'],
  'Security Controls': ['hasEncryptionAtRest', 'hasEncryptionInTransit', 'hasProduction'],
  'Operations': ['hasLogging', 'hasAlertMonitoring', 'hasIncidentResponse', 'hasGithub'],
};

// ─── Catalog Version ───────────────────────────────────────────────

export interface CatalogVersion {
  version: string;
  publishedAt: string;
  publishedBy: string;
  status: 'draft' | 'published' | 'deprecated';
}

// ─── Requirement ───────────────────────────────────────────────────

export interface Requirement {
  id: string;
  catalogVersion: string;
  statement: string;
  domain: string;
  appliesWhen: object; // jsonLogic expression
  criticality: number; // 1-5
  rationale: string;
  authoritativeSource: string;
}

// ─── Control ───────────────────────────────────────────────────────

export interface VerifiesEntry {
  requirementId: string;
  weight: number;
  compensatingGroup?: string;
}

export interface Control {
  id: string;
  catalogVersion: string;
  framework: string;
  ref: string;
  title: string;
  description: string;
  verifies: VerifiesEntry[];
  rationale: string;
}

// ─── Customer Scope ────────────────────────────────────────────────

export interface CustomerScope {
  customerId: string;
  facts: ScopeFacts;
  pinnedCatalogVersion: string;
  updatedAt: string;
}

// ─── Mapping Results ───────────────────────────────────────────────

export type CoverageStatus =
  | 'FULLY_COVERED'
  | 'PARTIALLY_COVERED'
  | 'NOT_APPLICABLE'
  | 'GAPS';

/** Per-fact evaluation trace — shows the VP exactly which clause passed/failed */
export interface ScopeFactEvaluation {
  fact: string;
  label: string;
  required: boolean;
  actual: boolean;
  satisfied: boolean;
}

export interface RequirementExplanation {
  requirementId: string;
  statement: string;
  applicable: boolean;
  /** If not applicable, which scope facts caused exclusion */
  excludedBy: string[];
  /** Human-readable condition: "hasAws AND hasProduction AND hasOkta" */
  conditionSummary: string;
  /** Per-fact evaluation trace for the appliesWhen condition */
  scopeEvaluation: ScopeFactEvaluation[];
  weight: number;
  compensatingGroup?: string;
  /** Whether this requirement contributed to coverage */
  contributed: boolean;
  effectiveWeight: number;
}

export interface ControlMapping {
  controlId: string;
  controlRef: string;
  controlTitle: string;
  controlDescription: string;
  status: CoverageStatus;
  coverage: number; // 0.0 - 1.0
  maxCoverage: number; // coverage if all referenced requirements were applicable
  applicableCount: number;
  totalCount: number;
  explanation: RequirementExplanation[];
}

export interface MappingResult {
  customerId: string;
  catalogVersion: string;
  computedAt: string;
  controls: ControlMapping[];
}

export interface CoverageSummary {
  customerId: string;
  catalogVersion: string;
  totalControls: number;
  applicableControls: number;
  fullyCovered: number;
  partiallyCovered: number;
  notApplicable: number;
  gaps: number;
  uniqueRequirements: number;
  totalMappings: number;
}
