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

const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

async function solanaRpc(method: string, params: unknown[]) {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      return data.result;
    } catch {
      continue;
    }
  }
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

  // Resolve base token mint address via Jupiter
  useEffect(() => {
    if (!token) return;
    async function resolveMint() {
      try {
        const res = await fetch(
          `https://lite-api.jup.ag/tokens/v1/search?query=${encodeURIComponent(token!.baseTokenSymbol)}`
        );
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results: any[] = await res.json();
        const items = Array.isArray(results) ? results : (results as { tokens?: unknown[] }).tokens ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const match = (items as any[]).find(
          (t) => t.symbol?.toUpperCase() === token!.baseTokenSymbol.toUpperCase()
        );
        if (match?.address) setBaseTokenMint(match.address);
      } catch {
        // ignore — balance for base token will show 0
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
        // SOL balance
        const balResult = await solanaRpc("getBalance", [address]);
        setSolBalance((balResult?.value ?? 0) / 1e9);

        // Base token balance
        if (baseTokenMint) {
          const splResult = await solanaRpc("getParsedTokenAccountsByOwner", [
            address,
            { mint: baseTokenMint },
            { encoding: "jsonParsed" },
          ]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const total = (splResult?.value ?? []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, a: any) =>
              sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
            0
          );
          setBaseTokenBalance(total);
        }
      } catch {
        // ignore
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
                  {walletAddress && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">balance:</span>
                      <span className="font-medium">
                        {tradeDirection === "buy"
                          ? selectedInputToken === "sol"
                            ? `${solBalance.toFixed(6)} SOL`
                            : `${baseTokenBalance.toFixed(4)} ${token.baseTokenSymbol}`
                          : `— ${token.name}`}
                      </span>
                    </div>
                  )}

                  {/* Tax info row */}
                  <div className="flex justify-between text-xs text-muted-foreground px-0.5">
                    <span>
                      Tax:{" "}
                      <span className="text-amber-500 font-medium">{taxRate}%</span>
                      {isGenesis && (
                        <span className="ml-1">↓ 1%/min → 10%</span>
                      )}
                    </span>
                    <span>{isGenesis ? "100% → LP" : "8% LP + 2% LQST"}</span>
                  </div>

                  {/* Trade form */}
                  <form onSubmit={handleTrade} className="space-y-3">
                    {/* Amount input + token selector */}
                    <div className="flex rounded-xl border bg-muted/20 overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                      <Input
                        id="trade-amount"
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        className="border-0 bg-transparent text-lg h-14 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-0"
                      />
                      {tradeDirection === "buy" ? (
                        <Select
                          value={selectedInputToken}
                          onValueChange={(v) => {
                            setSelectedInputToken(v as "sol" | "base");
                            setTradeAmount("");
                          }}
                        >
                          <SelectTrigger className="border-0 bg-transparent h-14 w-[120px] shrink-0 text-sm font-semibold focus:ring-0 rounded-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sol">SOL</SelectItem>
                            <SelectItem value="base">{token.baseTokenSymbol}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-14 px-4 flex items-center text-sm font-semibold text-muted-foreground shrink-0">
                          {token.name}
                        </div>
                      )}
                    </div>

                    {/* Quick amount chips */}
                    {tradeDirection === "buy" && selectedInputToken === "sol" && (
                      <div className="flex gap-1.5">
                        {(["Reset", "0.1", "0.5", "1"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setTradeAmount(v === "Reset" ? "" : v)}
                            className="flex-1 py-1.5 rounded-full border text-xs hover:bg-muted/60 transition-colors"
                          >
                            {v === "Reset" ? "Reset" : `${v} SOL`}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setTradeAmount(solBalance > 0 ? solBalance.toFixed(6) : "")}
                          className="flex-1 py-1.5 rounded-full border text-xs hover:bg-muted/60 transition-colors"
                        >
                          Max
                        </button>
                      </div>
                    )}

                    {tradeDirection === "buy" && selectedInputToken === "base" && (
                      <div className="flex gap-1.5">
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
                            className="flex-1 py-1.5 rounded-full border text-xs hover:bg-muted/60 transition-colors"
                          >
                            {pct === 100 ? "Max" : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={trading}
                      className="w-full h-12 text-base font-semibold"
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

                  <p className="text-xs text-muted-foreground text-center">
                    Stub: on-chain execution not yet implemented.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
