"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trackActivate } from "@/lib/events";

interface TokenSearchResult {
  symbol: string;
  name: string;
  logo?: string;
  source: "coingecko" | "pumpfun";
  contractAddress?: string;
}

interface GenesisPool {
  id: string;
  stName: string;
  genesisStatus: "collecting" | "launched" | "stable";
  genesisSOLRaised: number;
  genesisSOLTarget: number;
  myContribution?: number;
}

export default function CreatePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenSearchResult | null>(null);
  const [existingPool, setExistingPool] = useState<GenesisPool | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributing, setContributing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [message, setMessage] = useState("");
  const [activatedOnce, setActivatedOnce] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setMessage("");
    try {
      const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
      if ((data.results ?? []).length === 0) {
        setMessage("No tokens found. Try a different symbol or address.");
      }
    } catch {
      setMessage("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectToken(token: TokenSearchResult) {
    setSelectedToken(token);
    setSearchResults([]);
    setLoadingPool(true);
    setMessage("");
    try {
      const res = await fetch(`/api/genesis/pool?symbol=${encodeURIComponent(token.symbol)}`);
      const data = await res.json();
      setExistingPool(data.pool ?? null);
    } catch {
      setMessage("Failed to load pool data.");
    } finally {
      setLoadingPool(false);
    }
  }

  async function handleContribute(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) return;
    setContributing(true);
    setMessage("");
    try {
      const res = await fetch("/api/genesis/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedToken!.symbol,
          tokenName: selectedToken!.name,
          tokenLogo: selectedToken!.logo,
          solAmount: amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Contribution failed.");
      } else {
        if (!activatedOnce) {
          trackActivate({ action: "contributed_to_genesis_pool" });
          setActivatedOnce(true);
        }
        setExistingPool(data.pool);
        setContributeAmount("");
        setMessage(`Successfully contributed ${amount} SOL!`);
      }
    } catch {
      setMessage("Contribution failed. Please try again.");
    } finally {
      setContributing(false);
    }
  }

  async function handleRefund() {
    if (!existingPool) return;
    setRefunding(true);
    setMessage("");
    try {
      const res = await fetch("/api/genesis/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: existingPool.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Refund failed.");
      } else {
        setExistingPool(data.pool);
        setMessage("Refund processed successfully.");
      }
    } catch {
      setMessage("Refund failed. Please try again.");
    } finally {
      setRefunding(false);
    }
  }

  const progressPct = existingPool
    ? Math.min((existingPool.genesisSOLRaised / existingPool.genesisSOLTarget) * 100, 100)
    : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold mb-2">Create ST Token</h1>
      <p className="text-muted-foreground mb-6 text-base">
        Search for a base token to launch its ST. Each token can only have one
        genesis pool — find and join an existing one, or start a new one.
      </p>

      {/* Search */}
      {!selectedToken && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Base Token</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-3">
              <Input
                placeholder="Token symbol or address (e.g. PUMP, SOL)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-base h-11"
              />
              <Button type="submit" disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </Button>
            </form>
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((token) => (
                  <button
                    key={token.symbol + token.source}
                    onClick={() => handleSelectToken(token)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                  >
                    {token.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" />
                    )}
                    <div>
                      <p className="font-medium">{token.symbol}</p>
                      <p className="text-sm text-muted-foreground">{token.name}</p>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      via {token.source === "coingecko" ? "CoinGecko" : "Pump.fun"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Token + Pool */}
      {selectedToken && (
        <div className="space-y-6">
          {/* Token Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                {selectedToken.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-semibold text-lg">{selectedToken.symbol}</p>
                  <p className="text-sm text-muted-foreground">{selectedToken.name}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xl font-bold text-primary">
                    {selectedToken.symbol}ST
                  </p>
                  <p className="text-xs text-muted-foreground">ST Token Name</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedToken(null);
                  setExistingPool(null);
                  setMessage("");
                }}
              >
                Search different token
              </Button>
            </CardContent>
          </Card>

          {loadingPool ? (
            <Card>
              <CardContent className="pt-6 text-muted-foreground">
                Loading genesis pool...
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  {existingPool ? "Genesis Pool" : "Start Genesis Pool"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {existingPool && (
                  <>
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">SOL Raised</span>
                        <span className="font-medium">
                          {existingPool.genesisSOLRaised.toFixed(2)} /{" "}
                          {existingPool.genesisSOLTarget} SOL
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="bg-primary h-3 rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {progressPct.toFixed(1)}% of target reached
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-medium capitalize">
                          {existingPool.genesisStatus === "collecting"
                            ? "Collecting"
                            : existingPool.genesisStatus === "launched"
                            ? "Launched — Genesis Phase"
                            : "Stable"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Token Allocation</p>
                        <p className="font-medium">20% of 1B = 200M tokens</p>
                      </div>
                    </div>

                    {existingPool.myContribution && existingPool.myContribution > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium">Your Contribution</p>
                        <p className="text-sm text-muted-foreground">
                          {existingPool.myContribution.toFixed(4)} SOL → ~
                          {(
                            (existingPool.myContribution / existingPool.genesisSOLTarget) *
                            200_000_000
                          ).toLocaleString()}{" "}
                          tokens (estimated)
                        </p>
                      </div>
                    )}

                    <Separator />
                  </>
                )}

                {/* Contribute Form */}
                {(!existingPool || existingPool.genesisStatus === "collecting") && (
                  <form onSubmit={handleContribute} className="space-y-3">
                    <div>
                      <Label htmlFor="sol-amount">SOL Amount to Contribute</Label>
                      <Input
                        id="sol-amount"
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="e.g. 1.5"
                        value={contributeAmount}
                        onChange={(e) => setContributeAmount(e.target.value)}
                        className="text-base h-11 mt-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Launch triggers automatically at 10 SOL. You can refund
                      any time before launch.
                    </p>
                    <Button type="submit" disabled={contributing} className="w-full sm:w-auto">
                      {contributing ? "Contributing..." : "Contribute SOL"}
                    </Button>
                  </form>
                )}

                {/* Refund Button */}
                {existingPool &&
                  existingPool.genesisStatus === "collecting" &&
                  existingPool.myContribution &&
                  existingPool.myContribution > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleRefund}
                      disabled={refunding}
                      className="w-full sm:w-auto"
                    >
                      {refunding ? "Processing..." : "Refund My Contribution"}
                    </Button>
                  )}

                {existingPool && existingPool.genesisStatus !== "collecting" && (
                  <p className="text-sm text-muted-foreground">
                    This pool has launched. Trade on the{" "}
                    <a href={`/token/${selectedToken.symbol.toLowerCase()}`} className="underline text-primary">
                      token page
                    </a>
                    .
                  </p>
                )}

                {message && (
                  <p className={`text-sm ${message.includes("failed") || message.includes("Failed") ? "text-destructive" : "text-green-600"}`}>
                    {message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Protocol Rules Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How Genesis Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Total supply: 1,000,000,000 {selectedToken.symbol}ST tokens</p>
              <p>• At launch: 10 SOL + 800M tokens → permanent ORCA LP</p>
              <p>• Contributors receive 200M tokens pro-rata by SOL amount</p>
              <p>• Genesis tax: 95% → 10% over 85 minutes (all fees → LP)</p>
              <p>• Stable tax: 8% → LP buybacks + 2% → LQST buyback</p>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
