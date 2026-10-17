"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Loader2, LogIn, UserPlus, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/store";
import type { SafeUser } from "@/lib/types";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle light or dark mode"
      className="rounded-full"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}

export function AuthScreen() {
  const setUser = useAuth((s) => s.setUser);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleAuth(e: React.FormEvent<HTMLFormElement>, mode: "login" | "register") {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "");
    setBusy(true);
    try {
      const data = await api<{ user: SafeUser }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(mode === "login" ? { username, password } : { username, password, displayName }),
      });
      setUser(data.user);
      toast({ title: mode === "login" ? "Welcome back!" : "Hero created!", description: `Glory awaits, ${data.user.displayName}.` });
    } catch (err) {
      toast({ title: "Access denied", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* ambient decorations */}
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_75/0.12),transparent_60%)]" />
        <span className="absolute left-[8%] top-[18%] text-4xl opacity-20 animate-floaty">⚔️</span>
        <span className="absolute right-[10%] top-[24%] text-5xl opacity-20 animate-floaty" style={{ animationDelay: "0.8s" }}>🐉</span>
        <span className="absolute left-[14%] bottom-[16%] text-5xl opacity-20 animate-floaty" style={{ animationDelay: "1.4s" }}>🛡️</span>
        <span className="absolute right-[16%] bottom-[20%] text-4xl opacity-20 animate-floaty" style={{ animationDelay: "2s" }}>📜</span>
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md flex flex-col items-center gap-8"
      >
        <div className="text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Swords className="h-9 w-9 text-primary animate-glow" aria-hidden="true" />
            <h1 className="font-display text-2xl sm:text-3xl text-primary leading-relaxed">QUIZRPG</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Turn your reviewers into battles. Answer questions, slay monsters, earn XP — and level up your learning.
          </p>
        </div>

        <Card className="w-full panel-frame">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-center">Player Login</CardTitle>
            <CardDescription className="text-center">Enter the arena or forge a new hero</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" className="gap-1.5"><LogIn className="h-3.5 w-3.5" /> Login</TabsTrigger>
                <TabsTrigger value="register" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={(e) => handleAuth(e, "login")} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-username">Username</Label>
                    <Input id="login-username" name="username" required autoComplete="username" placeholder="e.g. dragon_slayer" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enter the Realm
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={(e) => handleAuth(e, "register")} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input id="reg-username" name="username" required pattern="[A-Za-z0-9_]{3,20}" title="3-20 letters, numbers or underscore" autoComplete="username" placeholder="3-20 characters" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-display">Display Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="reg-display" name="displayName" placeholder="How your hero is known" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input id="reg-password" name="password" type="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create Hero
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-4 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-0.5">Demo accounts</p>
              <p>Admin — <code className="font-mono">admin / admin123</code></p>
              <p>Player — <code className="font-mono">hero / hero123</code></p>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
          Built for students who want studying to feel like an adventure — battle monsters with Math, Science, History, English & Programming.
        </p>
      </motion.div>
    </div>
  );
}
