"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface STToken {
  id: string;
  symbol: string;
  name: string;
  baseTokenSymbol: string;
  baseTokenLogo?: string;
  genesisStatus: "collecting" | "launched" | "stable";
  genesisSOLRaised: number;
  genesisSOLTarget: number;
  launchedAt?: string;
  createdAt: string;
}

function StatusBadge({ status }: { status: STToken["genesisStatus"] }) {
  const styles = {
    collecting: "bg-yellow-100 text-yellow-800",
    launched: "bg-green-100 text-green-800",
    stable: "bg-blue-100 text-blue-800",
  };
  const labels = {
    collecting: "Collecting",
    launched: "Genesis Phase",
    stable: "Stable",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function ExplorePage() {
  const [tokens, setTokens] = useState<STToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tokens/list")
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => setTokens([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Explore ST Tokens</h1>
          <p className="text-muted-foreground text-base">
            All launched and collecting ST tokens on the LQST protocol.
          </p>
        </div>
        <Button asChild>
          <Link href="/create">+ Create</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading tokens...</p>
      ) : tokens.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              No ST tokens yet. Be the first to launch one.
            </p>
            <Button asChild>
              <Link href="/create">Launch ST Token</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((token) => {
            const progressPct = Math.min(
              (token.genesisSOLRaised / token.genesisSOLTarget) * 100,
              100
            );
            return (
              <Link key={token.id} href={`/token/${token.baseTokenSymbol.toLowerCase()}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      {token.baseTokenLogo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={token.baseTokenLogo}
                          alt={token.baseTokenSymbol}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{token.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          Base: {token.baseTokenSymbol}
                        </p>
                      </div>
                      <StatusBadge status={token.genesisStatus} />
                    </div>

                    {token.genesisStatus === "collecting" && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Genesis Progress</span>
                          <span>
                            {token.genesisSOLRaised.toFixed(2)}/{token.genesisSOLTarget} SOL
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {token.genesisStatus !== "collecting" && token.launchedAt && (
                      <p className="text-xs text-muted-foreground">
                        Launched {new Date(token.launchedAt).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
