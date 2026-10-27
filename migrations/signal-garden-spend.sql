CREATE TABLE IF NOT EXISTS signal_garden_spend (
  request_id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS signal_garden_spend_client_day ON signal_garden_spend(client_hash, day);
