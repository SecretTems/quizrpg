"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HowToPlayDialog({
  children,
  open = false,
  onOpenChange,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">📜 How to Play</DialogTitle>
          <DialogDescription>QUIZRPG turns your study reviewers into turn-based RPG battles.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <section>
            <h4 className="mb-1 font-bold">⚔️ The Battle Loop</h4>
            <p className="text-muted-foreground">
              Pick a subject and an enemy. Each round you get a question with a <b>30-second timer</b>.
              Answer correctly to strike the enemy; answer wrong (or run out of time) and the enemy strikes back.
              Reduce its HP to zero before yours hits zero.
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">💥 Damage Formula</h4>
            <p className="text-muted-foreground">
              Base damage depends on difficulty — <b>Easy 14</b>, <b>Medium 20</b>, <b>Hard 28</b> — plus a
              <b> +3 streak bonus</b> for each consecutive correct answer (max +15). At a 3+ streak, hits have a
              chance to <b>CRIT for 1.5× damage</b>. Keep the flame alive!
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">✨ Experience & Levels</h4>
            <p className="text-muted-foreground">
              Correct answers earn 10–30 XP (difficulty-based, plus streak bonuses). Victories grant a big XP bonus.
              Leveling up increases your max HP and <b>unlocks harder enemy tiers</b>: Rune Golem (Lv 3),
              Cipher Wraith (Lv 5), and the Quiz Dragon (Lv 8).
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">📚 Your Question Bank</h4>
            <p className="text-muted-foreground">
              Build your own reviewers per subject with any difficulty mix. Your questions are mixed into your
              battles together with the global bank — studying your own notes literally powers your attacks.
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">🏆 Leaderboard & Saving</h4>
            <p className="text-muted-foreground">
              Compete for the best single-battle score and the most total XP. HP, XP, scores and streaks are saved
              automatically — leave and resume anytime, even mid-battle.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
