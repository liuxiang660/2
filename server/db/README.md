-- Database Migration Script
-- Run this script in Supabase SQL Editor to create the schema

-- First, enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Then run the schema.sql file content to create all tables
-- You can copy the content from schema.sql and execute it here

-- Optional: load demo data for validation
-- Run file: db/migrations/20260329_seed_demo_full.sql
-- This seed script is idempotent for most tables and safe to re-run.
