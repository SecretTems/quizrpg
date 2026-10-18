"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/game";

/* ---------- animated HP / XP bar ---------- */

export function StatBar({
  value,
  max,
  kind,
  className,
  showText = true,
}: {
  value: number;
  max: number;
  kind: "hp" | "enemy" | "xp";
  className?: string;
  showText?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const barColor =
    kind === "hp"
      ? "bg-[var(--hp)]"
      : kind === "enemy"
        ? "bg-destructive"
        : "bg-[var(--xp)]";
  return (
    <div className={cn("relative h-4 w-full overflow-hidden rounded-full border border-border bg-black/20", className)}>
      <motion.div
        className={cn("h-full rounded-full transition-colors", barColor)}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
      {showText && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
          {Math.round(value)} / {max}
        </span>
      )}
    </div>
  );
}

/* ---------- difficulty badge ---------- */

const DIFF_STYLES: Record<Difficulty, string> = {
  EASY: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/40",
  MEDIUM: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/40",
  HARD: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/40",
  EXPERT: "bg-violet-600/15 text-violet-700 dark:text-violet-400 border-violet-600/40",
  MASTER: "bg-fuchsia-600/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-600/40",
};

const DIFF_LABEL: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  EXPERT: "Expert",
  MASTER: "Master",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        DIFF_STYLES[difficulty],
        className,
      )}
    >
      {DIFF_LABEL[difficulty]}
    </span>
  );
}

/* ---------- subject chip ---------- */

const SUBJECT_ICONS: Record<string, string> = {
  Mathematics: "🔢",
  Science: "🔬",
  History: "🏛️",
  English: "📚",
  Programming: "💻",
  Filipino: "🇵🇭",
  "Araling Panlipunan": "🌏",
  Edukasyon: "🧭",
  Custom: "🧩",
};

export function subjectIcon(subject: string): string {
  return SUBJECT_ICONS[subject] ?? "📖";
}

/* ---------- small stat ---------- */

export function StatChip({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
      <span className="mt-1 text-sm font-bold tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/* ---------- question status badge ---------- */

export function StatusBadge({ status }: { status: "OFFICIAL" | "CUSTOM" | "PENDING" | "REJECTED" }) {
  const map: Record<string, { label: string; cls: string }> = {
    OFFICIAL: { label: "★ Official", cls: "bg-sky-600/15 text-sky-700 dark:text-sky-400 border-sky-600/40" },
    CUSTOM: { label: "🧩 Custom", cls: "bg-slate-600/15 text-slate-700 dark:text-slate-400 border-slate-600/40" },
    PENDING: { label: "⏳ Pending", cls: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/40" },
    REJECTED: { label: "✖ Rejected", cls: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/40" },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold", s.cls)}>{s.label}</span>
  );
}
