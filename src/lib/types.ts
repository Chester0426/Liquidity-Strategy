// TypeScript types matching the database schema in supabase/migrations/001_initial.sql

export type GenesisStatus = "collecting" | "launched" | "stable";
export type TradeDirection = "buy" | "sell";

export interface STToken {
  id: string;
  base_token_mint: string | null;
  base_token_symbol: string;
  base_token_name: string;
  base_token_logo: string | null;
  name: string; // {SYMBOL}ST
  description: string | null;
  creator_address: string;
  total_supply: number; // 1,000,000,000
  genesis_sol_target: number; // 10
  genesis_sol_raised: number;
  genesis_status: GenesisStatus;
  launched_at: string | null;
  created_at: string;
}

export interface GenesisContribution {
  id: string;
  st_token_id: string;
  contributor_address: string;
  sol_amount: number;
  token_allocation: number; // calculated at launch
  refunded_at: string | null;
  created_at: string;
}

export interface Trade {
  id: string;
  st_token_id: string;
  trader_address: string;
  direction: TradeDirection;
  sol_amount: number;
  token_amount: number;
  tax_rate: number;
  is_genesis_phase: boolean;
  fee_to_lp: number;
  fee_to_lqst: number;
  created_at: string;
}

export interface LPPosition {
  id: string;
  st_token_id: string;
  /** Amount of base token (e.g., PUMP) purchased with genesis SOL and paired into LP */
  base_token_amount: number;
  /** Amount of ST tokens (e.g., PUMPST) paired into LP — 80% of total supply */
  token_amount: number;
  lp_token_address: string | null;
  is_locked: boolean;
  created_at: string;
}

export interface Buyback {
  id: string;
  target_token: string; // "LQST" or ST token symbol
  sol_spent: number;
  tokens_bought: number;
  created_at: string;
}
