-- Create goals table if it doesn't exist
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'distance', 'time', 'pace', 'event', 'health', 'frequency'
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  target_date DATE,
  event_name TEXT,
  event_location TEXT,
  distance_target DECIMAL(10, 2),
  time_target_seconds INTEGER,
  health_target TEXT,
  weekly_run_target INTEGER,
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'abandoned'
  progress_percent INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);

-- Add comments
COMMENT ON TABLE goals IS 'User running goals and targets';
COMMENT ON COLUMN goals.type IS 'Goal type: distance, time, pace, event, health, or frequency';
COMMENT ON COLUMN goals.status IS 'Goal status: active, completed, or abandoned';
COMMENT ON COLUMN goals.progress_percent IS 'Progress towards goal completion (0-100)';
