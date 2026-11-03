-- Nuottitreeni sync store. Holds practice statistics only (see docs/privacy-design.md).
-- Codes are stored as SHA-256 hashes; the rate-limit salt is generated here so a deploy
-- needs no secret.

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

INSERT INTO meta (key, value) VALUES ('rate_salt', lower(hex(randomblob(32))));

CREATE TABLE sync_records (
  code_hash TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  rev INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accessed_at INTEGER NOT NULL
) STRICT;

CREATE INDEX sync_records_accessed ON sync_records (accessed_at);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
) STRICT;
