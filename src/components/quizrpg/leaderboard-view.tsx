"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Loader2, Star, Target, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ProfileDialog } from "@/components/quizrpg/profile-dialog";
import type { LeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

interface SubjectBoard {
  name: string;
  entries: LeaderboardEntry[];
}

interface CategoryBoard {
  id: string;
  name: string;
  entries: LeaderboardEntry[];
}

interface LeaderboardData {
  byScore: LeaderboardEntry[];
  byXp: LeaderboardEntry[];
  byAccuracy: LeaderboardEntry[];
  subjects: SubjectBoard[];
  categories: CategoryBoard[];
  totalPlayers: number;
}

function AccuracyBadge({ accuracy }: { accuracy?: number | null }) {
  if (accuracy == null) return null;
  const tone =
    accuracy >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : accuracy >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold", tone)}>
      <Target className="h-3 w-3" aria-hidden="true" />
      {accuracy}%
    </span>
  );
}

function EntryRow({ entry, me, metric, onView }: { entry: LeaderboardEntry; me: string; metric: "score" | "xp" | "accuracy"; onView: (userId: string) => void }) {
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
        {metric === "accuracy" ? (
          <>
            <p className="text-sm font-bold tabular-nums">{entry.accuracy}%</p>
            <AccuracyBadge accuracy={entry.accuracy} />
          </>
        ) : (
          <>
            <p className="text-sm font-bold tabular-nums">
              {metric === "score" ? `⭐ ${entry.bestScore}` : `✨ ${entry.xp}`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {metric === "score" ? `${entry.battlesWon} wins` : `${entry.battlesWon} wins · best streak ${entry.bestStreak}`}
            </p>
          </>
        )}
      </div>
    </motion.button>
  );
}

function BoardList({ entries, me, metric, onView, empty }: { entries: LeaderboardEntry[]; me: string; metric: "score" | "xp" | "accuracy"; onView: (id: string) => void; empty: string }) {
  if (entries.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      {entries.map((e) => <EntryRow key={e.userId} entry={e} me={me} metric={metric} onView={onView} />)}
    </>
  );
}

export function LeaderboardView() {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<LeaderboardData>("/api/leaderboard")
      .then((d) => {
        if (cancelled) return;
        setData(d);
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
  if (error || !data) {
    return <p className="py-16 text-center text-sm text-destructive">{error || "Failed to load leaderboard"}</p>;
  }

  const me = user?.id ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">🏆 Hall of Champions</h2>
        <p className="text-sm text-muted-foreground">Rankings across all {data.totalPlayers} registered players. Fight battles to climb!</p>
      </div>

      <Tabs defaultValue="score">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="score" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Scores</TabsTrigger>
          <TabsTrigger value="xp" className="gap-1.5"><Star className="h-3.5 w-3.5" /> XP</TabsTrigger>
          <TabsTrigger value="accuracy" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Accuracy</TabsTrigger>
          {data.subjects.map((s) => (
            <TabsTrigger key={`s-${s.name}`} value={`subject-${s.name}`} className="gap-1.5">
              📚 {s.name}
            </TabsTrigger>
          ))}
          {data.categories.map((c) => (
            <TabsTrigger key={`c-${c.id}`} value={`category-${c.id}`} className="gap-1.5">
              🗺️ {c.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="score" className="mt-3">
          <Card className="panel-frame">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Best single-battle scores</CardTitle>
              <CardDescription>Damage dealt + victory bonus + streak rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <BoardList entries={data.byScore} me={me} metric="score" onView={setViewingId} empty="No battles recorded yet. Be the first champion!" />
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
              <BoardList entries={data.byXp} me={me} metric="xp" onView={setViewingId} empty="No XP earned yet." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="mt-3">
          <Card className="panel-frame">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sharpest minds overall</CardTitle>
              <CardDescription>Correct answers ÷ every question answered, across all subjects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <BoardList entries={data.byAccuracy} me={me} metric="accuracy" onView={setViewingId} empty="No answers recorded yet." />
            </CardContent>
          </Card>
        </TabsContent>

        {data.subjects.map((s) => (
          <TabsContent key={`s-${s.name}`} value={`subject-${s.name}`} className="mt-3">
            <Card className="panel-frame">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Best in {s.name}</CardTitle>
                <CardDescription>Accuracy on {s.name} questions (min. 1 answered)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <BoardList entries={s.entries} me={me} metric="accuracy" onView={setViewingId} empty={`No one has answered a ${s.name} question yet.`} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {data.categories.map((c) => (
          <TabsContent key={`c-${c.id}`} value={`category-${c.id}`} className="mt-3">
            <Card className="panel-frame">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Masters of {c.name}</CardTitle>
                <CardDescription>Accuracy inside the {c.name} adventure (min. 1 answered)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <BoardList entries={c.entries} me={me} metric="accuracy" onView={setViewingId} empty={`No one has fought in ${c.name} yet.`} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <ProfileDialog userId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}
