import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();

    const [{ data: trades }, { data: buybacks }] = await Promise.all([
      supabase
        .from("trades")
        .select("sol_amount, fee_to_lp, fee_to_lqst, direction, is_genesis_phase, tax_rate, created_at, st_token_id")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("buybacks")
        .select("id, target_token, sol_spent, tokens_bought, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const allTrades = trades ?? [];
    const allBuybacks = buybacks ?? [];

    const totalFeesCollected = allTrades.reduce((s, t) => s + (t.fee_to_lp ?? 0) + (t.fee_to_lqst ?? 0), 0);
    const lqstBuybacks = allBuybacks
      .filter((b) => b.target_token === "LQST")
      .reduce((s, b) => s + (b.sol_spent ?? 0), 0);
    const stBuybacks = allBuybacks
      .filter((b) => b.target_token !== "LQST")
      .reduce((s, b) => s + (b.sol_spent ?? 0), 0);
    const totalVolume = allTrades.reduce((s, t) => s + (t.sol_amount ?? 0), 0);

    // Get token names for trades
    const tokenIds = [...new Set(allTrades.map((t) => t.st_token_id).filter(Boolean))];
    const { data: tokenNames } = tokenIds.length
      ? await supabase.from("st_tokens").select("id, name").in("id", tokenIds)
      : { data: [] };

    const nameMap = Object.fromEntries((tokenNames ?? []).map((t) => [t.id, t.name]));

    return NextResponse.json({
      totalFeesCollected,
      lqstBuybacks,
      stBuybacks,
      totalTrades: allTrades.length,
      totalVolume,
      recentBuybacks: allBuybacks.map((b) => ({
        id: b.id,
        targetToken: b.target_token,
        solSpent: b.sol_spent,
        tokensBought: b.tokens_bought,
        createdAt: b.created_at,
      })),
      recentTrades: allTrades.map((t) => ({
        id: t.sol_amount + "_" + t.created_at, // stub id
        stTokenName: nameMap[t.st_token_id] ?? "Unknown",
        direction: t.direction,
        solAmount: t.sol_amount,
        taxRate: t.tax_rate,
        isGenesisPhase: t.is_genesis_phase,
        feeToLp: t.fee_to_lp,
        feeToLqst: t.fee_to_lqst,
        createdAt: t.created_at,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
