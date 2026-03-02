"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { trackSignupStart, trackSignupComplete } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { trackSignupStart({ method: "email" }); }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    if (data.user?.identities?.length === 0) {
      setError("An account with this email already exists. Please log in.");
      return;
    }
    if (!data.session) {
      setSuccess("Check your email for a confirmation link to complete signup.");
      return;
    }
    trackSignupComplete({ method: "email" });
    router.push("/explore");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your LQST account</CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4 text-center">
              <p className="text-green-600 font-medium">{success}</p>
              <p className="text-sm text-muted-foreground">
                Already confirmed?{" "}
                <Link href="/login" className="underline">Log in</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)} required className="text-base h-11 mt-1" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Min 8 characters" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={8} className="text-base h-11 mt-1" />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creating account..." : "Sign up"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="underline">Log in</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
