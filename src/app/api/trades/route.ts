import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const bodySchema = z.object({
  stTokenId: z.string().uuid(),
  direction: z.enum(["buy", "sell"]),
  solAmount: z.number().positive().max(10_000).optional(),
  tokenAmount: z.number().positive().max(1_000_000_000).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parse = bodySchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 });
    }

    const { stTokenId, direction, solAmount, tokenAmount } = parse.data;

    if (direction === "buy" && !solAmount) {
      return NextResponse.json({ error: "solAmount required for buy" }, { status: 400 });
    }
    if (direction === "sell" && !tokenAmount) {
      return NextResponse.json({ error: "tokenAmount required for sell" }, { status: 400 });
    }

    // Get token details
    const { data: token, error: tokenError } = await supabase
      .from("st_tokens")
      .select("id, genesis_status, launched_at, genesis_sol_target")
      .eq("id", stTokenId)
      .single();

    if (tokenError || !token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    if (token.genesis_status === "collecting") {
      return NextResponse.json(
        { error: "Token has not launched yet. Join the genesis pool to participate." },
        { status: 400 }
      );
    }

    // Calculate tax rate
    let taxRate = 10;
    let isGenesisPhase = false;

    if (token.genesis_status === "launched" && token.launched_at) {
      const minutesSinceLaunch = Math.floor(
        (Date.now() - new Date(token.launched_at).getTime()) / 60_000
      );
      if (minutesSinceLaunch < 85) {
        taxRate = Math.max(10, 95 - minutesSinceLaunch);
        isGenesisPhase = true;
      } else {
        // Auto-transition to stable
        await supabase
          .from("st_tokens")
          .update({ genesis_status: "stable" })
          .eq("id", stTokenId);
      }
    }

    // Calculate fees
    const tradeSOL = solAmount ?? (tokenAmount ?? 0) * 0.00000001; // stub conversion
    const taxAmount = tradeSOL * (taxRate / 100);
    const feeToLp = isGenesisPhase ? taxAmount : taxAmount * 0.8; // 8% in stable
    const feeToLqst = isGenesisPhase ? 0 : taxAmount * 0.2; // 2% in stable

    // Record trade (stub — no real on-chain execution)
    const { data: trade, error: tradeError } = await supabase
      .from("trades")
      .insert({
        st_token_id: stTokenId,
        trader_address: user.id,
        direction,
        sol_amount: tradeSOL,
        token_amount: tokenAmount ?? tradeSOL / 0.00000001,
        tax_rate: taxRate,
        is_genesis_phase: isGenesisPhase,
        fee_to_lp: feeToLp,
        fee_to_lqst: feeToLqst,
      })
      .select("id")
      .single();

    if (tradeError) {
      return NextResponse.json({ error: tradeError.message }, { status: 500 });
    }

    // Add fees to LP position (simplified stub)
    if (feeToLp > 0) {
      const { data: lp } = await supabase
        .from("lp_positions")
        .select("id, sol_amount")
        .eq("st_token_id", stTokenId)
        .single();

      if (lp) {
        await supabase
          .from("lp_positions")
          .update({ sol_amount: lp.sol_amount + feeToLp })
          .eq("id", lp.id);
      }
    }

    // Record LQST buyback if stable phase
    if (feeToLqst > 0) {
      await supabase.from("buybacks").insert({
        target_token: "LQST",
        sol_spent: feeToLqst,
        tokens_bought: feeToLqst / 0.001, // stub conversion rate
      });
    }

    return NextResponse.json({
      tradeId: trade!.id,
      direction,
      solAmount: tradeSOL,
      taxRate,
      feeToLp,
      feeToLqst,
      isGenesisPhase,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
