import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { RetainTracker } from "@/components/RetainTracker";
import { SolanaWalletProvider } from "@/components/SolanaWalletProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "LQST — Liquidity Strategy",
  description:
    "LP-backed yield protocol. Launch ST tokens backed by real market-making liquidity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body>
        <SolanaWalletProvider>
          <NavBar />
          <RetainTracker />
          {children}
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
