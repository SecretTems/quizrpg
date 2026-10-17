"use client";

import { useState } from "react";
import { Swords, LibraryBig, Trophy, UserRound, ShieldCheck, Sun, Moon, ScrollText } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/store";
import { levelProgress } from "@/lib/game";
import { ArenaView } from "@/components/quizrpg/arena-view";
import { QuestionBankView } from "@/components/quizrpg/question-bank-view";
import { LeaderboardView } from "@/components/quizrpg/leaderboard-view";
import { ProfileView } from "@/components/quizrpg/profile-view";
import { AdminView } from "@/components/quizrpg/admin-view";
import { HowToPlayDialog } from "@/components/quizrpg/how-to-play";

type Tab = "arena" | "bank" | "leaderboard" | "profile" | "admin";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "arena", label: "Arena", icon: <Swords className="h-4 w-4" /> },
  { id: "bank", label: "Bank", icon: <LibraryBig className="h-4 w-4" /> },
  { id: "leaderboard", label: "Ranks", icon: <Trophy className="h-4 w-4" /> },
  { id: "profile", label: "Profile", icon: <UserRound className="h-4 w-4" /> },
];

export function AppShell() {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refresh);
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("arena");

  if (!user) return null;
  const lp = levelProgress(user.xp);
  const tabs = user.role === "ADMIN" ? [...TABS, { id: "admin" as Tab, label: "Admin", icon: <ShieldCheck className="h-4 w-4" /> }] : TABS;

  function handleStatsChanged() {
    void refreshUser();
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <button className="flex items-center gap-2" onClick={() => setTab("arena")} aria-label="Go to arena">
            <Swords className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-display text-sm text-primary">QUIZRPG</span>
          </button>

          {/* desktop nav */}
          <nav className="ml-4 hidden gap-1 sm:flex" aria-label="Main navigation">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-full border border-[var(--xp)]/40 bg-[color-mix(in_oklab,var(--xp)_12%,transparent)] px-3 py-1 text-xs font-bold tabular-nums sm:flex"
              title={`${lp.current}/${lp.needed} XP to next level`}
            >
              ✨ Lv {lp.level}
            </span>
            <HowToPlayDialog>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="How to play">
                <ScrollText className="h-4 w-4" />
              </Button>
            </HowToPlayDialog>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Toggle light or dark mode"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="border-t border-border sm:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-5xl grid-cols-5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition-colors",
                  tab === t.id ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {tab === "arena" && <ArenaView onStatsChanged={handleStatsChanged} />}
        {tab === "bank" && <QuestionBankView />}
        {tab === "leaderboard" && <LeaderboardView />}
        {tab === "profile" && <ProfileView onStatsChanged={handleStatsChanged} />}
        {tab === "admin" && user.role === "ADMIN" && <AdminView />}
      </main>

      {/* footer sticks to bottom */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-3 text-center text-xs text-muted-foreground">
          QUIZRPG — An Interactive Gaming Quiz System for Enhancing Student Learning and Engagement
        </div>
      </footer>
    </div>
  );
}
