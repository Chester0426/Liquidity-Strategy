"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function shortAddress(pubkey: string) {
  return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
}

export function NavBar() {
  const { publicKey, connecting, connected, disconnect, select, wallets } = useWallet();
  const [showWalletList, setShowWalletList] = useState(false);

  const handleConnect = useCallback(() => {
    setShowWalletList(true);
  }, []);

  const handleSelectWallet = useCallback(
    (walletName: string) => {
      const w = wallets.find((x) => x.adapter.name === walletName);
      if (w) {
        select(w.adapter.name);
        setShowWalletList(false);
      }
    },
    [wallets, select]
  );

  return (
    <>
      <nav className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="text-xl font-bold text-primary">
          LQST
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Explore
          </Link>
          <Link href="/create" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Create
          </Link>
          <Link href="/revenue" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Revenue
          </Link>

          {connecting ? (
            <Button variant="outline" disabled className="min-w-[140px]">
              Connecting...
            </Button>
          ) : connected && publicKey ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[120px] font-mono text-sm">
                  {shortAddress(publicKey.toString())}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(publicKey.toString())}
                  className="cursor-pointer"
                >
                  Copy address
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => disconnect()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleConnect} className="min-w-[140px]">
              Connect Wallet
            </Button>
          )}
        </div>
      </nav>

      {/* Wallet selection modal */}
      {showWalletList && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowWalletList(false)}
        >
          <div
            className="bg-card border rounded-xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Connect a wallet</h2>
            <div className="space-y-2">
              {wallets.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No wallets detected. Install{" "}
                  <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                    Phantom
                  </a>{" "}
                  or{" "}
                  <a href="https://solflare.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                    Solflare
                  </a>{" "}
                  to continue.
                </p>
              )}
              {wallets.map((wallet) => (
                <button
                  key={wallet.adapter.name}
                  onClick={() => handleSelectWallet(wallet.adapter.name)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                >
                  {wallet.adapter.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="w-8 h-8 rounded-md" />
                  )}
                  <span className="font-medium">{wallet.adapter.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">
                    {wallet.readyState}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setShowWalletList(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
