import { NextResponse } from "next/server";

const SOLANA_RPC =
  process.env.SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

// Whitelist of allowed Solana JSON-RPC methods (read-only)
const ALLOWED_METHODS = new Set([
  "getBalance",
  "getTokenAccountsByOwner",
  "getAccountInfo",
  "getLatestBlockhash",
  "getSlot",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate method is whitelisted
    if (!body.method || !ALLOWED_METHODS.has(body.method)) {
      return NextResponse.json(
        { error: `Method not allowed: ${body.method}` },
        { status: 403 }
      );
    }

    const res = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: body.id ?? 1,
        method: body.method,
        params: body.params ?? [],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[rpc-proxy]", err);
    return NextResponse.json(
      { error: "RPC proxy error" },
      { status: 502 }
    );
  }
}
