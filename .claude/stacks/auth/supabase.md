---
assumes: [framework/nextjs]
packages:
  runtime: ["@supabase/supabase-js", "@supabase/ssr"]
  dev: []
files:
  - src/app/auth/callback/route.ts
  - src/app/auth/reset-password/page.tsx
  - src/app/signup/page.tsx  # conditional: only if "signup" in idea.yaml pages
  - src/app/login/page.tsx  # conditional: only if "login" in idea.yaml pages
  - src/components/nav-bar.tsx
  - src/lib/supabase-auth.ts  # conditional: only when stack.database is NOT supabase
  - src/lib/supabase-auth-server.ts  # conditional: only when stack.database is NOT supabase
env:
  server: []
  client: [NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY]
ci_placeholders:
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
clean:
  files: []
  dirs: []
gitignore: []
---
# Auth: Supabase Auth
> Used when idea.yaml has `stack.auth: supabase`
> Assumes: `framework/nextjs` (server-side auth check uses `NextResponse`)

## Packages
Shares the same packages as `database/supabase` — no additional installs needed when `stack.database` is also `supabase`.

If `stack.database` is NOT supabase, install:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Signup/Login UI
- Use Supabase Auth UI or simple email/password forms
- Signup page: email + password fields, submit button
- Login page: email + password fields, submit button, link to signup
- Enforce a minimum password length of 8 characters on the signup form
- Recommend enabling email verification in Supabase Dashboard (Authentication → Settings → Email Auth → "Confirm email")

## Files to Create

### `src/app/auth/callback/route.ts` — Auth callback handler (always created)

Exchanges PKCE authorization codes for sessions. Required for email confirmation auto-login, OAuth/social login, password reset, and magic link flows.

#### When `stack.database` is also `supabase` (shared client):
```ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

#### When `stack.database` is NOT supabase (standalone client):
Replace the import on line 2:
```ts
// Instead of: import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServerAuthClient as createServerSupabaseClient } from "@/lib/supabase-auth-server";
```
This aliasing keeps the rest of the route handler code identical — only the import changes.

### `src/app/auth/reset-password/page.tsx` — Reset password page (always created)

Lets the user set a new password after clicking the reset link from their email. The callback route exchanges the PKCE code and redirects here with an active session.

#### When `stack.database` is also `supabase` (shared client):
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    router.push("/");
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div>
        <Label htmlFor="password">New Password</Label>
        <Input id="password" type="password" placeholder="Min 8 characters"
          value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Updating..." : "Set new password"}
      </Button>
    </form>
  );
}
```

#### When `stack.database` is NOT supabase (standalone client):
Replace the import on line 5:
```tsx
// Instead of: import { createClient } from "@/lib/supabase";
import { createAuthClient as createClient } from "@/lib/supabase-auth";
```
The rest of the component code remains identical — only the import changes.

### `src/app/signup/page.tsx` — Signup page (if `signup` is in idea.yaml pages)

#### When `stack.database` is also `supabase` (shared client):
```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { trackSignupStart, trackSignupComplete } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      setLoading(false);
      return;
    }
    if (!data.session) {
      setSuccess("Check your email for a confirmation link to complete signup.");
      return;
    }
    trackSignupComplete({ method: "email" });
    router.push("/"); // Redirect to landing — bootstrap will update to the first non-auth page from idea.yaml
  }

  return success ? (
    <div className="space-y-4 text-center">
      <p className="text-green-600 font-medium">{success}</p>
      <p className="text-sm text-muted-foreground">
        Already confirmed? <Link href="/login" className="underline">Log in</Link>
      </p>
    </div>
  ) : (
    <form onSubmit={handleSignup} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" value={email}
          onChange={e => setEmail(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" placeholder="Min 8 characters" value={password}
          onChange={e => setPassword(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Creating account..." : "Sign up"}
      </Button>
    </form>
  );
}
```

#### When `stack.database` is NOT supabase (standalone client):
Replace the import on line 4 of the signup page:
```tsx
// Instead of: import { createClient } from "@/lib/supabase";
import { createAuthClient as createClient } from "@/lib/supabase-auth";
```
This aliasing keeps the rest of the component code identical — only the import changes.

- Adapt this pattern for your app — update imports, add fields, and adjust redirects
### `src/app/login/page.tsx` — Login page (if `login` is in idea.yaml pages)

