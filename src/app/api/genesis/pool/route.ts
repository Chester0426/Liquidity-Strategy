import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const querySchema = z.object({ symbol: z.string().min(1).max(20) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parse = querySchema.safeParse({ symbol: searchParams.get("symbol") });
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const symbol = parse.data.symbol.toUpperCase();

  try {
    const supabase = createAdminSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("st_tokens")
      .select("id, name, genesis_status, genesis_sol_raised, genesis_sol_target")
      .ilike("base_token_symbol", symbol)
      .single();

    if (error || !data) {
      return NextResponse.json({ pool: null });
    }

    let myContribution = 0;
    if (user) {
      const { data: contrib } = await supabase
        .from("genesis_contributions")
        .select("sol_amount")
        .eq("st_token_id", data.id)
        .eq("contributor_address", user.id)
        .is("refunded_at", null)
        .single();
      myContribution = contrib?.sol_amount ?? 0;
    }

    return NextResponse.json({
      pool: {
        id: data.id,
        stName: data.name,
        genesisStatus: data.genesis_status,
        genesisSOLRaised: data.genesis_sol_raised,
        genesisSOLTarget: data.genesis_sol_target,
        myContribution,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
