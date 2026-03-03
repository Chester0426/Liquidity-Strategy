import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("st_tokens")
      .select(
        "id, name, base_token_symbol, base_token_name, base_token_logo, genesis_status, genesis_sol_raised, genesis_sol_target, launched_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tokens = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      baseTokenSymbol: t.base_token_symbol,
      baseTokenName: t.base_token_name,
      baseTokenLogo: t.base_token_logo,
      genesisStatus: t.genesis_status,
      genesisSOLRaised: t.genesis_sol_raised,
      genesisSOLTarget: t.genesis_sol_target,
      launchedAt: t.launched_at,
      createdAt: t.created_at,
    }));

    return NextResponse.json({ tokens });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