Follows the same structure as the signup page above, with these differences:
- Calls `supabase.auth.signInWithPassword()` instead of `signUp()`
- No password minimum-length validation (existing accounts may have any length)
- No analytics events (EVENTS.yaml defines no login event)

#### When `stack.database` is also `supabase` (shared client):
```tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) { setError(authError.message); return; }
    router.push("/"); // Redirect to landing — bootstrap will update to the first non-auth page from idea.yaml
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
        <p className="text-green-600 font-medium text-center">
          Email confirmed! Please log in.
        </p>
      )}
      {authError && (
        <p className="text-red-500 font-medium text-center">
          Authentication failed. Please try logging in.
        </p>
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
                onChange={e => setEmail(e.target.value)} required />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" disabled={loading}>
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
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="flex justify-end">
            <button type="button" className="text-sm underline text-muted-foreground"
              onClick={() => { setForgotMode(true); setError(""); }}>
              Forgot password?
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don't have an account? <a href="/signup" className="underline">Sign up</a>
          </p>
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
```

> **Next.js 16 note:** `useSearchParams()` requires a `<Suspense>` boundary. The default export wraps the inner form component.

#### When `stack.database` is NOT supabase (standalone client):
Replace the import on line 5 of the login page:
```tsx
// Instead of: import { createClient } from "@/lib/supabase";
import { createAuthClient as createClient } from "@/lib/supabase-auth";
```
The rest of the component code (Suspense wrapper, confirmed banner, `createClient()` inside handler) remains identical.

### `src/components/nav-bar.tsx` — Auth-aware navigation (always created when `stack.auth: supabase`)

#### When `stack.database` is also `supabase` (shared client):
```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b">
      <Link href="/" className="text-xl font-bold">
        APP_NAME
      </Link>
      <div className="flex items-center gap-2">
        {/* Bootstrap adds page links here from idea.yaml pages */}
        {loading ? (
          <Button variant="outline" disabled className="min-w-[70px]">
            &nbsp;
          </Button>
        ) : user ? (
          <>
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {user.email}
            </span>
            <Button variant="outline" onClick={handleLogout}>
              Log out
            </Button>
          </>
        ) : (
          <Button variant="outline" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
```

#### When `stack.database` is NOT supabase (standalone client):
Replace the import on line 6:
```tsx
import { createAuthClient as createClient } from "@/lib/supabase-auth";
```

Notes:
- Bootstrap replaces `APP_NAME` with idea.yaml `name` and adds page-specific navigation links
- `getSession()` on mount sets initial auth state; `onAuthStateChange()` reacts to login/logout
- Loading state prevents flash of "Log in" button before auth state is known
- `router.refresh()` after logout clears server-side cached session data

## Client-Side Auth State
- The `NavBar` component (above) demonstrates the pattern: `getSession()` for initial state + `onAuthStateChange()` for reactive updates
- On login/signup success, redirect to the appropriate page
- Use the same pattern in any component that needs to react to auth changes

## Server-Side Auth Check
In API route handlers, verify the user session before processing the request. The import depends on whether `stack.database` is also `supabase`.

#### When `stack.database` is also `supabase` (shared client):
```ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// At the start of your route handler:
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// Use user.id for database queries and metadata
```

#### When `stack.database` is NOT supabase (standalone client):
```ts
import { NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase-auth-server";

// At the start of your route handler:
const supabase = await createServerAuthClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// Use user.id for database queries and metadata
```

## Analytics Integration
- Fire `signup_start` on form render (include `method` property: `"email"`, `"google"`, `"github"`)
- Fire `signup_complete` only when `data.session` exists after `signUp()` — when email confirmation is enabled (the default), `signUp()` returns `session: null` and the user must confirm their email before they're logged in. `signup_complete` should only fire for confirmed, logged-in users.

## OAuth / Social Login

The callback route (`src/app/auth/callback/route.ts`, created above) handles OAuth redirects — no additional route infrastructure is needed to add social login.

### Adding an OAuth provider button

Add this to your signup or login page alongside the existing email/password form:

```ts
async function handleOAuthLogin(provider: "google" | "github") {
  trackSignupStart({ method: provider });
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}
```

