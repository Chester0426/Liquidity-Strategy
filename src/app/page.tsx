"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trackVisitLanding } from "@/lib/events";

export default function LandingPage() {
  useEffect(() => {
    trackVisitLanding({
      referrer: document.referrer || undefined,
      utm_source: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
      utm_medium: new URLSearchParams(window.location.search).get("utm_medium") ?? undefined,
      utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
    });
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="py-16 px-4 text-center md:py-32 md:px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Launch Tokens Backed by Real Liquidity
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            LQST replaces empty vaults with ORCA LP positions. Every ST token is
            backed by protocol-owned liquidity that generates real yield — no
            VE-model required.
          </p>
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/create">Launch Your ST Token</Link>
          </Button>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-12 px-4 bg-muted/30 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl mb-2">🔒</p>
                <p className="text-base font-medium">VE-model locks out MEME tokens from yield protocols</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl mb-2">📉</p>
                <p className="text-base font-medium">Token vaults hold nothing — no real backing, no yield floor</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl mb-2">💸</p>
                <p className="text-base font-medium">Liquidity disappears after launch — no protocol-owned depth</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-4 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mx-auto mb-3">
                1
              </div>
              <h3 className="font-semibold mb-1">Genesis Pool</h3>
              <p className="text-base text-muted-foreground">
                Contributors pool 10 SOL. Anyone can join. The pool launches
                automatically when the target is reached.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mx-auto mb-3">
                2
              </div>
              <h3 className="font-semibold mb-1">LP-Backed Launch</h3>
              <p className="text-base text-muted-foreground">
                10 SOL + 80% of ST tokens seed a permanent ORCA LP. Contributors
                receive 20% of tokens pro-rata.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mx-auto mb-3">
                3
              </div>
              <h3 className="font-semibold mb-1">Decaying Tax & Yield</h3>
              <p className="text-base text-muted-foreground">
                95% → 10% tax over 85 minutes deepens the LP. Market-making
                fees flow back as ST buybacks forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 px-4 bg-muted/30 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">Protocol Features</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">High-Fee DEX</h3>
                <p className="text-base text-muted-foreground">
                  Decaying Tax generates maximum protocol revenue during the
                  critical launch window.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">Protocol-Owned Liquidity</h3>
                <p className="text-base text-muted-foreground">
                  Genesis LP is permanently locked. The protocol accumulates
                  depth with every trade.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">Universal Token Support</h3>
                <p className="text-base text-muted-foreground">
                  Any token — including MEME coins — can launch an ST. One
                  genesis pool per token, forever.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">Fee Distribution & Buybacks</h3>
                <p className="text-base text-muted-foreground">
                  8% of stable-phase fees buy back ST tokens. 2% buys back
                  LQST. LP yield compounds forever.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">Native Trading Interface</h3>
                <p className="text-base text-muted-foreground">
                  Built-in Pump-style buy/sell UI. No external DEX needed to
                  trade during the genesis phase.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-1">PUMPST Flagship</h3>
                <p className="text-base text-muted-foreground">
                  PumpST is the first ST under LQST — co-launched with the
                  Pump.fun community as the flagship product.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Repeat */}
      <section className="py-12 px-4 text-center sm:py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4">
            Ready to launch your ST token?
          </h2>
          <p className="text-muted-foreground mb-6">
            No coding required. No VE-model needed. Just 10 SOL of genesis
            liquidity.
          </p>
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/create">Launch Your ST Token</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-3">
            Instant refunds available before launch threshold
          </p>
        </div>
      </section>
    </main>
  );
}
