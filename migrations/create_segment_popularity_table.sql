-- Create segment_popularity table for OSM route intelligence
-- This table tracks which road segments are popular for running

CREATE TABLE IF NOT EXISTS segment_popularity (
  id SERIAL PRIMARY KEY,
  osm_way_id BIGINT NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  avg_rating DECIMAL(3, 2) DEFAULT NULL,
  last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups by osm_way_id
CREATE INDEX IF NOT EXISTS idx_segment_popularity_osm_way_id 
ON segment_popularity(osm_way_id);

-- Create index for finding popular segments
CREATE INDEX IF NOT EXISTS idx_segment_popularity_run_count 
ON segment_popularity(run_count DESC);

-- Create index for recently used segments
CREATE INDEX IF NOT EXISTS idx_segment_popularity_last_used 
ON segment_popularity(last_used DESC);

-- Add comment to table
COMMENT ON TABLE segment_popularity IS 'Tracks popularity of OpenStreetMap road segments for intelligent route generation';
COMMENT ON COLUMN segment_popularity.osm_way_id IS 'OpenStreetMap way ID (unique identifier for road segment)';
COMMENT ON COLUMN segment_popularity.run_count IS 'Total number of runs that used this segment';
COMMENT ON COLUMN segment_popularity.unique_users IS 'Number of unique users who ran on this segment';
COMMENT ON COLUMN segment_popularity.avg_rating IS 'Average user rating for this segment (1.0-5.0)';
COMMENT ON COLUMN segment_popularity.last_used IS 'Timestamp of last run using this segment';
