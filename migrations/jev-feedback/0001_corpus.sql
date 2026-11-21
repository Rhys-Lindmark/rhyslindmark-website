-- The Jev feedback corpus, searchable from /jev/feedback/ behind the /jev login.
-- Filled by feedback/upload_d1.py in the private jev repo (daily, changed rows only).
-- Label columns are Jev's probabilities from labeling/questions.py (question version q1);
-- NULL means the item was not labeled (bots, title-only items, or not reached yet).
CREATE TABLE IF NOT EXISTS items (
	rid INTEGER PRIMARY KEY,
	id TEXT NOT NULL UNIQUE,
	source TEXT NOT NULL,
	kind TEXT NOT NULL,
	url TEXT,
	title TEXT,
	author TEXT,
	created_at TEXT,
	text TEXT,
	h TEXT,
	about_jev REAL, author_builds_with_jev REAL, in_production REAL,
	segment TEXT, segment_p REAL, sentiment REAL,
	use_classify REAL, use_route REAL, use_rank_score REAL, use_eval_judge REAL, use_agent_control REAL,
	love_typed REAL, love_speed REAL, love_price REAL,
	pain_wrong_answers REAL, pain_question_design REAL, pain_trust REAL, pain_unclear_use REAL,
	pain_closed_hosted REAL, pain_sdk_api REAL, pain_limits REAL
);
CREATE INDEX IF NOT EXISTS items_created ON items (created_at);
CREATE INDEX IF NOT EXISTS items_source_kind ON items (source, kind, created_at);

-- Full-text index over title, text and author, kept in step with items by triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
	title, text, author, content='items', content_rowid='rid', tokenize='porter unicode61'
);
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
	INSERT INTO items_fts (rowid, title, text, author) VALUES (new.rid, new.title, new.text, new.author);
END;
CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
	INSERT INTO items_fts (items_fts, rowid, title, text, author) VALUES ('delete', old.rid, old.title, old.text, old.author);
END;
CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE OF title, text, author ON items BEGIN
	INSERT INTO items_fts (items_fts, rowid, title, text, author) VALUES ('delete', old.rid, old.title, old.text, old.author);
	INSERT INTO items_fts (rowid, title, text, author) VALUES (new.rid, new.title, new.text, new.author);
END;

-- One row: when the corpus was last uploaded and how big it is.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
