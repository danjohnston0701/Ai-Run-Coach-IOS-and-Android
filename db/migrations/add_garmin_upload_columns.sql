-- Add columns to track Garmin upload status for AI Run Coach runs
-- This allows two-way sync: READ from Garmin + WRITE to Garmin

ALTER TABLE runs 
ADD COLUMN IF NOT EXISTS uploaded_to_garmin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS garmin_activity_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_runs_uploaded_to_garmin ON runs(uploaded_to_garmin);
CREATE INDEX IF NOT EXISTS idx_runs_garmin_activity_id ON runs(garmin_activity_id);

-- Add comments for clarity
COMMENT ON COLUMN runs.uploaded_to_garmin IS 'TRUE if this AI Run Coach run was uploaded to Garmin Connect';
COMMENT ON COLUMN runs.garmin_activity_id IS 'Garmin Connect activity ID if uploaded (for linking)';
