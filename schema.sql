-- SmartShop AI — D1 Database Schema
-- Run: wrangler d1 execute smartshop-users --file=schema.sql

-- Core user identity. Email is unique identifier.
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  gender         TEXT DEFAULT '',
  age            TEXT DEFAULT '',
  skin           TEXT DEFAULT '',
  hair           TEXT DEFAULT '',
  interests      TEXT DEFAULT '[]',
  budget         TEXT DEFAULT 'moderate',
  session_token  TEXT DEFAULT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Saved/favorited products
CREATE TABLE IF NOT EXISTS saved_products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL,
  product_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);

-- Purchase history
CREATE TABLE IF NOT EXISTS purchases (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL,
  product_json TEXT NOT NULL,
  retailer     TEXT DEFAULT '',
  purchased_at TEXT NOT NULL,
  UNIQUE(user_id, product_id, purchased_at)
);

-- Search history
CREATE TABLE IF NOT EXISTS search_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query       TEXT NOT NULL,
  searched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id);

-- Chat thread metadata
CREATE TABLE IF NOT EXISTS threads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_cid  TEXT NOT NULL,
  name        TEXT DEFAULT 'New Chat',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, thread_cid)
);

-- Chat thread message data (JSON blob per thread)
CREATE TABLE IF NOT EXISTS thread_data (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_cid  TEXT NOT NULL,
  data_json   TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, thread_cid)
);

-- SerpAPI search result cache (24-hour TTL)
CREATE TABLE IF NOT EXISTS search_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash   TEXT NOT NULL UNIQUE,
  query_text   TEXT NOT NULL,
  results_json TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_search_cache_hash ON search_cache(query_hash);

-- SerpAPI product detail cache (7-day TTL)
CREATE TABLE IF NOT EXISTS product_details_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   TEXT NOT NULL UNIQUE,
  details_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SerpAPI daily usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  api_name   TEXT NOT NULL DEFAULT 'serpapi',
  date_key   TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(api_name, date_key)
);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(api_name, date_key);

-- Recently viewed products
CREATE TABLE IF NOT EXISTS viewed_products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL,
  product_json TEXT NOT NULL,
  viewed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);
