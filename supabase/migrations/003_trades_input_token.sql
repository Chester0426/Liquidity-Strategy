-- Add input_token column to trades for routing analytics
ALTER TABLE trades ADD COLUMN IF NOT EXISTS input_token text;
