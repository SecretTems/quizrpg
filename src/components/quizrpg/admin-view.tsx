"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Trash2, UserCog, LibraryBig, Swords, Users, Search, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { api, useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NormalizedCategory } from "@/lib/models";

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
  stats: { totalQuestions: number; globalQuestions: number; totalBattles: number; totalUsers: number; pendingQuestions: number };
  viewerRole: string;
}

export function AdminView() {
  const me = useAuth((s) => s.user);
  const { toast } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<"players" | "admins" | "all">("players");
  const isSuper = me?.role === "SUPER_ADMIN";

  const [categories, setCategories] = useState<NormalizedCategory[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ section });
      if (search.trim()) p.set("search", search.trim());
      setData(await api<AdminData>(`/api/admin/users?${p.toString()}`));
    } catch (err) {
      toast({ title: "Failed to load admin data", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [section, search]);

  const loadCategories = useCallback(async () => {
    setCatLoading(true);
    try {
      const d = await api<{ categories: NormalizedCategory[] }>("/api/categories");
      setCategories(d.categories);
    } catch (err) {
      toast({ title: "Failed to load categories", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setCatLoading(false);
    }
  }, []);

  const approveCategory = async (id: string) => {
    try {
      await api(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ status: "OFFICIAL" }) });
      toast({ title: "Category approved", description: "It is now an official Adventure category." });
      await loadCategories();
    } catch (err) {
      toast({ title: "Approve failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  };

  const rejectCategory = async (id: string) => {
    try {
      await api(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ status: "REJECTED" }) });
      toast({ title: "Category rejected", description: "It stays private to its owner." });
      await loadCategories();
    } catch (err) {
      toast({ title: "Reject failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      toast({ title: "Category deleted" });
      await loadCategories();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadCategories());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams({ section });
        if (search.trim()) p.set("search", search.trim());
        const d = await api<AdminData>(`/api/admin/users?${p.toString()}`);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled)
          toast({ title: "Failed to load admin data", description: err instanceof Error ? err.message : "", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, search]);

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
    { icon: <Users className="h-4 w-4" />, label: section === "admins" ? "Admins & supers" : "Registered users", value: data.stats.totalUsers },
    { icon: <LibraryBig className="h-4 w-4" />, label: "Official questions", value: data.stats.globalQuestions },
    { icon: <Swords className="h-4 w-4" />, label: "Battles fought", value: data.stats.totalBattles },
    { icon: <Clock className="h-4 w-4" />, label: "Pending approvals", value: data.stats.pendingQuestions },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg">{isSuper ? "👑 Super Admin Command Center" : "🛡️ Admin Command Center"}</h2>
        <p className="text-sm text-muted-foreground">
          {isSuper
            ? "Full control: manage admins, players and question approvals."
            : "Manage the question bank and review submissions. Role management is reserved for super admins."}
        </p>
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

      {/* category approvals - creation lives in the Bank's Category Maker */}
      <Card>
        <CardHeader>
          <CardTitle>Category approvals</CardTitle>
          <CardDescription>
            Player-submitted categories land here. Approve one to make it an official Adventure category
            everyone can play, or reject it so it stays private to its owner. Creating categories lives in
            the Bank → Category Maker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {catLoading && categories.length === 0 && (
            <p className="text-xs text-muted-foreground">Loading categories…</p>
          )}
          {!catLoading && categories.filter((c) => c.status === "PENDING").length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing waiting for approval. 🎉</p>
          )}
          {categories
            .filter((c) => c.status === "PENDING")
            .map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">
                    {c.icon ? "🖼️" : c.monsters?.[0]?.emoji || c.enemy.emoji} {c.name}
                  </span>
                  <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    {c.status}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => void approveCategory(c.id)}>
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      if (typeof window !== "undefined" && window.confirm(`Reject the "${c.name}" category? It stays private to its owner.`)) {
                        void rejectCategory(c.id);
                      }
                    }}
                  >
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* section tabs + search */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              onClick={() => setSection("players")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                section === "players" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Swords className="h-3.5 w-3.5" /> Players
            </button>
            <button
              onClick={() => setSection("admins")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                section === "admins" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admins
            </button>
            <button
              onClick={() => setSection("all")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                section === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LibraryBig className="h-3.5 w-3.5" /> All
            </button>
          </div>
          <div className="relative min-w-44 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or display name…"
              className="pl-8"
              aria-label="Search users"
            />
          </div>
        </CardContent>
      </Card>

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
                            disabled={!isSuper || isMe || u.role === "SUPER_ADMIN" || busyId === u.id}
                            onClick={() => void toggleRole(u)}
                            aria-label={u.role === "ADMIN" ? `Demote ${u.username} to player` : `Promote ${u.username} to admin`}
                            title={isSuper ? (u.role === "ADMIN" ? "Demote to player" : "Promote to admin") : "Only super admins can change roles"}
                          >
                            {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                disabled={!isSuper || isMe || u.role === "SUPER_ADMIN" || busyId === u.id}
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
        <ShieldCheck className="h-3.5 w-3.5" />
        {isSuper
          ? "As super admin you can promote/demote admins and delete accounts. Admins manage content and approvals."
          : "Admins manage questions and approvals. Promoting/demoting and deleting accounts is reserved for super admins (👑)."}
      </p>
    </div>
  );
}
