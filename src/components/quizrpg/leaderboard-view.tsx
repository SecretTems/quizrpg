"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Loader2, Star, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/store";
import { api } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ProfileDialog } from "@/components/quizrpg/profile-dialog";
import type { LeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

function EntryRow({ entry, me, metric, onView }: { entry: LeaderboardEntry; me: string; metric: "score" | "xp"; onView: (userId: string) => void }) {
  const isMe = entry.userId === me;
  return (
    <motion.button
      type="button"
      onClick={() => onView(entry.userId)}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent",
        isMe ? "border-primary/60 bg-primary/10" : "border-border bg-card/60",
      )}
      aria-label={`View ${entry.displayName}'s profile`}
    >
      <span className="flex w-8 shrink-0 items-center justify-center text-sm font-bold tabular-nums">
        {entry.rank <= 3 ? <span className="text-lg" aria-hidden="true">{MEDALS[entry.rank - 1]}</span> : `#${entry.rank}`}
      </span>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/50 text-lg" aria-hidden="true">
        {entry.avatar ? (
          <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{isMe ? "🧙" : "🧑‍🎓"}</span>
        )}
        {entry.rank === 1 && <Crown className="absolute -top-2 h-4 w-4 text-[var(--xp)]" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">
          {entry.displayName}
          {isMe && <span className="ml-1.5 rounded bg-primary/20 px-1 py-0.5 text-[10px] font-bold uppercase text-primary">You</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">@{entry.username} · Lv {entry.level}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums">
          {metric === "score" ? `⭐ ${entry.bestScore}` : `✨ ${entry.xp}`}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {metric === "score" ? `${entry.battlesWon} wins` : `${entry.battlesWon} wins · best streak ${entry.bestStreak}`}
        </p>
      </div>
    </motion.button>
  );
}

export function LeaderboardView() {
  const user = useAuth((s) => s.user);
  const [byScore, setByScore] = useState<LeaderboardEntry[]>([]);
  const [byXp, setByXp] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ byScore: LeaderboardEntry[]; byXp: LeaderboardEntry[]; totalPlayers: number }>("/api/leaderboard")
      .then((d) => {
        if (cancelled) return;
        setByScore(d.byScore);
        setByXp(d.byXp);
        setTotalPlayers(d.totalPlayers);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load leaderboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <p className="py-16 text-center text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">🏆 Hall of Champions</h2>
        <p className="text-sm text-muted-foreground">Rankings across all {totalPlayers} registered players. Fight battles to climb!</p>
      </div>

      <Tabs defaultValue="score">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="score" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Top Scores</TabsTrigger>
          <TabsTrigger value="xp" className="gap-1.5"><Star className="h-3.5 w-3.5" /> Top XP</TabsTrigger>
        </TabsList>
        <TabsContent value="score" className="mt-3">
          <Card className="panel-frame">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Best single-battle scores</CardTitle>
              <CardDescription>Damage dealt + victory bonus + streak rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {byScore.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No battles recorded yet. Be the first champion!</p>}
              {byScore.map((e) => <EntryRow key={e.userId} entry={e} me={user?.id ?? ""} metric="score" onView={setViewingId} />)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="xp" className="mt-3">
          <Card className="panel-frame">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Most experienced scholars</CardTitle>
              <CardDescription>Total XP from every correct answer and victory</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {byXp.map((e) => <EntryRow key={e.userId} entry={e} me={user?.id ?? ""} metric="xp" onView={setViewingId} />)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ProfileDialog userId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}
