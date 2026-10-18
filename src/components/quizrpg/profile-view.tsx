"use client";

import { useState } from "react";
import { Check, Loader2, LogOut, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/store";
import { StatBar } from "@/components/quizrpg/bits";
import { levelProgress } from "@/lib/game";
import type { SafeUser } from "@/lib/types";

export function ProfileView({ onStatsChanged }: { onStatsChanged: () => void }) {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refresh);
  const logout = useAuth((s) => s.logout);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // draft name while editing; falls back to the stored display name otherwise
  const name = editing ? (nameDraft ?? user?.displayName ?? "") : (user?.displayName ?? "");
  const setName = setNameDraft;

  if (!user) return null;
  const lp = levelProgress(user.xp);
  const winRate = user.battlesWon + user.battlesLost > 0
    ? Math.round((user.battlesWon / (user.battlesWon + user.battlesLost)) * 100)
    : null;

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api<{ user: SafeUser }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName: name.trim() }),
      });
      await refreshUser();
      setEditing(false);
      toast({ title: "Hero renamed!", description: `Hail, ${name.trim()}.` });
    } catch (err) {
      toast({ title: "Rename failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="font-display text-lg">🧙 Hero Profile</h2>

      {/* identity card */}
      <Card className="panel-frame">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary/10 text-5xl" aria-hidden="true">
            🧙
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Display name" />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => void saveName()} disabled={saving} aria-label="Save display name">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="truncate text-xl font-bold">{user.displayName}</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)} aria-label="Edit display name">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              @{user.username} · {user.role === "ADMIN" ? "🛡️ Game Master (admin)" : "⚔️ Player"}
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold">Level {lp.level}</span>
                <span className="tabular-nums text-muted-foreground">{lp.current} / {lp.needed} XP to level {lp.level + 1}</span>
              </div>
              <StatBar value={lp.current} max={lp.needed} kind="xp" showText={false} className="h-2.5" />
              <p className="text-[10px] text-muted-foreground">Total XP: {user.xp}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Battle Record</CardTitle>
          <CardDescription>Progress persists across sessions — your legend is saved.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{user.battlesWon}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Victories</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-destructive">{user.battlesLost}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Defeats</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">⭐ {user.bestScore}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Best score</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-2xl font-bold tabular-nums">🔥 {user.bestStreak}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Best streak</p>
            </div>
          </div>
          {winRate !== null && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Win rate</span>
                <span className="font-bold tabular-nums">{winRate}%</span>
              </div>
              <Progress value={winRate} className="h-2" aria-label={`Win rate ${winRate}%`} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* danger zone */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Sign out</p>
            <p className="text-xs text-muted-foreground">Your progress is saved automatically.</p>
          </div>
          <Button
            variant="destructive"
            className="gap-1.5"
            onClick={async () => {
              await logout();
              onStatsChanged();
            }}
          >
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
