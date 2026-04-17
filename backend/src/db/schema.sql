-- Control Mapping Engine — Schema
-- Four tables: CatalogVersion, Requirement, Control, CustomerScope

CREATE TABLE IF NOT EXISTS catalog_version (
  version       TEXT PRIMARY KEY,
  published_at  TEXT NOT NULL,
  published_by  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('draft', 'published', 'deprecated'))
);

CREATE TABLE IF NOT EXISTS requirement (
  id                TEXT NOT NULL,
  catalog_version   TEXT NOT NULL,
  statement         TEXT NOT NULL,
  domain            TEXT NOT NULL,
  applies_when      TEXT NOT NULL,  -- jsonLogic expression (JSON string)
  criticality       INTEGER NOT NULL CHECK (criticality BETWEEN 1 AND 5),
  rationale         TEXT NOT NULL,
  authoritative_source TEXT NOT NULL,
  PRIMARY KEY (id, catalog_version),
  FOREIGN KEY (catalog_version) REFERENCES catalog_version(version)
);

CREATE TABLE IF NOT EXISTS control (
  id              TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  framework       TEXT NOT NULL,
  ref             TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  verifies_json   TEXT NOT NULL,  -- JSON array of VerifiesEntry
  rationale       TEXT NOT NULL,
  PRIMARY KEY (id, catalog_version),
  FOREIGN KEY (catalog_version) REFERENCES catalog_version(version)
);

CREATE TABLE IF NOT EXISTS customer_scope (
  customer_id             TEXT PRIMARY KEY,
  facts_json              TEXT NOT NULL,  -- JSON object of ScopeFacts
  pinned_catalog_version  TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  FOREIGN KEY (pinned_catalog_version) REFERENCES catalog_version(version)
);
