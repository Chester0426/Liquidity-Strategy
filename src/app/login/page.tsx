"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmed = searchParams.get("confirmed") === "true";
  const authError = searchParams.get("error") === "auth";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authErr) { setError(authErr.message); return; }
    router.push("/explore");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setForgotSent(true);
  }

  return (
    <div className="space-y-4">
      {confirmed && (
        <p className="text-green-600 font-medium text-center">Email confirmed! Please log in.</p>
      )}
      {authError && (
        <p className="text-destructive font-medium text-center">Authentication failed. Please try again.</p>
      )}
      {forgotMode ? (
        forgotSent ? (
          <div className="space-y-4 text-center">
            <p className="text-green-600 font-medium">Check your email for a reset link.</p>
            <button type="button" className="text-sm underline text-muted-foreground"
              onClick={() => { setForgotMode(false); setForgotSent(false); }}>
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} required className="text-base h-11 mt-1" />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send reset link"}
            </Button>
            <button type="button" className="text-sm underline text-muted-foreground block"
              onClick={() => { setForgotMode(false); setError(""); }}>
              Back to login
            </button>
          </form>
        )
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)} required className="text-base h-11 mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required className="text-base h-11 mt-1" />
          </div>
          <div className="flex justify-end">
            <button type="button" className="text-sm underline text-muted-foreground"
              onClick={() => { setForgotMode(true); setError(""); }}>
              Forgot password?
            </button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="underline">Sign up</a>
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in to LQST</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
