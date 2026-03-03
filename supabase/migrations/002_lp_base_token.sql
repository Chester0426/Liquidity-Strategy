-- Migration 002: Fix lp_positions schema
-- LP is now BASE_TOKEN/ST (not SOL/ST).
-- Rename sol_amount → base_token_amount to reflect that genesis SOL is used
-- to purchase the base token before LP creation.

ALTER TABLE lp_positions
  RENAME COLUMN sol_amount TO base_token_amount;

COMMENT ON COLUMN lp_positions.base_token_amount IS
  'Amount of base token (e.g., PUMP) purchased with genesis SOL and paired into LP';
