"use client";

import { useState } from "react";
import { Loader2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";
import type { NormalizedUser } from "@/lib/models";

interface DailyBonusViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

interface ClaimResult {
  gemsEarned: number;
  rewards: string[];
  dailyStreak: number;
}

export function DailyBonusView({ open, onOpenChange, user, onRefresh }: DailyBonusViewProps) {
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState("");

  const todayKey = new Date().toDateString();
  const claimedToday = user?.lastDailyClaimAt
    ? new Date(user.lastDailyClaimAt).toDateString() === todayKey
    : false;
  const streak = user?.dailyStreak ?? 0;

  const claim = async () => {
    setClaiming(true);
    setError("");
    try {
      const res = await api<{ ok: true; gemsEarned: number; rewards: string[]; dailyStreak: number }>("/api/daily", {
        method: "POST",
      });
      setResult({ gemsEarned: res.gemsEarned, rewards: res.rewards, dailyStreak: res.dailyStreak });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim bonus.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" /> Daily login bonus
          </DialogTitle>
          <DialogDescription>
            Show up every day for gems. Rewards: 1 gem per day, +5 gems every 7-day streak, and +50 gems for a full
            month without a miss.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-center">
            <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">💎 +{result.gemsEarned}</p>
            <div className="space-y-1">
              {result.rewards.map((r) => (
                <p key={r} className="text-sm font-semibold">{r}</p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Streak: {result.dailyStreak} day{result.dailyStreak === 1 ? "" : "s"}</p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Come back tomorrow!</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <span>Current streak</span>
              <span className="font-bold">🔥 {streak} day{streak === 1 ? "" : "s"}</span>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full gap-1.5" disabled={claiming || claimedToday} onClick={() => void claim()}>
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {claimedToday ? "Already claimed today" : "Claim today's bonus"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Missing a day resets your streak to 1. Streak milestones: every 7 days +5 gems, 30 days straight +50 gems.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
