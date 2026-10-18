"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, LogOut, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
          <CardDescription>Progress persists across sessions — your legend is saved.</CardDescription>
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
        </CardContent>
      </Card>

      {/* danger zone */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Sign out</p>
              <p className="text-xs text-muted-foreground">Your progress is saved automatically.</p>
            </div>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                await logout();
                onStatsChanged();
              }}
            >
              <LogOut className="h-4 w-4" /> Log out
            </Button>
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
