-- LQST Liquidity Strategy — Initial Schema
-- Tables: st_tokens, genesis_contributions, trades, lp_positions, buybacks

-- ST Tokens: one row per launched/collecting ST token
CREATE TABLE IF NOT EXISTS st_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Base token (the token being wrapped as ST)
  base_token_mint text,                          -- on-chain mint address (nullable until Solana integration)
  base_token_symbol text NOT NULL,               -- e.g. "PUMP"
  base_token_name text NOT NULL,                 -- e.g. "Pump"
  base_token_logo text,                          -- logo URL from CoinGecko/Pump.fun
  -- ST token details
  name text NOT NULL,                            -- e.g. "PUMPST"
  description text,                              -- empty initially; future: auto-fill from CoinGecko/Pump.fun
  creator_address text NOT NULL,                 -- Supabase user.id of the first contributor who created the pool
  total_supply bigint NOT NULL DEFAULT 1000000000,
  -- Genesis pool state
  genesis_sol_target numeric(18, 9) NOT NULL DEFAULT 10,
  genesis_sol_raised numeric(18, 9) NOT NULL DEFAULT 0,
  genesis_status text NOT NULL DEFAULT 'collecting'  -- collecting | launched | stable
    CHECK (genesis_status IN ('collecting', 'launched', 'stable')),
  launched_at timestamptz,                       -- set when genesis_status transitions to 'launched'
  created_at timestamptz DEFAULT now(),
  -- Enforce one ST per base token symbol (case-insensitive via lower())
  CONSTRAINT st_tokens_base_symbol_unique UNIQUE (base_token_symbol)
);

COMMENT ON TABLE st_tokens IS 'ST token registry. One row per base token, enforced by UNIQUE constraint on base_token_symbol.';

ALTER TABLE st_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read ST tokens (public explore page)
DROP POLICY IF EXISTS "st_tokens_read_all" ON st_tokens;
CREATE POLICY "st_tokens_read_all"
  ON st_tokens FOR SELECT USING (true);

-- Only authenticated users can insert
DROP POLICY IF EXISTS "st_tokens_insert_auth" ON st_tokens;
CREATE POLICY "st_tokens_insert_auth"
  ON st_tokens FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only the creator can update their token
DROP POLICY IF EXISTS "st_tokens_update_creator" ON st_tokens;
CREATE POLICY "st_tokens_update_creator"
  ON st_tokens FOR UPDATE USING (auth.uid()::text = creator_address);

-- Service role can update (for genesis launch transitions)
DROP POLICY IF EXISTS "st_tokens_update_service" ON st_tokens;
CREATE POLICY "st_tokens_update_service"
  ON st_tokens FOR UPDATE USING (auth.role() = 'service_role');

-- Genesis Contributions: SOL contributions to a genesis pool before launch
CREATE TABLE IF NOT EXISTS genesis_contributions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  st_token_id uuid NOT NULL REFERENCES st_tokens(id) ON DELETE CASCADE,
  contributor_address text NOT NULL,             -- Supabase user.id
  sol_amount numeric(18, 9) NOT NULL,
  token_allocation numeric(20, 4) DEFAULT 0,     -- calculated at launch (pro-rata share of 20% total)
  refunded_at timestamptz,                       -- null = active contribution; set = refunded
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE genesis_contributions IS 'Individual SOL contributions to genesis pools. Refunds set refunded_at; token_allocation filled at launch.';

ALTER TABLE genesis_contributions ENABLE ROW LEVEL SECURITY;

-- Users can read their own contributions
DROP POLICY IF EXISTS "genesis_contributions_read_own" ON genesis_contributions;
CREATE POLICY "genesis_contributions_read_own"
  ON genesis_contributions FOR SELECT USING (auth.uid()::text = contributor_address);

-- Authenticated users can insert contributions
DROP POLICY IF EXISTS "genesis_contributions_insert_auth" ON genesis_contributions;
CREATE POLICY "genesis_contributions_insert_auth"
  ON genesis_contributions FOR INSERT WITH CHECK (auth.uid()::text = contributor_address);

-- Users can update (refund) their own contributions
DROP POLICY IF EXISTS "genesis_contributions_update_own" ON genesis_contributions;
CREATE POLICY "genesis_contributions_update_own"
  ON genesis_contributions FOR UPDATE USING (auth.uid()::text = contributor_address);

-- Service role can update all (for launch token allocation)
DROP POLICY IF EXISTS "genesis_contributions_update_service" ON genesis_contributions;
CREATE POLICY "genesis_contributions_update_service"
  ON genesis_contributions FOR UPDATE USING (auth.role() = 'service_role');

