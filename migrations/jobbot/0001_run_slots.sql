CREATE TABLE IF NOT EXISTS run_slots (
  id INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  client_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS run_slots_day_client ON run_slots(day, client_key);
