"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Loader2, Search, Star, Target, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ProfileDialog } from "@/components/quizrpg/profile-dialog";
import type { LeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

type Metric = "score" | "xp" | "accuracy";

/** Every scope (overall / category / subject) carries the same three boards. */
interface ScopeBoards {
  byScore: LeaderboardEntry[];
  byXp: LeaderboardEntry[];
  byAccuracy: LeaderboardEntry[];
}

interface CategoryBoard extends ScopeBoards {
  id: string;
  name: string;
}

interface SubjectBoard extends ScopeBoards {
  name: string;
}

interface LeaderboardData {
  overall: ScopeBoards;
  categories: CategoryBoard[];
  subjects: SubjectBoard[];
  totalPlayers: number;
}

/** Which level of the ladder is being viewed, plus the chosen category/subject. */
type Level = "overall" | "category" | "subject";

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

function EntryRow({
  entry,
  me,
  metric,
  onView,
}: {
  entry: LeaderboardEntry;
  me: string;
  metric: Metric;
  onView: (userId: string) => void;
}) {
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
            <p className="text-[10px] tabular-nums text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">{entry.questionsRight}✓</span>
              {" / "}
              <span className="text-destructive">{entry.questionsWrong}✗</span>
            </p>
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

function BoardList({
  entries,
  me,
  metric,
  onView,
  empty,
}: {
  entries: LeaderboardEntry[];
  me: string;
  metric: Metric;
  onView: (id: string) => void;
  empty: string;
}) {
  if (entries.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      {entries.map((e) => (
        <EntryRow key={e.userId} entry={e} me={me} metric={metric} onView={onView} />
      ))}
    </>
  );
}

const METRICS: { id: Metric; label: string; icon: React.ReactNode }[] = [
  { id: "score", label: "Scores", icon: <Trophy className="h-3.5 w-3.5" /> },
  { id: "xp", label: "XP", icon: <Star className="h-3.5 w-3.5" /> },
  { id: "accuracy", label: "Accuracy", icon: <Target className="h-3.5 w-3.5" /> },
];

const LEVELS: { id: Level; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "category", label: "Category" },
  { id: "subject", label: "Subject" },
];

export function LeaderboardView() {
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  /** overall → pick a category → pick a subject (the deepest level) */
  const [level, setLevel] = useState<Level>("overall");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subjectName, setSubjectName] = useState<string>("");
  const [metric, setMetric] = useState<Metric>("score");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<LeaderboardData>("/api/leaderboard")
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setCategoryId((prev) => prev || d.categories[0]?.id || "");
        setSubjectName((prev) => prev || d.subjects[0]?.name || "");
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

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.categories;
    return data.categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [data, search]);

  const filteredSubjects = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.subjects;
    return data.subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [data, search]);

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
  const activeCategory = data.categories.find((c) => c.id === categoryId) ?? data.categories[0] ?? null;
  const activeSubject = data.subjects.find((s) => s.name === subjectName) ?? data.subjects[0] ?? null;

  const boards: ScopeBoards =
    level === "overall"
      ? data.overall
      : level === "category"
        ? activeCategory ?? { byScore: [], byXp: [], byAccuracy: [] }
        : activeSubject ?? { byScore: [], byXp: [], byAccuracy: [] };

  const entries = metric === "score" ? boards.byScore : metric === "xp" ? boards.byXp : boards.byAccuracy;

  const title =
    level === "overall"
      ? "Overall rankings"
      : level === "category"
        ? `${activeCategory?.name ?? "Category"} rankings`
        : `${activeSubject?.name ?? "Subject"} rankings`;

  const emptyText =
    level === "overall"
      ? "Nobody has recorded results yet. Be the first champion!"
      : level === "category"
        ? `No one has answered a question in ${activeCategory?.name ?? "this category"} yet.`
        : `No one has answered a ${activeSubject?.name ?? "subject"} question yet.`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">🏆 Hall of Champions</h2>
        <p className="text-sm text-muted-foreground">
          Rankings across all {data.totalPlayers} registered players. Drill down from overall, into a category, then
          into a subject - the deepest level.
        </p>
      </div>

      {/* level: overall / category / subject + search */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex rounded-lg border border-border p-0.5">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                aria-pressed={level === l.id}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  level === l.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-44 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={level === "subject" ? "Search subjects…" : "Search categories…"}
              className="pl-8 text-xs"
              aria-label={level === "subject" ? "Search subjects" : "Search categories"}
              disabled={level === "overall"}
            />
          </div>
        </CardContent>
      </Card>

      {/* category / subject picker */}
      {level !== "overall" && (
        <div className="flex flex-wrap gap-1.5">
          {level === "category"
            ? filteredCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={activeCategory?.id === c.id}
                  className={cn(
                    "rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeCategory?.id === c.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-accent",
                  )}
                >
                  🗺️ {c.name}
                </button>
              ))
            : filteredSubjects.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSubjectName(s.name)}
                  aria-pressed={activeSubject?.name === s.name}
                  className={cn(
                    "rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeSubject?.name === s.name
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-accent",
                  )}
                >
                  📚 {s.name}
                </button>
              ))}
          {(level === "category" ? filteredCategories : filteredSubjects).length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No {level === "category" ? "categories" : "subjects"} match &ldquo;{search}&rdquo;.
            </p>
          )}
        </div>
      )}

      {/* metric switcher - the same three at every level */}
      <div className="flex rounded-lg border border-border p-0.5">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            aria-pressed={metric === m.id}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              metric === m.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <Card className="panel-frame">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <CardDescription>
            {metric === "score" && "Best single-battle score"}
            {metric === "xp" && "Total XP earned"}
            {metric === "accuracy" && "Correct ÷ every question answered in this scope"}
            {level !== "overall" && " · score and XP show lifetime totals"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <BoardList
            entries={entries}
            me={me}
            metric={metric}
            onView={setViewingId}
            empty={emptyText}
          />
        </CardContent>
      </Card>

      <ProfileDialog userId={viewingId} onClose={() => setViewingId(null)} />
    </div>
  );
}
