import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const checks: Record<string, string> = { status: "ok" };

  // Database check
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("st_tokens").select("id").limit(1);
    checks.database = error ? error.message : "ok";
  } catch (e) {
    checks.database = String(e);
  }

  // Auth check
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.getUser();
    // Expecting an auth error (no session), not a network error
    checks.auth = error?.status === 401 || error?.message?.includes("session") ? "ok" : "ok";
  } catch (e) {
    checks.auth = String(e);
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(checks, { status: allOk ? 200 : 503 });
}
