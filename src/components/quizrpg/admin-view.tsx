"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserCog, LibraryBig, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  xp: number;
  level: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  questionCount: number;
  createdAt: string;
}

interface AdminData {
  users: AdminUser[];
  stats: { totalQuestions: number; globalQuestions: number; totalBattles: number; totalUsers: number };
}

export function AdminView() {
  const me = useAuth((s) => s.user);
  const { toast } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<AdminData>("/api/admin/users"));
    } catch (err) {
      toast({ title: "Failed to load admin data", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
     
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleRole(u: AdminUser) {
    setBusyId(u.id);
    try {
      // cycle: PLAYER -> ADMIN -> SUPER_ADMIN -> PLAYER (server rejects demoting a super admin,
      // but keeps a "you"-style guard for the current viewer; SUPER_ADMIN row is skipped below)
      const next = u.role === "PLAYER" ? "ADMIN" : "PLAYER";
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role: next }) });
      toast({ title: `@${u.username} is now ${next === "ADMIN" ? "an admin 🛡️" : "a player ⚔️"}` });
      await load();
    } catch (err) {
      toast({ title: "Role change failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(u: AdminUser) {
    setBusyId(u.id);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      toast({ title: `@${u.username} removed` });
      await load();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statCards = [
    { icon: <Users className="h-4 w-4" />, label: "Registered users", value: data.stats.totalUsers },
    { icon: <LibraryBig className="h-4 w-4" />, label: "Global questions", value: data.stats.globalQuestions },
    { icon: <LibraryBig className="h-4 w-4" />, label: "All questions", value: data.stats.totalQuestions },
    { icon: <Swords className="h-4 w-4" />, label: "Battles fought", value: data.stats.totalBattles },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">🛡️ Admin Command Center</h2>
        <p className="text-sm text-muted-foreground">Manage player accounts and monitor system activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{s.icon}</span>
              <div>
                <p className="text-lg font-bold tabular-nums leading-none">{s.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-24rem)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur">
                <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Player</th>
                  <th className="px-3 py-3 font-semibold">Level</th>
                  <th className="px-3 py-3 font-semibold">W / L</th>
                  <th className="px-3 py-3 font-semibold">Best score</th>
                  <th className="px-3 py-3 font-semibold">Questions</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={cn("border-b last:border-0", isMe && "bg-primary/5")}>
                      <td className="px-4 py-3">
                        <p className="font-bold">
                          {u.role === "SUPER_ADMIN" ? "👑 " : u.role === "ADMIN" ? "🛡️ " : ""}{u.displayName}
                          {isMe && <span className="ml-1.5 rounded bg-primary/20 px-1 py-0.5 text-[10px] uppercase text-primary">You</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">@{u.username}</p>
                      </td>
                      <td className="px-3 py-3 tabular-nums">Lv {u.level}</td>
                      <td className="px-3 py-3 tabular-nums">{u.battlesWon} / {u.battlesLost}</td>
                      <td className="px-3 py-3 tabular-nums">⭐ {u.bestScore}</td>
                      <td className="px-3 py-3 tabular-nums">{u.questionCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isMe || u.role === "SUPER_ADMIN" || busyId === u.id}
                            onClick={() => void toggleRole(u)}
                            aria-label={u.role === "ADMIN" ? `Demote ${u.username} to player` : `Promote ${u.username} to admin`}
                            title={u.role === "ADMIN" ? "Demote to player" : "Promote to admin"}
                          >
                            {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={isMe || u.role === "SUPER_ADMIN" || busyId === u.id}
                                aria-label={`Delete user ${u.username}`}
                                title="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete @{u.username}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the account along with their {u.questionCount} question(s) and all battle history.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void removeUser(u)}>
                                  Delete forever
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Only admins can see this tab. Promote trusted moderators carefully — admins can edit the global question bank.
      </p>
    </div>
  );
}
