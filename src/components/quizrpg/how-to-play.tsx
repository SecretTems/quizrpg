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
            <h4 className="mb-1 font-bold">🗺️ Categories &amp; Adventures</h4>
            <p className="text-muted-foreground">
              Battles live inside <b>categories</b> - each one is a themed adventure (like Hololive) with its own
              subjects, monsters and question pool. Pick a category in the Play menu, choose a difficulty, and fight
              through its monster lineup one enemy at a time. Official categories are curated by staff; you can also
              build your own with the Category Maker.
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">⚔️ The Battle Loop</h4>
            <p className="text-muted-foreground">
              Each round you get a question with its own timer (set by the question's author). Answer correctly to
              strike the monster; answer wrong or run out of time and the monster strikes back. Reduce its HP to zero
              before yours hits zero, then the next monster in the lineup steps up. Clear them all to win the
              adventure!
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">💥 Damage &amp; Streaks</h4>
            <p className="text-muted-foreground">
              Base damage depends on difficulty - <b>Easy 14</b>, <b>Medium 20</b>, <b>Hard 28</b> - plus a{" "}
              <b>+3 streak bonus</b> per consecutive correct answer (max +15). At a 3+ streak, hits have a chance to{" "}
              <b>CRIT for 1.5× damage</b>. Keep the flame alive!
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">👾 Monster Modifiers</h4>
            <p className="text-muted-foreground">
              Some monsters come with nasty tricks: <b>Tax Collecting</b> (steals coins as you take time), <b>Shuffler</b>{" "}
              (shuffles your answers), <b>Resting</b> (heals when you miss), <b>Restraint</b> (blocks item use) and{" "}
              <b>Disabler</b> (disables equipment stats). Read the monster's stats before you engage!
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">🎒 Equipment &amp; Items</h4>
            <p className="text-muted-foreground">
              Gear up in the <b>Shop</b> and manage everything in <b>Equipment</b>. You have one weapon, armor and
              accessory slot, plus <b>3 inventory slots</b> for consumables like potions, bombs and hints - pick them
              before battle and use them mid-fight. Gear wears down with use, so repair or replace it before it
              breaks!
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">🎰 Gacha &amp; Daily Bonus</h4>
            <p className="text-muted-foreground">
              Spend coins at the <b>Gacha</b> for a chance at rare and legendary gear - higher rarities are capped
              (5× rare, 3× epic, 1× legendary). Log in every day for the <b>Daily Bonus</b>: coins that scale with
              your streak.
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">✨ Experience &amp; Levels</h4>
            <p className="text-muted-foreground">
              Correct answers earn 10-30 XP (difficulty-based, plus streak bonuses). Victories grant a big XP bonus,
              coins, and a shot at loot. Leveling up increases your max HP and unlocks tougher content.
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">📚 Your Question Bank</h4>
            <p className="text-muted-foreground">
              Build your own reviewers with any difficulty mix and per-question timers. Your questions are mixed into
              battles of categories you own, together with that category's pool - studying your own notes literally
              powers your attacks. Submit great questions to the staff for <b>approval to become official</b>.
            </p>
          </section>
          <section>
            <h4 className="mb-1 font-bold">🏆 Leaderboard &amp; Saving</h4>
            <p className="text-muted-foreground">
              Compete for the best single-battle score and the most total XP. Tap a player to view their profile.
              HP, XP, scores and streaks are saved automatically - leave and resume anytime, even mid-battle.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
