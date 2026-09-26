CREATE TABLE IF NOT EXISTS games (
 id TEXT PRIMARY KEY,
 room_name TEXT NOT NULL,
 fetched_at TEXT NOT NULL,
 game_date TEXT,
 winner_side TEXT,
 raw_json TEXT,
 source_url TEXT
);
CREATE TABLE IF NOT EXISTS players (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 trip TEXT,
 UNIQUE(name, trip)
);
CREATE TABLE IF NOT EXISTS participations (
 game_id TEXT NOT NULL,
 player_id INTEGER NOT NULL,
 role TEXT,
 side TEXT,
 result TEXT,
 speech INTEGER DEFAULT 0,
 questions INTEGER DEFAULT 0,
 mentions INTEGER DEFAULT 0,
 PRIMARY KEY(game_id, player_id),
 FOREIGN KEY(game_id) REFERENCES games(id),
 FOREIGN KEY(player_id) REFERENCES players(id)
);
CREATE INDEX IF NOT EXISTS idx_part_player ON participations(player_id);
CREATE INDEX IF NOT EXISTS idx_game_date ON games(game_date);
