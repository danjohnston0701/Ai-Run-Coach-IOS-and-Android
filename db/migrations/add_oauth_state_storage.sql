-- Add OAuth state storage table for PKCE verifiers
-- This prevents loss of verifiers when server restarts

CREATE TABLE IF NOT EXISTS oauth_state (
  nonce VARCHAR(255) PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_oauth_state_created_at ON oauth_state(created_at);

-- Cleanup old entries (older than 15 minutes) on creation
DELETE FROM oauth_state WHERE created_at < NOW() - INTERVAL '15 minutes';
