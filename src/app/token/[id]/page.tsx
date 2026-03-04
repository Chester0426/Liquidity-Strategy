"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RPC_ENDPOINTS = [
  "/api/rpc",  // proxy (server-to-server, avoids 403 from public RPCs)
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

async function solanaRpc(method: string, params: unknown[]) {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.warn(`[LQST] RPC ${rpc} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data.error) {
        console.warn(`[LQST] RPC ${rpc} error:`, data.error.message);
        continue;
      }
      return data.result;
    } catch (err) {
      console.warn(`[LQST] RPC ${rpc} failed:`, err);
      continue;
    }
  }
  console.warn("[LQST] All RPCs failed for:", method);
  return null;
}

interface TokenDetail {
  id: string;
  name: string;
  baseTokenSymbol: string;
  baseTokenName: string;
  baseTokenLogo?: string;
  description?: string;
  genesisStatus: "collecting" | "launched" | "stable";
  genesisSOLRaised: number;
  genesisSOLTarget: number;
  launchedAt?: string;
  lpBaseToken?: number;
  lpTokens?: number;
  lpTokenAddress?: string | null;
  totalTrades?: number;
  totalVolume?: number;
  currentTaxRate?: number;
  minutesSinceLaunch?: number;
}

export default function TokenDetailPage() {
  const params = useParams();
  const tokenId = params.id as string;
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradeDirection, setTradeDirection] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [trading, setTrading] = useState(false);
  const [tradeMsg, setTradeMsg] = useState("");

  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toString() ?? null;

  // Two-token model: SOL or base token (e.g. PUMP)
  const [selectedInputToken, setSelectedInputToken] = useState<"sol" | "base">("sol");
  const [solBalance, setSolBalance] = useState(0);
  const [baseTokenBalance, setBaseTokenBalance] = useState(0);
  const [baseTokenMint, setBaseTokenMint] = useState<string | null>(null);

  // Load token data
  useEffect(() => {
    fetch(`/api/tokens/${tokenId}`)
      .then((r) => r.json())
      .then((d) => setToken(d.token ?? null))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [tokenId]);

  // Resolve base token mint address via DexScreener (Jupiter API is deprecated)
  useEffect(() => {
    if (!token) return;
    async function resolveMint() {
      try {
        const symbol = token!.baseTokenSymbol.toUpperCase();
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(symbol)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!res.ok) {
          console.warn("[LQST] DexScreener HTTP", res.status);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        // Find the Solana pair with matching symbol, sorted by liquidity
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const match = (data.pairs ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((p: any) =>
            p.chainId === "solana" &&
            p.baseToken?.symbol?.toUpperCase() === symbol
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        if (match?.baseToken?.address) {
          console.log("[LQST] Resolved", symbol, "→", match.baseToken.address);
          setBaseTokenMint(match.baseToken.address);
        } else {
          console.warn("[LQST] No Solana token found for symbol:", symbol);
        }
      } catch (err) {
        console.warn("[LQST] Mint resolution failed:", err);
      }
    }
    resolveMint();
  }, [token]);

  // Fetch SOL + base token balances
  useEffect(() => {
    if (!publicKey || !token) return;
    const address = publicKey.toString();

    async function fetchBalances() {
      try {
        // SOL balance via getBalance
        const balResult = await solanaRpc("getBalance", [address]);
        if (balResult?.value != null) {
          setSolBalance(balResult.value / 1e9);
          console.log("[LQST] SOL balance:", balResult.value / 1e9);
        } else {
          console.warn("[LQST] SOL balance returned null for", address);
        }

        // Base token (SPL) balance via getTokenAccountsByOwner
        if (baseTokenMint) {
          const splResult = await solanaRpc("getTokenAccountsByOwner", [
            address,
            { mint: baseTokenMint },
            { encoding: "jsonParsed" },
          ]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const total = (splResult?.value ?? []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, a: any) =>
              sum + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0),
            0
          );
          setBaseTokenBalance(total);
          console.log("[LQST] Base token balance:", total, "mint:", baseTokenMint);
        }
      } catch (err) {
        console.warn("[LQST] Balance fetch error:", err);
      }
    }

    fetchBalances();
  }, [publicKey, token, baseTokenMint]);

  const currentBalance = selectedInputToken === "sol" ? solBalance : baseTokenBalance;

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(tradeAmount);
    if (!amount || amount <= 0 || !token) return;
    setTrading(true);
    setTradeMsg("");
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: walletAddress ?? "stub_wallet",
          stTokenId: token.id,
          direction: tradeDirection,
          inputToken: tradeDirection === "buy"
            ? (selectedInputToken === "sol" ? "sol" : baseTokenMint ?? "sol")
            : undefined,
          solAmount: tradeDirection === "buy" ? amount : undefined,
          tokenAmount: tradeDirection === "sell" ? amount : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTradeMsg(data.error ?? "Trade failed.");
      } else {
        setTradeMsg(
          `${tradeDirection === "buy" ? "Bought" : "Sold"} successfully! (Stub — no real Solana transaction)`
        );
        setTradeAmount("");
        fetch(`/api/tokens/${tokenId}`)
          .then((r) => r.json())
          .then((d) => setToken(d.token ?? null));
      }
    } catch {
      setTradeMsg("Trade failed. Please try again.");
    } finally {
      setTrading(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-muted-foreground">Loading token...</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-muted-foreground">Token not found.</p>
      </main>
    );
  }

  const isGenesis = token.genesisStatus === "launched";
  const taxRate = token.currentTaxRate ?? (isGenesis ? Math.max(10, 95 - (token.minutesSinceLaunch ?? 0)) : 10);

  // Estimate output amount using stub AMM (constant-product spot price)
  function estimateReceive(inputAmount: number): number {
    if (inputAmount <= 0 || !token) return 0;
    const lpBase = token.lpBaseToken ?? 10_000;      // base tokens in LP
    const lpST   = token.lpTokens  ?? 800_000_000;   // ST tokens in LP
    const taxMul = 1 - taxRate / 100;
    if (tradeDirection === "buy") {
      // SOL → base token (stub: 1 SOL = 1000 base units) → ST via AMM
      const baseIn = selectedInputToken === "sol" ? inputAmount * 1_000 : inputAmount;
      const afterTax = baseIn * taxMul;
      // constant-product: Δy = y * Δx / (x + Δx)
      return (lpST * afterTax) / (lpBase + afterTax);
    } else {
      // ST → base token (sell direction)
      const afterTax = inputAmount * taxMul;
      return (lpBase * afterTax) / (lpST + afterTax);
    }
  }

  const inputAmount = parseFloat(tradeAmount) || 0;
  const estimatedOut = estimateReceive(inputAmount);
  const estimatedLabel = tradeDirection === "buy" ? token.name : token.baseTokenSymbol;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {token.baseTokenLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={token.baseTokenLogo} alt={token.baseTokenSymbol} className="w-12 h-12 rounded-full" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{token.name}</h1>
          <p className="text-muted-foreground">Base token: {token.baseTokenName} ({token.baseTokenSymbol})</p>
        </div>
        {isGenesis && (
          <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
            Genesis Phase — {taxRate}% Tax
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Price Chart Stub */}
          <Card>
            <CardHeader>
              <CardTitle>Price Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 bg-muted/50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Price chart — requires on-chain data (stub)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          {token.description && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-muted-foreground">{token.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Treasury LP Data */}
          <Card>
            <CardHeader>
              <CardTitle>Treasury LP Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  ORCA {token.baseTokenSymbol}/SOL LP Value
                </span>
                <span className="font-medium text-muted-foreground italic">
                  — (requires on-chain data)
                </span>
              </div>
              <Separator />
              {token.lpTokenAddress && !token.lpTokenAddress.startsWith("stub_") ? (
                <a
                  href={`https://solscan.io/account/${token.lpTokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                  View {token.name} LP wallet on Solscan ↗
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  LP wallet address will be shown after on-chain deployment.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                LP is permanently locked — protocol-owned liquidity is never withdrawn.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Trade Interface */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Trade {token.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {token.genesisStatus === "collecting" ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">
                    This token is still in the genesis pool phase.
                  </p>
                  <Button asChild>
                    <a href="/create">Join Genesis Pool</a>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Buy/Sell Toggle */}
                  <div className="flex rounded-lg overflow-hidden border">
                    <button
                      onClick={() => setTradeDirection("buy")}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        tradeDirection === "buy"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setTradeDirection("sell")}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        tradeDirection === "sell"
                          ? "bg-destructive text-destructive-foreground"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      Sell
                    </button>
                  </div>

                  {/* Balance row */}
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>balance</span>
                    <span className="text-foreground font-medium tabular-nums">
                      {!walletAddress
                        ? "—"
                        : tradeDirection === "buy"
                        ? selectedInputToken === "sol"
                          ? `${solBalance.toFixed(6)} SOL`
                          : `${baseTokenBalance.toFixed(4)} ${token.baseTokenSymbol}`
                        : `— ${token.name}`}
                    </span>
                  </div>

                  {/* Trade form */}
                  <form onSubmit={handleTrade} className="space-y-2">
                    {/* Amount input + token selector */}
                    <div className="flex items-stretch h-14 rounded-2xl border border-white/10 bg-muted/20 overflow-hidden focus-within:ring-2 focus-within:ring-ring/40 transition-shadow">
                      <Input
                        id="trade-amount"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        className="border-0 shadow-none text-xl font-medium flex-1 h-full pl-4 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0 placeholder:text-muted-foreground/40"
                        style={{ background: "transparent" }}
                      />
                      {tradeDirection === "buy" ? (
                        <Select
                          value={selectedInputToken}
                          onValueChange={(v) => {
                            setSelectedInputToken(v as "sol" | "base");
                            setTradeAmount("");
                          }}
                        >
                          <SelectTrigger
                            className="border-0 rounded-none shadow-none !h-full w-36 shrink-0 text-sm font-semibold focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:border-0 px-3"
                            style={{ background: "transparent" }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {selectedInputToken === "sol" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                                  alt="SOL"
                                  className="w-6 h-6 rounded-full shrink-0"
                                />
                              ) : token.baseTokenLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={token.baseTokenLogo}
                                  alt={token.baseTokenSymbol}
                                  className="w-6 h-6 rounded-full shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                              )}
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sol">SOL</SelectItem>
                            <SelectItem value="base">{token.baseTokenSymbol}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="px-4 flex items-center text-sm font-semibold text-muted-foreground shrink-0">
                          {token.name}
                        </div>
                      )}
                    </div>

                    {/* Quick amount chips */}
                    {tradeDirection === "buy" && selectedInputToken === "sol" && (
                      <div className="flex gap-1.5 pt-0.5">
                        {(["Reset", "0.1", "0.5", "1"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setTradeAmount(v === "Reset" ? "" : v)}
                            className="flex-1 py-1.5 rounded-lg border border-white/10 text-xs text-muted-foreground hover:text-foreground hover:border-white/25 hover:bg-muted/40 transition-all"
                          >
                            {v === "Reset" ? "Reset" : `${v} SOL`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setTradeAmount(solBalance > 0 ? solBalance.toFixed(6) : "")}
                          className="flex-1 py-1.5 rounded-lg border border-white/10 text-xs text-muted-foreground hover:text-foreground hover:border-white/25 hover:bg-muted/40 transition-all"
                        >
                          Max
                        </button>
                      </div>
                    )}

                    {tradeDirection === "buy" && selectedInputToken === "base" && (
                      <div className="flex gap-1.5 pt-0.5">
                        {([25, 50, 75, 100] as const).map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              setTradeAmount(
                                baseTokenBalance > 0
                                  ? ((baseTokenBalance * pct) / 100).toFixed(4)
                                  : ""
                              )
                            }
                            className="flex-1 py-1.5 rounded-lg border border-white/10 text-xs text-muted-foreground hover:text-foreground hover:border-white/25 hover:bg-muted/40 transition-all"
                          >
                            {pct === 100 ? "Max" : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Estimated receive */}
                    {inputAmount > 0 && (
                      <div className="flex items-center justify-between text-sm rounded-xl bg-muted/10 border border-white/5 px-4 py-2.5">
                        <span className="text-muted-foreground">You receive</span>
                        <span className="font-semibold tabular-nums">
                          ≈{" "}
                          {estimatedOut >= 1_000_000
                            ? `${(estimatedOut / 1_000_000).toFixed(4)}M`
                            : estimatedOut >= 1_000
                            ? `${(estimatedOut / 1_000).toFixed(4)}K`
                            : estimatedOut.toFixed(4)}{" "}
                          {estimatedLabel}
                        </span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={trading}
                      className="w-full h-12 text-base font-semibold rounded-2xl mt-1"
                      variant={tradeDirection === "sell" ? "destructive" : "default"}
                    >
                      {trading
                        ? "Processing..."
                        : tradeDirection === "buy"
                        ? `Buy ${token.name}`
                        : `Sell ${token.name}`}
                    </Button>
                  </form>

                  {tradeMsg && (
                    <p
                      className={`text-sm ${
                        tradeMsg.includes("failed") || tradeMsg.includes("Failed")
                          ? "text-destructive"
                          : "text-green-600"
                      }`}
                    >
                      {tradeMsg}
                    </p>
                  )}

                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
