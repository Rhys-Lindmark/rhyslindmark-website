CREATE TABLE IF NOT EXISTS jev_budget (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reserved_micros INTEGER NOT NULL DEFAULT 0 CHECK (reserved_micros BETWEEN 0 AND 20000000),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1))
);
INSERT OR IGNORE INTO jev_budget(id,reserved_micros,enabled) VALUES(1,0,1);
CREATE TABLE IF NOT EXISTS jev_limits (
  bucket TEXT PRIMARY KEY,
  uses INTEGER NOT NULL CHECK(uses > 0),
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jev_limits_expiry ON jev_limits(expires);
CREATE TABLE IF NOT EXISTS jev_credentials (
  id INTEGER PRIMARY KEY CHECK(id=1),
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL
);
