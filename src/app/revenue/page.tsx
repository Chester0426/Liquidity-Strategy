"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface RevenueData {
  totalFeesCollected: number;
  lqstBuybacks: number;
  stBuybacks: number;
  totalTrades: number;
  totalVolume: number;
  recentBuybacks: {
    id: string;
    targetToken: string;
    solSpent: number;
    tokensBought: number;
    createdAt: string;
  }[];
  recentTrades: {
    id: string;
    stTokenName: string;
    direction: "buy" | "sell";
    solAmount: number;
    taxRate: number;
    isGenesisPhase: boolean;
    feeToLp: number;
    feeToLqst: number;
    createdAt: string;
  }[];
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/revenue")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-muted-foreground">Loading revenue data...</p>
      </main>
    );
  }

  const d = data ?? {
    totalFeesCollected: 0,
    lqstBuybacks: 0,
    stBuybacks: 0,
    totalTrades: 0,
    totalVolume: 0,
    recentBuybacks: [],
    recentTrades: [],
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold mb-2">Platform Revenue</h1>
      <p className="text-muted-foreground mb-6 text-base">
        Protocol fees, buyback history, and treasury overview for the LQST platform.
      </p>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Fees Collected</p>
            <p className="text-2xl font-bold mt-1">{d.totalFeesCollected.toFixed(4)} SOL</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">LQST Buybacks</p>
            <p className="text-2xl font-bold mt-1">{d.lqstBuybacks.toFixed(4)} SOL</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">ST Buybacks</p>
            <p className="text-2xl font-bold mt-1">{d.stBuybacks.toFixed(4)} SOL</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Trades</p>
            <p className="text-2xl font-bold mt-1">{d.totalTrades.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Volume</p>
            <p className="text-2xl font-bold mt-1">{d.totalVolume.toFixed(4)} SOL</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Fee Distribution</p>
            <p className="text-base font-medium mt-1">Stable: 8% LP + 2% LQST</p>
            <p className="text-xs text-muted-foreground">Genesis: 100% LP</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Buybacks */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recent Buybacks</CardTitle>
        </CardHeader>
        <CardContent>
          {d.recentBuybacks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No buybacks yet.</p>
          ) : (
            <div className="space-y-3">
              {d.recentBuybacks.map((b) => (
                <div key={b.id}>
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{b.targetToken}</span>
                      <span className="text-muted-foreground ml-2">buyback</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{b.solSpent.toFixed(4)} SOL spent</p>
                      <p className="text-xs text-muted-foreground">
                        {b.tokensBought.toLocaleString()} tokens bought
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString()}
                  </p>
                  <Separator className="mt-3" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          {d.recentTrades.length === 0 ? (
            <p className="text-muted-foreground text-sm">No trades yet.</p>
          ) : (
            <div className="space-y-3">
              {d.recentTrades.map((t) => (
                <div key={t.id}>
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{t.stTokenName}</span>
                      <span
                        className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                          t.direction === "buy"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {t.direction.toUpperCase()}
                      </span>
                      {t.isGenesisPhase && (
                        <span className="ml-1 text-xs text-amber-600">genesis</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{t.solAmount.toFixed(4)} SOL</p>
                      <p className="text-xs text-muted-foreground">
                        {t.taxRate}% tax · {t.feeToLp.toFixed(4)} → LP
                        {!t.isGenesisPhase && ` · ${t.feeToLqst.toFixed(4)} → LQST`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                  <Separator className="mt-3" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
