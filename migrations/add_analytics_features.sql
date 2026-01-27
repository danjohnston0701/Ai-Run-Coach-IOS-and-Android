-- Migration: Add Analytics Features (Fitness & Freshness, Segments, Training Plans, Social Feed)
-- Created: 2026-01-27

-- 1. ADD NEW COLUMNS TO RUNS TABLE
ALTER TABLE runs ADD COLUMN IF NOT EXISTS tss INTEGER DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS gap VARCHAR;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS struggle_points JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS km_splits JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS min_heart_rate INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS terrain_type TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS user_comments TEXT;

-- 2. CREATE DAILY_FITNESS TABLE
CREATE TABLE IF NOT EXISTS daily_fitness (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  ctl REAL NOT NULL,
  atl REAL NOT NULL,
  tsb REAL NOT NULL,
  training_load INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  ramp_rate REAL,
  injury_risk TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_fitness_user_date ON daily_fitness(user_id, date);

-- 3. CREATE/UPDATE SEGMENTS TABLE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'segments') THEN
    CREATE TABLE segments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      start_lat REAL NOT NULL,
      start_lng REAL NOT NULL,
      end_lat REAL NOT NULL,
      end_lng REAL NOT NULL,
      polyline TEXT NOT NULL,
      distance REAL NOT NULL,
      elevation_gain REAL,
      elevation_loss REAL,
      avg_gradient REAL,
      max_gradient REAL,
      terrain_type TEXT,
      city TEXT,
      country TEXT,
      category TEXT DEFAULT 'community',
      effort_count INTEGER DEFAULT 0,
      star_count INTEGER DEFAULT 0,
      created_by_user_id VARCHAR REFERENCES users(id),
      is_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
END $$;

-- Add missing columns if table exists
ALTER TABLE segments ADD COLUMN IF NOT EXISTS avg_gradient REAL;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS max_gradient REAL;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS terrain_type TEXT;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'community';
ALTER TABLE segments ADD COLUMN IF NOT EXISTS effort_count INTEGER DEFAULT 0;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS star_count INTEGER DEFAULT 0;
ALTER TABLE segments ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR REFERENCES users(id);
ALTER TABLE segments ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_segments_location ON segments(start_lat, start_lng);
CREATE INDEX IF NOT EXISTS idx_segments_popularity ON segments(effort_count DESC);

-- 4. CREATE SEGMENT_EFFORTS TABLE
CREATE TABLE IF NOT EXISTS segment_efforts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id VARCHAR NOT NULL REFERENCES segments(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  run_id VARCHAR NOT NULL REFERENCES runs(id),
  elapsed_time INTEGER NOT NULL,
  moving_time INTEGER,
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_cadence INTEGER,
  avg_power INTEGER,
  is_personal_record BOOLEAN DEFAULT false,
  leaderboard_rank INTEGER,
  yearly_rank INTEGER,
  monthly_rank INTEGER,
  achievement_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segment_efforts_segment ON segment_efforts(segment_id, elapsed_time);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_user ON segment_efforts(user_id, segment_id);

-- 5. CREATE SEGMENT_STARS TABLE
CREATE TABLE IF NOT EXISTS segment_stars (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id VARCHAR NOT NULL REFERENCES segments(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(segment_id, user_id)
);

-- 6. CREATE TRAINING_PLANS TABLE
CREATE TABLE IF NOT EXISTS training_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  goal_type TEXT NOT NULL,
  target_distance REAL,
  target_time INTEGER,
  target_date TIMESTAMP,
  current_week INTEGER DEFAULT 1,
  total_weeks INTEGER NOT NULL,
  experience_level TEXT NOT NULL,
  weekly_mileage_base REAL,
  days_per_week INTEGER DEFAULT 4,
  include_speed_work BOOLEAN DEFAULT true,
  include_hill_work BOOLEAN DEFAULT true,
  include_long_runs BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active',
  ai_generated BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id, status);

-- 7. CREATE WEEKLY_PLANS TABLE
CREATE TABLE IF NOT EXISTS weekly_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id VARCHAR NOT NULL REFERENCES training_plans(id),
  week_number INTEGER NOT NULL,
  week_description TEXT,
  total_distance REAL,
  total_duration INTEGER,
  focus_area TEXT,
  intensity_level TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. CREATE PLANNED_WORKOUTS TABLE
CREATE TABLE IF NOT EXISTS planned_workouts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id VARCHAR NOT NULL REFERENCES weekly_plans(id),
  training_plan_id VARCHAR NOT NULL REFERENCES training_plans(id),
  day_of_week INTEGER NOT NULL,
  scheduled_date TIMESTAMP,
  workout_type TEXT NOT NULL,
  distance REAL,
  duration INTEGER,
  target_pace TEXT,
  intensity TEXT,
  description TEXT,
  instructions TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_run_id VARCHAR REFERENCES runs(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. CREATE PLAN_ADAPTATIONS TABLE
CREATE TABLE IF NOT EXISTS plan_adaptations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id VARCHAR NOT NULL REFERENCES training_plans(id),
  adaptation_date TIMESTAMP DEFAULT NOW(),
  reason TEXT NOT NULL,
  changes JSONB,
  ai_suggestion TEXT,
  user_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. CREATE FEED_ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS feed_activities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  run_id VARCHAR REFERENCES runs(id),
  goal_id VARCHAR REFERENCES goals(id),
  achievement_id VARCHAR,
  activity_type TEXT NOT NULL,
  content TEXT,
  visibility TEXT DEFAULT 'friends',
  reaction_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_activities_user ON feed_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_activities_visibility ON feed_activities(visibility, created_at DESC);

-- 11. CREATE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS reactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id VARCHAR NOT NULL REFERENCES feed_activities(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- 12. CREATE ACTIVITY_COMMENTS TABLE
CREATE TABLE IF NOT EXISTS activity_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id VARCHAR NOT NULL REFERENCES feed_activities(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. CREATE COMMENT_LIKES TABLE
CREATE TABLE IF NOT EXISTS comment_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR NOT NULL REFERENCES activity_comments(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 14. CREATE CLUBS TABLE
CREATE TABLE IF NOT EXISTS clubs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  club_picture TEXT,
  is_public BOOLEAN DEFAULT true,
  member_count INTEGER DEFAULT 0,
  created_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  city TEXT,
  country TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. CREATE CLUB_MEMBERSHIPS TABLE
CREATE TABLE IF NOT EXISTS club_memberships (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id VARCHAR NOT NULL REFERENCES clubs(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- 16. CREATE CHALLENGES TABLE
CREATE TABLE IF NOT EXISTS challenges (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL,
  target_value REAL NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_public BOOLEAN DEFAULT true,
  participant_count INTEGER DEFAULT 0,
  created_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  badge_image TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. CREATE CHALLENGE_PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS challenge_participants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id VARCHAR NOT NULL REFERENCES challenges(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  current_progress REAL DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  rank INTEGER,
  joined_at TIMESTAMP DEFAULT NOW()
);

-- 18. CREATE ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  badge_image TEXT,
  requirement JSONB,
  rarity TEXT DEFAULT 'common',
  points INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 19. CREATE USER_ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS user_achievements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  achievement_id VARCHAR NOT NULL REFERENCES achievements(id),
  run_id VARCHAR REFERENCES runs(id),
  earned_at TIMESTAMP DEFAULT NOW(),
  notification_sent BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, earned_at DESC);

-- Migration complete!
