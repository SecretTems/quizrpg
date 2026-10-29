"use client";

import { motion } from "framer-motion";
import { BookOpen, Swords, ShieldCheck, Sparkles, ScrollText, Trophy, Users, KeyRound, Timer, MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES: { icon: React.ReactNode; title: string; text: string }[] = [
  {
    icon: <Swords className="h-4 w-4" />,
    title: "Turn-based quiz battles",
    text: "Answer questions to strike the monster; miss or run out of time and it strikes back. Streaks boost damage and can land critical hits.",
  },
  {
    icon: <BookOpen className="h-4 w-4" />,
    title: "Adventure categories",
    text: "Categories group monsters and subject pools into themed adventures. Staff-approved ones become official; you can build your own with the Category and Monster Makers.",
  },
  {
    icon: <ScrollText className="h-4 w-4" />,
    title: "Your own question bank",
    text: "Write questions with multiple subjects, per-question timers and explanations. Submit great ones for approval to join the official bank.",
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    title: "Levels, gear and gacha",
    text: "Earn XP, gold and gems. Equip weapons, armor and accessories, load up to three consumables per battle, and pull rare gear from the gacha.",
  },
  {
    icon: <Trophy className="h-4 w-4" />,
    title: "Leaderboards",
    text: "Compete for the best single-battle score and total XP against every verified player.",
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: "Infinite Gauntlet",
    text: "Endless waves that keep getting harder. Survive as long as you can and bank per-wave bonuses.",
  },
];

const SECURITY: { icon: React.ReactNode; title: string; text: string }[] = [
  {
    icon: <KeyRound className="h-4 w-4" />,
    title: "Hashed passwords & 2FA for staff",
    text: "Passwords are scrypt-hashed with per-user salts. Admins and super admins sign in with a second authenticator step.",
  },
  {
    icon: <MailCheck className="h-4 w-4" />,
    title: "Verified humans only",
    text: "Accounts must verify their email before logging in; unverified accounts are auto-deleted after 24 hours and never appear on leaderboards.",
  },
  {
    icon: <Timer className="h-4 w-4" />,
    title: "Brute-force protection",
    text: "Five failed logins lock an account, and the lockout doubles in length every time it repeats.",
  },
  {
    icon: <Users className="h-4 w-4" />,
    title: "Server-authoritative play",
    text: "Every hit, reward and item action is validated on the server — the browser only ever sends intent, never outcomes.",
  },
];

export function AboutView() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="font-display text-lg">📜 About QUIZRPG</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          QUIZRPG - An Interactive Gaming Quiz System for Enhancing Student Learning and Engagement.
          It turns your study reviewers into turn-based RPG battles: every correct answer is an
          attack, every miss is a counterattack, and leveling up is literally the same thing as
          learning the material.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{f.icon}</span>
                {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground">{f.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="panel-frame">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" /> How we protect your account
          </CardTitle>
          <CardDescription>The safeguards running behind every session.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {SECURITY.map((s) => (
            <div key={s.title} className="flex items-start gap-2.5 rounded-lg border border-border/60 p-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {s.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold">{s.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{s.text}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center text-xs text-muted-foreground"
      >
        Built as a capstone project — study hard, fight harder. ⚔️
      </motion.p>
    </div>
  );
}
