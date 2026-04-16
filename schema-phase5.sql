-- SmartShop AI — Phase 5 Schema Migration
-- Ingredient/Spec decoder cache
-- Run: wrangler d1 execute smartshop-users --file=schema-phase5.sql

CREATE TABLE IF NOT EXISTS decode_cache (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key    TEXT NOT NULL UNIQUE,
  decode_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_decode_cache_key ON decode_cache(cache_key);
