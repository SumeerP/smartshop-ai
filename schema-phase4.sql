-- SmartShop AI — Phase 2+4 Schema Migration
-- Reddit cache + Price tracking
-- Run: wrangler d1 execute smartshop-users --file=schema-phase4.sql

-- Phase 2: Reddit discussion cache (48h TTL enforced in application)
CREATE TABLE IF NOT EXISTS reddit_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash   TEXT NOT NULL UNIQUE,
  query_text   TEXT NOT NULL,
  results_json TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reddit_cache_hash ON reddit_cache(query_hash);

-- Phase 4: Price history tracking
CREATE TABLE IF NOT EXISTS price_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_key  TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price        REAL NOT NULL,
  retailer     TEXT NOT NULL DEFAULT '',
  observed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_price_product ON price_history(product_key);
CREATE INDEX IF NOT EXISTS idx_price_date ON price_history(observed_at);
