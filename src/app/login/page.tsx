import { redirect } from "next/navigation";

// Email auth has been replaced by Solana wallet connection.
// Users connect via Phantom, Solflare, or Backpack from the NavBar.
export default function LoginPage() {
  redirect("/");
}
