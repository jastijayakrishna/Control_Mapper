// ─── Shared Frontend Types ─────────────────────────────────────────
// Mirrors backend types for API responses

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

export const SCOPE_FACT_ICONS: Record<keyof ScopeFacts, string> = {
  hasAws: '☁️',
  hasAzure: '🔷',
  hasGcp: '🟡',
  hasProduction: '🚀',
  hasAdminUsers: '👤',
  hasOkta: '🔐',
  hasGithub: '🐙',
  hasEncryptionAtRest: '🔒',
  hasEncryptionInTransit: '🔗',
  hasLogging: '📋',
  hasAlertMonitoring: '🔔',
  hasIncidentResponse: '🚨',
  hasRootAccountMfa: '🛡️',
  hasRootAccountSsoOnly: '🔑',
};

export type CoverageStatus = 'FULLY_COVERED' | 'PARTIALLY_COVERED' | 'NOT_APPLICABLE' | 'GAPS';

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
  excludedBy: string[];
  conditionSummary: string;
  scopeEvaluation: ScopeFactEvaluation[];
  weight: number;
  compensatingGroup?: string;
  contributed: boolean;
  effectiveWeight: number;
}

export interface ControlMapping {
  controlId: string;
  controlRef: string;
  controlTitle: string;
  controlDescription: string;
  status: CoverageStatus;
  coverage: number;
  maxCoverage: number;
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
