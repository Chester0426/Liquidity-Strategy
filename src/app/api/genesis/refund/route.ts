import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// TODO: Add production rate limiting (e.g., Upstash Redis)

const bodySchema = z.object({ poolId: z.string().uuid() });

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

    const { poolId } = parse.data;

    // Verify pool is still collecting
    const { data: token, error: tokenError } = await supabase
      .from("st_tokens")
      .select("id, name, genesis_status, genesis_sol_raised, genesis_sol_target")
      .eq("id", poolId)
      .single();

    if (tokenError || !token) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    if (token.genesis_status !== "collecting") {
      return NextResponse.json(
        { error: "Cannot refund after launch — the pool has already launched." },
        { status: 400 }
      );
    }

    // Get user's unrefunded contributions
    const { data: contributions, error: contribError } = await supabase
      .from("genesis_contributions")
      .select("id, sol_amount")
      .eq("st_token_id", poolId)
      .eq("contributor_address", user.id)
      .is("refunded_at", null);

    if (contribError) {
      return NextResponse.json({ error: contribError.message }, { status: 500 });
    }

    if (!contributions || contributions.length === 0) {
      return NextResponse.json({ error: "No active contributions to refund" }, { status: 400 });
    }

    const refundedAt = new Date().toISOString();
    const totalRefund = contributions.reduce((s, c) => s + c.sol_amount, 0);

    // Mark all contributions as refunded
    const ids = contributions.map((c) => c.id);
    const { error: refundError } = await supabase
      .from("genesis_contributions")
      .update({ refunded_at: refundedAt })
      .in("id", ids);

    if (refundError) {
      return NextResponse.json({ error: refundError.message }, { status: 500 });
    }

    // Decrease raised amount
    const newRaised = Math.max(0, token.genesis_sol_raised - totalRefund);
    await supabase
      .from("st_tokens")
      .update({ genesis_sol_raised: newRaised })
      .eq("id", poolId);

    // Return updated pool
    const { data: finalToken } = await supabase
      .from("st_tokens")
      .select("id, name, genesis_status, genesis_sol_raised, genesis_sol_target")
      .eq("id", poolId)
      .single();

    return NextResponse.json({
      refundedSOL: totalRefund,
      pool: {
        id: finalToken!.id,
        stName: finalToken!.name,
        genesisStatus: finalToken!.genesis_status,
        genesisSOLRaised: finalToken!.genesis_sol_raised,
        genesisSOLTarget: finalToken!.genesis_sol_target,
        myContribution: 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
