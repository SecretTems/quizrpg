"use client";

import { useEffect } from "react";
import { Loader2, Swords } from "lucide-react";
import { useAuth } from "@/lib/store";
import { AuthScreen } from "@/components/quizrpg/auth-screen";
import { AppShell } from "@/components/quizrpg/app-shell";

export default function Home() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const refresh = useAuth((s) => s.refresh);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        /* session check is best-effort */
      }
    })();
    void cancelled;
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Swords className="h-10 w-10 animate-pulse text-primary" aria-hidden="true" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Entering the realm…
        </div>
      </div>
    );
  }

  return user ? <AppShell /> : <AuthScreen />;
}
