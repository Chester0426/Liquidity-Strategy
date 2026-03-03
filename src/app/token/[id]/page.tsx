"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

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

interface WalletToken {
  mint: string;       // "sol" or Solana mint address
  symbol: string;
  balance: number;
  isDirect: boolean;  // true if matches base token symbol
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
  const { connection } = useConnection();
  const walletAddress = publicKey?.toString() ?? null;

  const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
  const [payWithMint, setPayWithMint] = useState<string>("sol");
  const [loadingTokens, setLoadingTokens] = useState(false);

  useEffect(() => {
    fetch(`/api/tokens/${tokenId}`)
      .then((r) => r.json())
      .then((d) => setToken(d.token ?? null))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [tokenId]);

  // Fetch wallet token balances when in buy mode and wallet connected
  useEffect(() => {
    if (!publicKey || !connection || tradeDirection !== "buy" || !token) return;

    async function fetchWalletTokens() {
      setLoadingTokens(true);
      try {
        // 1. SOL balance
        const solBalance = await connection.getBalance(publicKey!);
        const solUi = solBalance / 1e9;

        // 2. SPL tokens
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey!, {
          programId: TOKEN_PROGRAM_ID,
        });

        const spls = accounts.value
          .map((a) => ({
            mint: a.account.data.parsed.info.mint as string,
            balance: a.account.data.parsed.info.tokenAmount.uiAmount as number,
          }))
          .filter((t) => t.balance > 0);

        // 3. Fetch symbols from Jupiter token list
        let symbolMap: Record<string, string> = {};
        if (spls.length > 0) {
          const mints = spls.map((t) => t.mint).join(",");
          try {
            const res = await fetch(`https://lite-api.jup.ag/tokens/v1/mints?mints=${mints}`);
            if (res.ok) {
              const data: Array<{ address: string; symbol: string }> = await res.json();
              data.forEach((t) => {
                symbolMap[t.address] = t.symbol;
              });
            }
          } catch {
            // Jupiter API unavailable — use fallback labels
          }
        }

        // 4. Build token list: SOL first, then SPL sorted by isDirect first
        const baseSymbol = token!.baseTokenSymbol.toUpperCase();
        const tokens: WalletToken[] = [
          { mint: "sol", symbol: "SOL", balance: solUi, isDirect: false },
          ...spls
            .map((t) => ({
              mint: t.mint,
              symbol:
                symbolMap[t.mint] ??
                t.mint.slice(0, 4) + "..." + t.mint.slice(-4),
              balance: t.balance,
              isDirect:
                (symbolMap[t.mint] ?? "").toUpperCase() === baseSymbol,
            }))
            .sort((a, b) => (b.isDirect ? 1 : 0) - (a.isDirect ? 1 : 0)),
        ];

        setWalletTokens(tokens);
        // Auto-select base token if available, else SOL
        const direct = tokens.find((t) => t.isDirect);
        setPayWithMint(direct ? direct.mint : "sol");
      } catch {
        // Wallet read error — show empty state
        setWalletTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    }

    fetchWalletTokens();
  }, [publicKey, connection, tradeDirection, token]);

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
          inputToken: tradeDirection === "buy" ? payWithMint : undefined,
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
        // Refresh token data
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
  const selectedToken = walletTokens.find((t) => t.mint === payWithMint);

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
        {/* Left: Price Chart Placeholder + Description */}
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
                  ORCA {token.baseTokenSymbol}/SOL LP 價值
                </span>
                <span className="font-medium text-muted-foreground italic">
                  — (需要鏈上數據)
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
                  在 Solscan 查看 {token.name} LP 錢包 ↗
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  LP 錢包地址將在部署上鏈後顯示
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                LP 永久鎖倉，協議自有流動性永不撤出。
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

                  {/* Pay with selector — Buy mode only */}
                  {tradeDirection === "buy" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Pay with</p>
                      {!walletAddress ? (
                        <p className="text-sm text-muted-foreground">
                          Connect wallet to see available tokens
                        </p>
                      ) : loadingTokens ? (
                        <p className="text-sm text-muted-foreground">Loading wallet...</p>
                      ) : walletTokens.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No tokens found in wallet</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {walletTokens.map((t) => (
                            <button
                              key={t.mint}
                              onClick={() => setPayWithMint(t.mint)}
                              className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
                                payWithMint === t.mint
                                  ? "border-primary bg-primary/10"
                                  : "border-muted hover:border-primary/50"
                              }`}
                            >
                              <span className="font-medium">{t.symbol}</span>
                              <span className="text-xs text-muted-foreground">
                                {t.balance.toFixed(4)}
                              </span>
                              {t.isDirect ? (
                                <span className="text-xs text-green-500 font-medium">Direct</span>
                              ) : (
                                <span className="text-xs text-orange-400">Via Jupiter</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tax Rate Info */}
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Tax Rate</span>
                      <span className="font-medium text-amber-600">{taxRate}%</span>
                    </div>
                    {isGenesis && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Genesis phase: tax decreasing 1%/min → 10% at minute 85
                      </p>
                    )}
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground">Fee destination</span>
                      <span className="text-xs">
                        {isGenesis ? "100% → LP" : "8% → LP + 2% → LQST"}
                      </span>
                    </div>
                  </div>

                  {/* Route display */}
                  {tradeDirection === "buy" && selectedToken && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                      {selectedToken.isDirect
                        ? `${token.baseTokenSymbol} → [LQST Protocol] → ${token.name}`
                        : `${selectedToken.symbol} → [Jupiter] → ${token.baseTokenSymbol} → [LQST] → ${token.name}`}
                    </div>
                  )}

                  <form onSubmit={handleTrade} className="space-y-3">
                    <div>
                      <Label htmlFor="trade-amount">
                        {tradeDirection === "buy"
                          ? selectedToken
                            ? `${selectedToken.symbol} to spend`
                            : "Amount to spend"
                          : `${token.name} to sell`}
                      </Label>
                      <Input
                        id="trade-amount"
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="0.00"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        className="text-base h-11 mt-1"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={trading}
                      className="w-full"
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
                    <p className={`text-sm ${tradeMsg.includes("failed") || tradeMsg.includes("Failed") ? "text-destructive" : "text-green-600"}`}>
                      {tradeMsg}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Stub: Wallet connection and on-chain execution not yet implemented.
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