-- Trades: buy/sell records during genesis and stable phases
CREATE TABLE IF NOT EXISTS trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  st_token_id uuid NOT NULL REFERENCES st_tokens(id) ON DELETE CASCADE,
  trader_address text NOT NULL,                  -- Supabase user.id
  direction text NOT NULL CHECK (direction IN ('buy', 'sell')),
  sol_amount numeric(18, 9) NOT NULL,
  token_amount numeric(20, 4) NOT NULL,
  tax_rate numeric(5, 2) NOT NULL,               -- e.g. 95.00 during genesis, 10.00 stable
  is_genesis_phase boolean NOT NULL DEFAULT false,
  fee_to_lp numeric(18, 9) NOT NULL DEFAULT 0,  -- SOL directed to LP
  fee_to_lqst numeric(18, 9) NOT NULL DEFAULT 0, -- SOL directed to LQST buyback
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE trades IS 'All buy/sell trade records. tax_rate captures the Decaying Tax at trade time.';

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Anyone can read trades (public transparency)
DROP POLICY IF EXISTS "trades_read_all" ON trades;
CREATE POLICY "trades_read_all"
  ON trades FOR SELECT USING (true);

-- Authenticated users can insert their own trades
DROP POLICY IF EXISTS "trades_insert_auth" ON trades;
CREATE POLICY "trades_insert_auth"
  ON trades FOR INSERT WITH CHECK (auth.uid()::text = trader_address);

-- LP Positions: protocol-owned ORCA LP positions (permanently locked)
CREATE TABLE IF NOT EXISTS lp_positions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  st_token_id uuid NOT NULL REFERENCES st_tokens(id) ON DELETE CASCADE,
  sol_amount numeric(18, 9) NOT NULL,            -- SOL in LP
  token_amount numeric(20, 4) NOT NULL,           -- ST tokens in LP
  lp_token_address text,                         -- ORCA LP token address (stub until real integration)
  is_locked boolean NOT NULL DEFAULT true,       -- always true for protocol-owned LP
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE lp_positions IS 'Protocol-owned LP positions created at genesis launch. is_locked=true always.';

ALTER TABLE lp_positions ENABLE ROW LEVEL SECURITY;

-- Anyone can read LP positions (public treasury transparency)
DROP POLICY IF EXISTS "lp_positions_read_all" ON lp_positions;
CREATE POLICY "lp_positions_read_all"
  ON lp_positions FOR SELECT USING (true);

-- Only service role can insert/update LP positions
DROP POLICY IF EXISTS "lp_positions_insert_service" ON lp_positions;
CREATE POLICY "lp_positions_insert_service"
  ON lp_positions FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "lp_positions_update_service" ON lp_positions;
CREATE POLICY "lp_positions_update_service"
  ON lp_positions FOR UPDATE USING (auth.role() = 'service_role');

-- Buybacks: LQST and ST token buyback records
CREATE TABLE IF NOT EXISTS buybacks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_token text NOT NULL,                    -- "LQST" or the ST token symbol (e.g. "PUMPST")
  sol_spent numeric(18, 9) NOT NULL,
  tokens_bought numeric(20, 4) NOT NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE buybacks IS 'Buyback records. target_token="LQST" for platform token buybacks; ST symbol for per-token buybacks.';

ALTER TABLE buybacks ENABLE ROW LEVEL SECURITY;

-- Anyone can read buybacks (public revenue transparency)
DROP POLICY IF EXISTS "buybacks_read_all" ON buybacks;
CREATE POLICY "buybacks_read_all"
  ON buybacks FOR SELECT USING (true);

-- Only service role can insert buybacks
DROP POLICY IF EXISTS "buybacks_insert_service" ON buybacks;
CREATE POLICY "buybacks_insert_service"
  ON buybacks FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_st_tokens_symbol ON st_tokens (lower(base_token_symbol));
CREATE INDEX IF NOT EXISTS idx_st_tokens_status ON st_tokens (genesis_status);
CREATE INDEX IF NOT EXISTS idx_genesis_contributions_token ON genesis_contributions (st_token_id);
CREATE INDEX IF NOT EXISTS idx_genesis_contributions_contributor ON genesis_contributions (contributor_address);
CREATE INDEX IF NOT EXISTS idx_trades_token ON trades (st_token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lp_positions_token ON lp_positions (st_token_id);
CREATE INDEX IF NOT EXISTS idx_buybacks_target ON buybacks (target_token, created_at DESC);
