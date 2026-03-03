import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const bodySchema = z.object({
  walletAddress: z.string().min(32).max(44),
  symbol: z.string().min(1).max(20),
  tokenName: z.string().min(1).max(100),
  tokenLogo: z.string().url().optional(),
  solAmount: z.number().positive().max(100),
});

const GENESIS_SOL_TARGET = 10;
const TOTAL_SUPPLY = 1_000_000_000;
const CREATOR_ALLOCATION_PCT = 0.2; // 20% to genesis contributors

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const parse = bodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 });
    }

    const { walletAddress, symbol, tokenName, tokenLogo, solAmount } = parse.data;
    const symbolUpper = symbol.toUpperCase();
    const stName = `${symbolUpper}ST`;

    // Upsert st_token — UNIQUE on base_token_symbol enforced by DB
    const { data: existingToken } = await supabase
      .from("st_tokens")
      .select("id, genesis_status, genesis_sol_raised, genesis_sol_target")
      .ilike("base_token_symbol", symbolUpper)
      .single();

    let tokenId: string;

    if (existingToken) {
      if (existingToken.genesis_status !== "collecting") {
        return NextResponse.json(
          { error: "This token has already launched. Trading is open on the token page." },
          { status: 400 }
        );
      }
      tokenId = existingToken.id;
    } else {
      // Create new genesis pool
      const { data: newToken, error: createError } = await supabase
        .from("st_tokens")
        .insert({
          base_token_symbol: symbolUpper,
          base_token_name: tokenName,
          base_token_logo: tokenLogo ?? null,
          name: stName,
          description: null, // TODO: auto-fill from CoinGecko/Pump.fun in future
          creator_address: walletAddress,
          total_supply: TOTAL_SUPPLY,
          genesis_sol_target: GENESIS_SOL_TARGET,
          genesis_sol_raised: 0,
          genesis_status: "collecting",
        })
        .select("id")
        .single();

      if (createError) {
        if (createError.code === "23505") {
          return NextResponse.json(
            { error: "A genesis pool for this token was just created by someone else. Refresh to see it." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      tokenId = newToken!.id;
    }

    // Record contribution
    const { error: contribError } = await supabase
      .from("genesis_contributions")
      .insert({
        st_token_id: tokenId,
        contributor_address: walletAddress,
        sol_amount: solAmount,
        token_allocation: 0, // calculated at launch
      });

    if (contribError) {
      return NextResponse.json({ error: contribError.message }, { status: 500 });
    }

    // Update raised amount
    const { data: updatedToken, error: updateError } = await supabase.rpc(
      "increment_genesis_sol",
      { token_id: tokenId, amount: solAmount }
    );

    if (updateError) {
      // Fallback: manual update
      const { data: current } = await supabase
        .from("st_tokens")
        .select("genesis_sol_raised")
        .eq("id", tokenId)
        .single();
      const newRaised = (current?.genesis_sol_raised ?? 0) + solAmount;
      await supabase
        .from("st_tokens")
        .update({ genesis_sol_raised: newRaised })
        .eq("id", tokenId);
    }

    // Check if target reached → launch
    const { data: currentToken } = await supabase
      .from("st_tokens")
      .select("genesis_sol_raised, genesis_sol_target, genesis_status")
      .eq("id", tokenId)
      .single();

    if (
      currentToken &&
      currentToken.genesis_status === "collecting" &&
      currentToken.genesis_sol_raised >= currentToken.genesis_sol_target
    ) {
      // Launch: create LP position + distribute tokens
      const now = new Date().toISOString();
      await supabase
        .from("st_tokens")
        .update({ genesis_status: "launched", launched_at: now })
        .eq("id", tokenId);

      // Launch sequence (stub — no real Solana/ORCA calls):
      // Step 1: Use 10 SOL to buy BASE_TOKEN on-market (e.g., buy PUMP via Raydium/ORCA)
      // Step 2: Pair purchased BASE_TOKEN + 800M ST tokens → permanent ORCA LP
      // In production: call ORCA SDK to swap SOL→BASE_TOKEN, then addLiquidity(BASE_TOKEN, ST)
      const baseTokenAmountStub = GENESIS_SOL_TARGET * 1000; // stub: 1 SOL = 1000 base token units

      await supabase.from("lp_positions").insert({
        st_token_id: tokenId,
        base_token_amount: baseTokenAmountStub,                      // BASE_TOKEN side of LP (e.g., PUMP)
        token_amount: TOTAL_SUPPLY * (1 - CREATOR_ALLOCATION_PCT),  // 800M ST tokens (other side)
        lp_token_address: `stub_lp_${tokenId}`,                     // placeholder — replace with ORCA LP address
        is_locked: true,
      });

      // Calculate and assign token allocations to contributors
      const { data: contributions } = await supabase
        .from("genesis_contributions")
        .select("id, contributor_address, sol_amount")
        .eq("st_token_id", tokenId)
        .is("refunded_at", null);

      const totalContributed = (contributions ?? []).reduce((s, c) => s + c.sol_amount, 0);
      const totalCreatorTokens = TOTAL_SUPPLY * CREATOR_ALLOCATION_PCT; // 200M

      for (const contrib of contributions ?? []) {
        const allocation = (contrib.sol_amount / totalContributed) * totalCreatorTokens;
        await supabase
          .from("genesis_contributions")
          .update({ token_allocation: allocation })
          .eq("id", contrib.id);
      }
    }

    // Return updated pool state
    const { data: finalToken } = await supabase
      .from("st_tokens")
      .select("id, name, genesis_status, genesis_sol_raised, genesis_sol_target")
      .eq("id", tokenId)
      .single();

    const { data: myContrib } = await supabase
      .from("genesis_contributions")
      .select("sol_amount")
      .eq("st_token_id", tokenId)
      .eq("contributor_address", walletAddress)
      .is("refunded_at", null);

    const myTotal = (myContrib ?? []).reduce((s, c) => s + c.sol_amount, 0);

    return NextResponse.json({
      pool: {
        id: finalToken!.id,
        stName: finalToken!.name,
        genesisStatus: finalToken!.genesis_status,
        genesisSOLRaised: finalToken!.genesis_sol_raised,
        genesisSOLTarget: finalToken!.genesis_sol_target,
        myContribution: myTotal,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
