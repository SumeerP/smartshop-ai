-- Phase 3: SerpAPI cache tables

CREATE TABLE IF NOT EXISTS search_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash   TEXT NOT NULL UNIQUE,
  query_text   TEXT NOT NULL,
  results_json TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash);

CREATE TABLE IF NOT EXISTS product_details_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   TEXT NOT NULL UNIQUE,
  details_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_usage (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  api_name   TEXT NOT NULL DEFAULT 'serpapi',
  date_key   TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(api_name, date_key)
);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(api_name, date_key);
