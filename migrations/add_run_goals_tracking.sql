-- Migration: Add Run Goals Tracking
-- Description: Add targetDistance, targetTime, wasTargetAchieved to runs table
-- Date: February 1, 2026
-- Database: Neon.com PostgreSQL
-- Usage: Run this in Neon SQL Editor or via psql

-- =====================================================
-- STEP 1: Add the 3 new columns to runs table
-- =====================================================

ALTER TABLE runs
ADD COLUMN IF NOT EXISTS target_distance REAL NULL,
ADD COLUMN IF NOT EXISTS target_time BIGINT NULL,
ADD COLUMN IF NOT EXISTS was_target_achieved BOOLEAN NULL;

-- =====================================================
-- STEP 2: Add index for performance (optional but recommended)
-- =====================================================

-- Index for "runs with targets" queries
CREATE INDEX IF NOT EXISTS idx_runs_target_distance
ON runs(target_distance)
WHERE target_distance IS NOT NULL;

-- =====================================================
-- STEP 3: Add documentation comments
-- =====================================================

COMMENT ON COLUMN runs.target_distance IS 'User-defined target distance for the run (in kilometers)';
COMMENT ON COLUMN runs.target_time IS 'User-defined target time for the run (in milliseconds)';
COMMENT ON COLUMN runs.was_target_achieved IS 'Whether the user achieved their target goals (distance/time)';

-- =====================================================
-- VERIFICATION QUERIES (run these to confirm it worked)
-- =====================================================

-- Check if columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'runs'
  AND column_name IN ('target_distance', 'target_time', 'was_target_achieved');

-- Check if index exists
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename = 'runs'
  AND indexname = 'idx_runs_target_distance';

-- =====================================================
-- Summary
-- =====================================================
-- This migration adds support for tracking user goals:
-- - targetDistance: Stores user's planned distance goal (e.g., 10.0 for 10km run)
-- - targetTime: Stores user's planned time goal (e.g., 300000 for 50 minutes in ms)
-- - wasTargetAchieved: Boolean flag showing if user met their target
--
-- Use Cases:
-- - "Target vs Actual" comparisons in UI
-- - Performance analysis over time
-- - Better personalized AI coaching
-- - Trend analysis of goal setting vs achievement rate
--
-- Safety Notes:
-- - ADD COLUMN IF NOT EXISTS ensures this won't break if run multiple times
-- - NULL values are allowed - existing runs won't be affected
-- - No data loss or modification of existing records
-- - Safe to run at any time
--
-- Next Steps:
-- 1. Run this migration in Neon SQL Editor
-- 2. Restart your backend server
-- 3. Test with Android app by running a run with goals