import { initDb, getDb, closeDb } from './database.js';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure data directory exists
mkdirSync(join(__dirname, '..', '..', 'data'), { recursive: true });

initDb();
const db = getDb();

// ─── Clear existing data ───────────────────────────────────────────
db.exec('DELETE FROM customer_scope');
db.exec('DELETE FROM control');
db.exec('DELETE FROM requirement');
db.exec('DELETE FROM catalog_version');

// ─── Catalog Version ───────────────────────────────────────────────
const CATALOG_VERSION = '2024.1';

db.prepare(`
  INSERT INTO catalog_version (version, published_at, published_by, status)
  VALUES (?, ?, ?, ?)
`).run(CATALOG_VERSION, '2024-01-15T00:00:00Z', 'security-team', 'published');

// ─── Requirements ──────────────────────────────────────────────────
const insertReq = db.prepare(`
  INSERT INTO requirement (id, catalog_version, statement, domain, applies_when, criticality, rationale, authoritative_source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

interface ReqSeed {
  id: string;
  statement: string;
  domain: string;
  appliesWhen: object;
  criticality: number;
  rationale: string;
  authoritativeSource: string;
}

const requirements: ReqSeed[] = [
  // ── Logical Access (CC6.x) ──────────────────────────────────────
  {
    id: 'REQ-LA-001',
    statement: 'MFA enforced on administrative console access to production cloud infrastructure (AWS Console, Azure Portal, or GCP Console).',
    domain: 'Logical Access',
    appliesWhen: {
      and: [
        { or: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasAzure' }, true] }, { '==': [{ var: 'hasGcp' }, true] }] },
        { '==': [{ var: 'hasAdminUsers' }, true] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    },
    criticality: 5,
    rationale:
      'Administrative console access to production cloud infrastructure represents the highest-privilege attack surface. MFA prevents credential-only compromise of the entire environment.',
    authoritativeSource: 'AICPA TSC CC6.1 — Logical and Physical Access Controls',
  },
  {
    id: 'REQ-LA-002',
    statement: 'MFA enforced on all version control system (VCS) accounts with write access to production-deployed repositories.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasGithub' }, true] }, { '==': [{ var: 'hasProduction' }, true] }],
    },
    criticality: 4,
    rationale:
      'VCS accounts with write access can modify production-deployed code. Compromised VCS credentials enable supply-chain attacks. MFA mitigates credential theft.',
    authoritativeSource: 'AICPA TSC CC6.1 — Logical and Physical Access Controls',
  },
  {
    id: 'REQ-LA-003',
    statement: 'SSO (SAML/OIDC) enforced as the sole authentication mechanism for production cloud console access, eliminating local password authentication.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [
        { '==': [{ var: 'hasOkta' }, true] },
        { or: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasAzure' }, true] }, { '==': [{ var: 'hasGcp' }, true] }] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    },
    criticality: 4,
    rationale:
      'SSO centralizes authentication, enabling consistent policy enforcement (session timeouts, credential rotation) and immediate deprovisioning via IdP. Eliminates local password sprawl.',
    authoritativeSource: 'AICPA TSC CC6.1, CC6.2 — Logical Access Controls, Credentials',
  },
  {
    id: 'REQ-LA-004',
    statement: 'Root/superadmin account protected with hardware MFA token, with usage restricted to break-glass procedures only.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [
        { or: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasAzure' }, true] }, { '==': [{ var: 'hasGcp' }, true] }] },
        { '==': [{ var: 'hasRootAccountMfa' }, true] },
      ],
    },
    criticality: 5,
    rationale:
      'Root accounts bypass all IAM policies and have unrestricted access. Hardware MFA prevents remote credential compromise. Break-glass restriction limits exposure window.',
    authoritativeSource: 'AICPA TSC CC6.1 — Logical and Physical Access Controls; AWS CIS Benchmark 1.5',
  },
  {
    id: 'REQ-LA-005',
    statement: 'Root/superadmin account access eliminated via SSO-only federation, with root credentials rotated and vaulted.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [
        { or: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasAzure' }, true] }, { '==': [{ var: 'hasGcp' }, true] }] },
        { '==': [{ var: 'hasRootAccountSsoOnly' }, true] },
      ],
    },
    criticality: 5,
    rationale:
      'Eliminating root account access entirely via SSO federation removes the highest-risk credential from operational use. Superior to MFA-only root protection.',
    authoritativeSource: 'AICPA TSC CC6.1 — Logical and Physical Access Controls; AWS Well-Architected Security Pillar',
  },
  {
    id: 'REQ-LA-006',
    statement: 'IAM policies enforce least-privilege access: no wildcard (*) actions or resources in production IAM policies, verified by automated policy analysis.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasProduction' }, true] }],
    },
    criticality: 4,
    rationale:
      'Wildcard IAM policies grant unbounded permissions, violating least-privilege. Automated analysis catches policy drift before it creates exposure.',
    authoritativeSource: 'AICPA TSC CC6.3 — Role-Based Access; AWS CIS Benchmark 1.16',
  },
  {
    id: 'REQ-LA-007',
    statement: 'Network segmentation enforced: production VPC/VNET isolated from non-production with no direct peering, and ingress restricted to load balancer endpoints only.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [
        { or: [{ '==': [{ var: 'hasAws' }, true] }, { '==': [{ var: 'hasAzure' }, true] }, { '==': [{ var: 'hasGcp' }, true] }] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    },
    criticality: 4,
    rationale:
      'Network segmentation contains blast radius. Production isolation prevents lateral movement from compromised non-production workloads.',
    authoritativeSource: 'AICPA TSC CC6.6 — System Boundaries; NIST SP 800-53 SC-7',
  },
  {
    id: 'REQ-LA-008',
    statement: 'Encryption at rest enforced on all production data stores (databases, object storage, block storage) using cloud provider managed or customer-managed keys.',
    domain: 'Data Protection',
    appliesWhen: {
      and: [
        { '==': [{ var: 'hasEncryptionAtRest' }, true] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    },
    criticality: 4,
    rationale:
      'Encryption at rest protects data confidentiality if storage media is physically compromised or logical access controls are bypassed.',
    authoritativeSource: 'AICPA TSC CC6.7 — Data Transmission and Movement; NIST SP 800-53 SC-28',
  },
  {
    id: 'REQ-LA-009',
    statement: 'TLS 1.2 or higher enforced on all production data-in-transit paths, including internal service-to-service communication.',
    domain: 'Data Protection',
    appliesWhen: {
      and: [
        { '==': [{ var: 'hasEncryptionInTransit' }, true] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    },
    criticality: 4,
    rationale:
      'TLS enforcement prevents eavesdropping and man-in-the-middle attacks. Internal service-to-service TLS prevents east-west traffic interception.',
    authoritativeSource: 'AICPA TSC CC6.7 — Data Transmission and Movement; NIST SP 800-52 Rev2',
  },
  {
    id: 'REQ-LA-010',
    statement: 'Branch protection rules enforced on production-deployed repositories: require pull request reviews, status checks, and signed commits before merge to main.',
    domain: 'Change Management',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasGithub' }, true] }, { '==': [{ var: 'hasProduction' }, true] }],
    },
    criticality: 3,
    rationale:
      'Branch protection prevents unauthorized or unreviewed code from reaching production. Pull request reviews provide peer oversight. Signed commits ensure author attribution.',
    authoritativeSource: 'AICPA TSC CC8.1 — Change Management; NIST SP 800-53 CM-3',
  },
  {
    id: 'REQ-LA-011',
    statement: 'Quarterly access reviews conducted for all production systems: verify continued need, correct role assignment, and remove stale accounts within 7 days of discovery.',
    domain: 'Logical Access',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasProduction' }, true] }, { '==': [{ var: 'hasAdminUsers' }, true] }],
    },
    criticality: 3,
    rationale:
      'Access reviews detect privilege creep and orphaned accounts. 7-day remediation SLA ensures findings are actionable, not aspirational.',
    authoritativeSource: 'AICPA TSC CC6.2, CC6.3 — Credential Management, Role-Based Access',
  },

  // ── Monitoring (CC7.x) ──────────────────────────────────────────
  {
    id: 'REQ-MON-001',
    statement: 'Centralized log aggregation operational for all production systems: compute, networking, identity, and data plane events forwarded to SIEM or log management platform with minimum 90-day retention.',
    domain: 'Monitoring',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasLogging' }, true] }, { '==': [{ var: 'hasProduction' }, true] }],
    },
    criticality: 5,
    rationale:
      'Centralized logging enables detection, investigation, and forensics. 90-day retention covers typical audit lookback windows. Without centralized logs, monitoring is blind.',
    authoritativeSource: 'AICPA TSC CC7.1 — Configuration and Vulnerability Management; NIST SP 800-53 AU-6',
  },
  {
    id: 'REQ-MON-002',
    statement: 'Automated alert rules configured for critical security events: unauthorized API calls, root account usage, security group modifications, and failed authentication exceeding threshold.',
    domain: 'Monitoring',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasAlertMonitoring' }, true] }, { '==': [{ var: 'hasProduction' }, true] }],
    },
    criticality: 4,
    rationale:
      'Automated alerting converts log data into actionable signals. Without alerts, threats persist until manual discovery — typically measured in months (IBM: 204-day average dwell time).',
    authoritativeSource: 'AICPA TSC CC7.2 — Monitoring Activities; NIST SP 800-53 SI-4',
  },
  {
    id: 'REQ-MON-003',
    statement: 'Anomaly detection enabled for production workloads: baseline established for normal compute, network, and API patterns; deviations trigger investigation within defined SLA.',
    domain: 'Monitoring',
    appliesWhen: {
      and: [
        { '==': [{ var: 'hasAlertMonitoring' }, true] },
        { '==': [{ var: 'hasLogging' }, true] },
        { '==': [{ var: 'hasProduction' }, true] },
      ],
    },
    criticality: 3,
    rationale:
      'Anomaly detection catches threats that static rules miss. Baselining enables detection of novel attack patterns without predefined signatures.',
    authoritativeSource: 'AICPA TSC CC7.2 — Monitoring Activities; NIST SP 800-53 SI-4(4)',
  },
  {
    id: 'REQ-MON-004',
    statement: 'Documented incident response plan covering: classification severity levels, escalation procedures, communication templates, containment playbooks, and post-incident review process.',
    domain: 'Incident Response',
    appliesWhen: {
      and: [{ '==': [{ var: 'hasIncidentResponse' }, true] }, { '==': [{ var: 'hasProduction' }, true] }],
    },
    criticality: 4,
    rationale:
      'Incident response readiness determines whether detection leads to containment or chaos. Plans must be documented — ad-hoc response fails under pressure.',
    authoritativeSource: 'AICPA TSC CC7.3, CC7.4 — Incident Management; NIST SP 800-61 Rev2',
  },
];

const insertReqTx = db.transaction(() => {
  for (const req of requirements) {
    insertReq.run(
      req.id,
      CATALOG_VERSION,
      req.statement,
      req.domain,
      JSON.stringify(req.appliesWhen),
      req.criticality,
      req.rationale,
      req.authoritativeSource
    );
  }
});
insertReqTx();

// ─── Controls ──────────────────────────────────────────────────────
const insertCtrl = db.prepare(`
  INSERT INTO control (id, catalog_version, framework, ref, title, description, verifies_json, rationale)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

interface CtrlSeed {
  id: string;
  ref: string;
  title: string;
  description: string;
  verifies: { requirementId: string; weight: number; compensatingGroup?: string }[];
  rationale: string;
}

const controls: CtrlSeed[] = [
  {
    id: 'SOC2-CC6.1',
    ref: 'CC6.1',
    title: 'Logical Access Security',
    description:
      'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.',
    verifies: [
      { requirementId: 'REQ-LA-001', weight: 0.30 },
      { requirementId: 'REQ-LA-003', weight: 0.25 },
      { requirementId: 'REQ-LA-004', weight: 0.25, compensatingGroup: 'root-access-protection' },
      { requirementId: 'REQ-LA-005', weight: 0.25, compensatingGroup: 'root-access-protection' },
      { requirementId: 'REQ-LA-007', weight: 0.20 },
    ],
    rationale:
      'CC6.1 requires multi-layered logical access controls. MFA (REQ-LA-001) is the primary control. SSO (REQ-LA-003) centralizes auth policy. Root account protection is addressed through a compensating group: either hardware MFA (REQ-LA-004) or SSO-only federation (REQ-LA-005) satisfies the root protection requirement — both represent valid approaches. Network segmentation (REQ-LA-007) provides defense-in-depth. Weights ensure full coverage when a scope includes cloud, admin users, production, and at least one root protection method.',
  },
  {
    id: 'SOC2-CC6.2',
    ref: 'CC6.2',
    title: 'User Authentication and Credential Management',
    description:
      'Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users. Credentials are removed when access is no longer authorized.',
    verifies: [
      { requirementId: 'REQ-LA-001', weight: 0.30 },
      { requirementId: 'REQ-LA-002', weight: 0.25 },
      { requirementId: 'REQ-LA-003', weight: 0.25 },
      { requirementId: 'REQ-LA-011', weight: 0.20 },
    ],
    rationale:
      'CC6.2 focuses on credential lifecycle. MFA (REQ-LA-001, REQ-LA-002) ensures credentials alone don\'t grant access. SSO (REQ-LA-003) provides centralized credential management. Access reviews (REQ-LA-011) ensure stale credentials are removed. Weights sum to 1.0 for fully-scoped customer.',
  },
  {
    id: 'SOC2-CC6.3',
    ref: 'CC6.3',
    title: 'Role-Based Access and Least Privilege',
    description:
      'The entity authorizes, modifies, or removes access to data, software functions, and protected information assets based on roles, responsibilities, or the system design and changes.',
    verifies: [
      { requirementId: 'REQ-LA-006', weight: 0.40 },
      { requirementId: 'REQ-LA-011', weight: 0.35, compensatingGroup: 'access-lifecycle' },
      { requirementId: 'REQ-LA-003', weight: 0.35, compensatingGroup: 'access-lifecycle' },
      { requirementId: 'REQ-LA-010', weight: 0.25 },
    ],
    rationale:
      'CC6.3 requires role-based access. Least-privilege IAM (REQ-LA-006) is the primary control. Access lifecycle is a compensating group: either quarterly reviews (REQ-LA-011) or SSO-based automated deprovisioning (REQ-LA-003) satisfies access lifecycle management. Branch protection (REQ-LA-010) extends least-privilege to code access.',
  },
  {
    id: 'SOC2-CC6.6',
    ref: 'CC6.6',
    title: 'System Boundaries and Network Segmentation',
    description:
      'The entity implements logical access security measures against threats from sources outside its system boundaries.',
    verifies: [
      { requirementId: 'REQ-LA-007', weight: 0.50 },
      { requirementId: 'REQ-LA-009', weight: 0.30 },
      { requirementId: 'REQ-LA-001', weight: 0.20 },
    ],
    rationale:
      'CC6.6 protects system boundaries. Network segmentation (REQ-LA-007) is the primary control — production isolation is the literal boundary. TLS (REQ-LA-009) secures data crossing boundaries. MFA (REQ-LA-001) prevents unauthorized boundary traversal via compromised credentials.',
  },
  {
    id: 'SOC2-CC6.7',
    ref: 'CC6.7',
    title: 'Data Transmission and Movement Controls',
    description:
      'The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes, and protects it during transmission.',
    verifies: [
      { requirementId: 'REQ-LA-009', weight: 0.40 },
      { requirementId: 'REQ-LA-008', weight: 0.35 },
      { requirementId: 'REQ-LA-010', weight: 0.25 },
    ],
    rationale:
      'CC6.7 governs data protection in transit and at rest. TLS (REQ-LA-009) secures transit. Encryption at rest (REQ-LA-008) secures stored data. Branch protection (REQ-LA-010) controls how code (a form of data) moves to production.',
  },
  {
    id: 'SOC2-CC6.8',
    ref: 'CC6.8',
    title: 'Protection Against Malicious Software',
    description:
      'The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.',
    verifies: [
      { requirementId: 'REQ-LA-010', weight: 0.35 },
      { requirementId: 'REQ-LA-002', weight: 0.30 },
      { requirementId: 'REQ-MON-002', weight: 0.35 },
    ],
    rationale:
      'CC6.8 addresses malicious software prevention. Branch protection (REQ-LA-010) prevents unauthorized code introduction. VCS MFA (REQ-LA-002) prevents attacker access to repositories. Alert monitoring (REQ-MON-002) detects suspicious activity that may indicate malware presence.',
  },
  {
    id: 'SOC2-CC7.1',
    ref: 'CC7.1',
    title: 'Infrastructure and Software Monitoring',
    description:
      'To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations and new vulnerabilities.',
    verifies: [
      { requirementId: 'REQ-MON-001', weight: 0.40 },
      { requirementId: 'REQ-MON-002', weight: 0.30 },
      { requirementId: 'REQ-MON-003', weight: 0.30 },
    ],
    rationale:
      'CC7.1 requires detection and monitoring. Centralized logging (REQ-MON-001) is the foundation — you can\'t monitor what you can\'t see. Alert rules (REQ-MON-002) convert logs into actionable signals. Anomaly detection (REQ-MON-003) catches threats that static rules miss.',
  },
  {
    id: 'SOC2-CC7.2',
    ref: 'CC7.2',
    title: 'Security Event Detection and Analysis',
    description:
      'The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity\'s ability to meet its objectives.',
    verifies: [
      { requirementId: 'REQ-MON-002', weight: 0.35 },
      { requirementId: 'REQ-MON-003', weight: 0.35 },
      { requirementId: 'REQ-MON-001', weight: 0.30 },
    ],
    rationale:
      'CC7.2 focuses on event detection and analysis. Alert monitoring (REQ-MON-002) and anomaly detection (REQ-MON-003) are equally weighted as primary detection mechanisms. Centralized logging (REQ-MON-001) provides the data foundation both depend on.',
  },
  {
    id: 'SOC2-CC7.3',
    ref: 'CC7.3',
    title: 'Incident Response and Recovery',
    description:
      'The entity evaluates security events to determine whether they constitute incidents, and if so, takes action to contain, remediate, and recover from them.',
    verifies: [
      { requirementId: 'REQ-MON-004', weight: 0.40 },
      { requirementId: 'REQ-MON-002', weight: 0.30 },
      { requirementId: 'REQ-MON-001', weight: 0.30 },
    ],
    rationale:
      'CC7.3 requires incident response capability. IR plan (REQ-MON-004) is the primary control — procedures must exist before incidents occur. Alert monitoring (REQ-MON-002) feeds the incident pipeline. Centralized logging (REQ-MON-001) enables investigation and forensics.',
  },
];

const insertCtrlTx = db.transaction(() => {
  for (const ctrl of controls) {
    insertCtrl.run(
      ctrl.id,
      CATALOG_VERSION,
      'SOC2',
      ctrl.ref,
      ctrl.title,
      ctrl.description,
      JSON.stringify(ctrl.verifies),
      ctrl.rationale
    );
  }
});
insertCtrlTx();

// ─── Default Customer ──────────────────────────────────────────────
// Pre-set demo scope for VP walkthrough: AWS + Production + AdminUsers + Okta + RootAccountMfa
// This ensures the demo starts impressive (most controls showing coverage) rather than
// a wall of N/A that requires toggling to see value.
const defaultFacts = {
  hasAws: true,
  hasAzure: false,
  hasGcp: false,
  hasProduction: true,
  hasAdminUsers: true,
  hasOkta: true,
  hasGithub: false,
  hasEncryptionAtRest: false,
  hasEncryptionInTransit: false,
  hasLogging: false,
  hasAlertMonitoring: false,
  hasIncidentResponse: false,
  hasRootAccountMfa: true,
  hasRootAccountSsoOnly: false,
};

db.prepare(`
  INSERT OR REPLACE INTO customer_scope (customer_id, facts_json, pinned_catalog_version, updated_at)
  VALUES (?, ?, ?, ?)
`).run('demo-customer', JSON.stringify(defaultFacts), CATALOG_VERSION, new Date().toISOString());

closeDb();
console.log(`✓ Seeded catalog version ${CATALOG_VERSION}`);
console.log(`  ${requirements.length} requirements`);
console.log(`  ${controls.length} controls`);
console.log(`  1 demo customer (demo scope: AWS, Production, AdminUsers, Okta, RootAccountMfa)`);
