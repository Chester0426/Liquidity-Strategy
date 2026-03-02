import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({ q: z.string().min(1).max(100) });

interface TokenResult {
  symbol: string;
  name: string;
  logo?: string;
  source: "coingecko" | "pumpfun";
  contractAddress?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parse = querySchema.safeParse({ q: searchParams.get("q") });
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const query = parse.data.q.trim().toUpperCase();
  const results: TokenResult[] = [];

  // CoinGecko search (public, no key required)
  try {
    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
    );
    if (cgRes.ok) {
      const cgData = await cgRes.json();
      const coins = (cgData.coins ?? []).slice(0, 5);
      for (const coin of coins) {
        results.push({
          symbol: coin.symbol?.toUpperCase() ?? query,
          name: coin.name ?? query,
          logo: coin.thumb ?? undefined,
          source: "coingecko",
        });
      }
    }
  } catch {
    // CoinGecko unavailable — skip
  }

  // Pump.fun search (public endpoint)
  try {
    const pfRes = await fetch(
      `https://frontend-api.pump.fun/coins/search?searchTerm=${encodeURIComponent(query)}&limit=5&includeNsfw=false`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
    );
    if (pfRes.ok) {
      const pfData = await pfRes.json();
      const coins = Array.isArray(pfData) ? pfData : (pfData.coins ?? []);
      for (const coin of coins.slice(0, 5)) {
        const sym = (coin.symbol ?? coin.ticker ?? "").toUpperCase();
        // Deduplicate vs CoinGecko results
        if (!results.find((r) => r.symbol === sym)) {
          results.push({
            symbol: sym,
            name: coin.name ?? sym,
            logo: coin.image_uri ?? coin.logo ?? undefined,
            source: "pumpfun",
            contractAddress: coin.mint ?? coin.address ?? undefined,
          });
        }
      }
    }
  } catch {
    // Pump.fun unavailable — skip
  }

  return NextResponse.json({ results: results.slice(0, 8) });
}
