import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = createAdminSupabaseClient();

    // Look up by base_token_symbol (lowercase slug) or by UUID
    const { data, error } = await supabase
      .from("st_tokens")
      .select("*")
      .or(`base_token_symbol.ilike.${id},id.eq.${id}`)
      .single();

    if (error || !data) {
      return NextResponse.json({ token: null }, { status: 404 });
    }

    // Aggregate LP position (base_token/ST pair — genesis SOL was used to buy base token)
    const { data: lpData } = await supabase
      .from("lp_positions")
      .select("base_token_amount, token_amount")
      .eq("st_token_id", data.id);

    const lpBaseToken = (lpData ?? []).reduce((s, r) => s + (r.base_token_amount ?? 0), 0);
    const lpTokens = (lpData ?? []).reduce((s, r) => s + (r.token_amount ?? 0), 0);

    // Aggregate trades
    const { data: tradeAgg } = await supabase
      .from("trades")
      .select("sol_amount")
      .eq("st_token_id", data.id);

    const totalTrades = tradeAgg?.length ?? 0;
    const totalVolume = (tradeAgg ?? []).reduce((s, r) => s + (r.sol_amount ?? 0), 0);

    // Calculate current tax rate if launched
    let currentTaxRate = 10;
    let minutesSinceLaunch = 0;
    if (data.genesis_status === "launched" && data.launched_at) {
      minutesSinceLaunch = Math.floor(
        (Date.now() - new Date(data.launched_at).getTime()) / 60_000
      );
      if (minutesSinceLaunch >= 85) {
        // Auto-transition to stable
        await supabase
          .from("st_tokens")
          .update({ genesis_status: "stable" })
          .eq("id", data.id);
        data.genesis_status = "stable";
        currentTaxRate = 10;
      } else {
        currentTaxRate = Math.max(10, 95 - minutesSinceLaunch);
      }
    }

    const token = {
      id: data.id,
      name: data.name,
      baseTokenSymbol: data.base_token_symbol,
      baseTokenName: data.base_token_name,
      baseTokenLogo: data.base_token_logo,
      description: data.description,
      genesisStatus: data.genesis_status,
      genesisSOLRaised: data.genesis_sol_raised,
      genesisSOLTarget: data.genesis_sol_target,
      launchedAt: data.launched_at,
      lpBaseToken,
      lpTokens,
      totalTrades,
      totalVolume,
      currentTaxRate,
      minutesSinceLaunch,
    };

    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
