"use client";

import { useRef, useState } from "react";
import { Camera, Check, KeyRound, Loader2, LogOut, Pencil, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/store";
import { uploadImage } from "@/lib/images";
import { StatBar } from "@/components/quizrpg/bits";
import { levelProgress } from "@/lib/game";
import type { SafeUser } from "@/lib/types";

/* ---------- 2FA setup card (admins / super admins) ---------- */

function TwoFactorCard() {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refresh);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) return null;

  const startSetup = async () => {
    setBusy(true);
    try {
      const data = await api<{ secret: string }>("/api/auth/2fa/setup", { method: "POST" });
      setSecret(data.secret);
    } catch (err: any) {
      toast({ title: "2FA setup failed", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    try {
      await api("/api/auth/2fa/setup", { method: "PATCH", body: JSON.stringify({ code }) });
      setSecret(null);
      setCode("");
      await refreshUser();
      toast({ title: "2FA enabled", description: "Your account now requires an authenticator code to sign in." });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Invalid code.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api("/api/auth/2fa/setup", { method: "DELETE" });
      await refreshUser();
      toast({ title: "2FA disabled" });
    } catch (err: any) {
      toast({ title: "Could not disable 2FA", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Two-factor authentication</p>
          <p className="text-xs text-muted-foreground">
            {user.twoFactorEnabled
              ? "Enabled - you are prompted for a 6-digit authenticator code when signing in."
              : "Recommended for admin accounts. Generate a secret, add it to your authenticator app, then confirm a code."}
          </p>
        </div>

        {!user.twoFactorEnabled && !secret && (
          <Button className="gap-1.5" onClick={() => void startSetup()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Set up 2FA
          </Button>
        )}

        {secret && (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium">1. Add this secret to your authenticator app (Google Authenticator, Authy, etc.):</p>
              <code className="block max-w-full overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-xs break-all select-all">
                {secret}
              </code>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="2fa-code">2. Enter the current 6-digit code</Label>
              <Input
                id="2fa-code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="flex gap-2">
              <Button className="gap-1.5" onClick={() => void confirmSetup()} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm & enable
              </Button>
              <Button variant="ghost" onClick={() => { setSecret(null); setCode(""); }} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {user.twoFactorEnabled && (
          <Button variant="outline" className="gap-1.5" onClick={() => void disable()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
            Disable 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfileView({ onStatsChanged }: { onStatsChanged: () => void }) {
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refresh);
  const logout = useAuth((s) => s.logout);
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // draft name while editing; falls back to the stored display name otherwise
  const name = editing ? (nameDraft ?? user?.displayName ?? "") : (user?.displayName ?? "");
  const setName = setNameDraft;

  if (!user) return null;
  const lp = levelProgress(user.xp);
  const winRate = user.battlesWon + user.battlesLost > 0
    ? Math.round((user.battlesWon / (user.battlesWon + user.battlesLost)) * 100)
    : null;
  const answered = (user.questionsRight ?? 0) + (user.questionsWrong ?? 0);
  const accuracy = answered > 0 ? Math.round(((user.questionsRight ?? 0) / answered) * 100) : null;
  const subjectRows = Object.entries(user.subjectStats ?? {})
    .filter(([, s]) => s && s.right + s.wrong > 0)
    .map(([name, s]) => ({
      name,
      accuracy: Math.round((s!.right / (s!.right + s!.wrong)) * 100),
      right: s!.right,
      total: s!.right + s!.wrong,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

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

  async function changeAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file, "avatar");
      await api<{ user: SafeUser }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar: url }),
      });
      await refreshUser();
      toast({ title: "Profile picture updated 🖼️" });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    try {
      await api<{ user: SafeUser }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatar: "" }),
      });
      await refreshUser();
      toast({ title: "Profile picture removed" });
    } catch (err) {
      toast({ title: "Could not remove picture", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api("/api/auth/me", { method: "DELETE" });
      await logout();
      onStatsChanged();
      toast({ title: "Account deleted", description: "Your account and everything in it were removed." });
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="font-display text-lg">🧙 Hero Profile</h2>

      {/* identity card */}
      <Card className="panel-frame">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="relative h-20 w-20 shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-20 w-20 rounded-2xl border-2 border-primary/40 object-cover" />
            ) : (
              <span
                className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-primary/40 bg-primary/10 text-5xl"
                aria-hidden="true"
              >
                🧙
              </span>
            )}
            <button
              type="button"
              className="absolute -bottom-1.5 -right-1.5 rounded-full border border-border bg-background p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
              onClick={() => avatarFileRef.current?.click()}
              aria-label="Change profile picture"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void changeAvatar(f);
                e.target.value = "";
              }}
            />
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
            {user.avatar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-fit px-2 text-[11px] text-muted-foreground"
                onClick={() => void removeAvatar()}
              >
                Remove profile picture
              </Button>
            )}
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
          <CardDescription>Progress persists across sessions - your legend is saved.</CardDescription>
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

          {accuracy !== null && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{user.questionsRight}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Correct</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <p className="text-lg font-bold tabular-nums text-destructive">{user.questionsWrong}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Wrong</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">🎯 {accuracy}%</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Accuracy</p>
              </div>
            </div>
          )}

          {subjectRows.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accuracy by subject</p>
              {subjectRows.map((s) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{s.accuracy}% · {s.right}/{s.total}</span>
                  </div>
                  <Progress value={s.accuracy} className="h-1.5" aria-label={`${s.name} accuracy ${s.accuracy}%`} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* two-factor authentication (admins) */}
      <TwoFactorCard />

      {/* danger zone */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-xs text-muted-foreground">Your progress is saved automatically.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-1.5">
                  <LogOut className="h-4 w-4" /> Log out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Log out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your progress is saved automatically, but any ongoing battle will be paused until you return.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Stay</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => { await logout(); onStatsChanged(); }}>
                    Log out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">Delete account</p>
              <p className="text-xs text-muted-foreground">
                Permanently removes your account, questions, categories, and battle history.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-1.5" disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes @{user.username}, along with your questions, categories, battles,
                    gold, gems, and items. There is no way to undo this.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => void deleteAccount()}
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
