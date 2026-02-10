-- Add external ID and source tracking columns to runs table
-- This allows us to track which activities came from Garmin, Strava, etc.
-- and prevent duplicate imports

ALTER TABLE runs 
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

-- Create index for faster lookups when checking for duplicates
CREATE INDEX IF NOT EXISTS idx_runs_external_id ON runs(external_id, external_source);

-- Add comment for documentation
COMMENT ON COLUMN runs.external_id IS 'External activity ID from connected service (e.g., Garmin activity ID)';
COMMENT ON COLUMN runs.external_source IS 'Source of external activity (garmin, strava, coros, etc.)';
