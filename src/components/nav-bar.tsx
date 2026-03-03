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