When the OAuth flow completes, Supabase redirects to `/auth/callback` with an authorization code. The callback route exchanges it for a session and redirects the user into the app.

### Analytics
- Fire `trackSignupStart({ method: "google" })` (or `"github"`) **before** the OAuth call — the redirect leaves the page, so this must fire first
- `signup_complete` fires automatically when the user lands back in the app with an active session (wire this in the destination page or via `onAuthStateChange`)

### PR instructions for enabling a provider
1. Go to **Supabase Dashboard → Authentication → Providers**
2. Enable the desired provider (e.g., Google)
3. Paste the **Client ID** and **Client Secret** from the provider's developer console (e.g., Google Cloud Console → APIs & Services → Credentials)
4. Set the authorized redirect URI in the provider's console to: `https://<supabase-ref>.supabase.co/auth/v1/callback`
5. No new env vars, packages, or deploy changes are needed — the callback route and redirect URL wildcard are already in place

## Shared Client Note
When `stack.auth` matches `stack.database` (both `supabase`), they share the same client files (`supabase.ts` and `supabase-server.ts`). When `stack.database` is absent or a different provider, auth needs its own library file — see "Standalone Client" below.

### Standalone Client (when `stack.database` is not supabase)

If `stack.database` is NOT supabase, the shared client files don't exist. Create auth-specific clients:

#### `src/lib/supabase-auth.ts` — Browser client for auth
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

#### `src/lib/supabase-auth-server.ts` — Server client for auth
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

Update signup/login page imports to use `createAuthClient` from `@/lib/supabase-auth` instead of `@/lib/supabase`.

## Environment Variables
When `stack.database` is also `supabase`, auth shares the database environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). No additional env vars needed.

When `stack.database` is NOT supabase, add these env vars for auth:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-api-key
```

## Production URL Configuration

After deploying to production, the Supabase project's auth settings must include the deployment URL for redirects to work correctly (email confirmations, password resets, OAuth callbacks).

The `/deploy` skill configures this automatically via the Supabase Management API:
```bash
curl -s -X PATCH "https://api.supabase.com/v1/projects/<ref>/config/auth" \
  -H "Authorization: Bearer <supabase-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"site_url": "https://<url>", "uri_allow_list": "https://<url>/**"}'
```

**Manual fallback:** Supabase Dashboard → Authentication → URL Configuration → set Site URL and add Redirect URLs.

> **Note:** The `uri_allow_list` wildcard (`https://<url>/**`) already covers `/auth/callback` — no additional deploy changes are needed when adding OAuth providers.

The `/deploy` skill also configures email subject lines in the same PATCH call, using the app's short title from idea.yaml (e.g., "Confirm your MyApp account"). This prevents default Supabase confirmation emails from looking like spam. To customize manually: Supabase Dashboard → Authentication → Email Templates.

The access token is read from `~/.supabase/access-token` (created by `supabase login`). If unavailable, generate one at supabase.com/dashboard/account/tokens.

## PR Instructions
- Email confirmation is enabled by default in Supabase. The signup form handles this: when `signUp()` returns `session: null`, it shows a "check your email" message instead of redirecting. Users who confirm their email can then log in normally.
- The signup form passes `emailRedirectTo` pointing to `/auth/callback`, which exchanges the PKCE code for a session and redirects to `/`. This requires the production URL to be in Supabase's redirect allow-list (configured by `/deploy`).
- The signup form detects duplicate emails by checking `data.user.identities` — when Supabase returns a user with zero identities, it means the email already exists. The form shows "An account with this email already exists" instead of the misleading "check your email" message.
- The login page includes a "Forgot password?" link that toggles an inline reset form. It calls `resetPasswordForEmail()` with a redirect to `/auth/callback?next=/auth/reset-password`. After clicking the email link, the callback route exchanges the code and redirects to the reset-password page where the user sets a new password.
- Test the signup flow end-to-end: create an account → see "check your email" message → confirm email → callback route exchanges code → auto-redirected into the app as a logged-in user
- Test duplicate email: sign up with an existing email → see "already exists" error instead of "check your email"
- Test forgot password: click "Forgot password?" on login → enter email → see "check your email for a reset link" → click link → land on reset-password page → set new password → redirected to app
- If the callback fails (expired or invalid code), the user is redirected to `/login?error=auth` and sees an error banner
