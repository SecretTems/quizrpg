"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, Plus, Send, Skull, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { StatusBadge } from "@/components/quizrpg/bits";
import { SubjectPicker } from "@/components/quizrpg/subject-picker";
import type { NormalizedCategory } from "@/lib/models";

interface CategoryMakerProps {
  categories: NormalizedCategory[];
  onReload: () => void;
  /** jump into the Monster Maker for this category */
  onManageMonsters: (categoryId: string) => void;
}

interface CategoryForm {
  name: string;
  description: string;
  subjects: string[];
  icon: string;
}

const EMPTY_FORM: CategoryForm = { name: "", description: "", subjects: [], icon: "" };

export function CategoryMaker({ categories, onReload, onManageMonsters }: CategoryMakerProps) {
  const user = useAuth((s) => s.user);
  const { toast } = useToast();
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // subjects the player can pick from (official + their own)
  useEffect(() => {
    api<{ subjects: string[] }>("/api/subjects")
      .then((d) => setAllSubjects(d.subjects))
      .catch(() => setAllSubjects([]));
  }, []);

  const canEdit = (c: NormalizedCategory) => Boolean(user && (isStaff || c.ownerId === user.id));

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(c: NormalizedCategory) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      description: c.description,
      subjects: [...c.subjects],
      icon: c.icon ?? "",
    });
    setDialogOpen(true);
  }

  async function pickIcon(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, "category");
      setForm((f) => ({ ...f, icon: url }));
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const subjects = form.subjects.map((s) => s.trim()).filter(Boolean);
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Give your category a name.", variant: "destructive" });
      return;
    }
    if (!subjects.length) {
      toast({
        title: "Subject required",
        description: "Add at least one subject.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim(), subjects, icon: form.icon };
      if (editingId) {
        await api(`/api/categories/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Category updated" });
      } else {
        await api("/api/categories", { method: "POST", body: JSON.stringify(payload) });
        toast({
          title: "Category created 📂",
          description: "It's private to you until you submit it for approval.",
        });
      }
      setDialogOpen(false);
      onReload();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(c: NormalizedCategory, status: "PENDING" | "OFFICIAL" | "REJECTED") {
    setBusyId(c.id);
    try {
      await api(`/api/categories/${c.id}`, { method: "PUT", body: JSON.stringify({ status }) });
      toast({
        title:
          status === "PENDING"
            ? "Submitted for approval ⏳"
            : status === "OFFICIAL"
              ? "Category approved ★"
              : "Category rejected",
      });
      onReload();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: NormalizedCategory) {
    setBusyId(c.id);
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      toast({ title: "Category deleted" });
      onReload();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base">📂 Category Maker</h3>
          <p className="text-sm text-muted-foreground">
            Create your own adventure categories. They stay visible only to you until an admin approves them
            and they become official.
          </p>
        </div>
        <Button className="gap-1.5" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="panel-frame">
          <CardContent className="py-12 text-center">
            <p className="font-semibold">No categories yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first category, then give it monsters in the Monster Maker.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-wrap items-start gap-3 p-4">
                {c.icon ? (
                  <img src={c.icon} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">
                    {c.monsters?.[0]?.emoji || c.enemy.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.description || "No description"}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    📚 {c.subjects.join(" · ") || "-"} · 👾 {c.monsters?.length ?? 0} monster
                    {(c.monsters?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-auto">
                  {canEdit(c) && (
                    <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => onManageMonsters(c.id)}>
                      <Skull className="h-3.5 w-3.5" /> Monsters
                    </Button>
                  )}
                  {canEdit(c) && (
                    <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                  {canEdit(c) && !isStaff && (c.status === "CUSTOM" || c.status === "REJECTED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2 text-xs"
                      disabled={busyId === c.id}
                      onClick={() => void setStatus(c, "PENDING")}
                    >
                      <Send className="h-3.5 w-3.5" /> Submit
                    </Button>
                  )}
                  {isStaff && c.status !== "OFFICIAL" && (
                    <Button
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      disabled={busyId === c.id}
                      onClick={() => void setStatus(c, "OFFICIAL")}
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                  )}
                  {canEdit(c) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label={`Delete category ${c.name}`}
                          disabled={busyId === c.id}
                        >
                          {busyId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete &ldquo;{c.name}&rdquo;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The category and its monster lineup will be removed. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => void remove(c)}
                          >
                            Delete forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>
              Subjects decide which question pools your monsters can draw from.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={form.name}
                maxLength={40}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Science"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                maxLength={200}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short flavor line shown on the category card"
                rows={2}
                className="min-w-0 resize-none break-all"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subjects</Label>
              <SubjectPicker
                available={allSubjects}
                selected={form.subjects}
                onChange={(subjects) => setForm({ ...form, subjects })}
              />
              <p className="text-[11px] text-muted-foreground">
                Subjects decide which question pools your monsters can draw from. Tap a subject to add it, tap the X
                on a chip to remove it.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Icon (optional)</Label>
              <div className="flex items-center gap-3">
                {form.icon ? (
                  <img src={form.icon} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                    <Upload className="h-4 w-4" />
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickIcon(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {form.icon ? "Replace" : "Upload"}
                </Button>
                {form.icon && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={() => setForm({ ...form, icon: "" })}
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Images are auto-downscaled to 128 px (max ~200 KB).
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || uploading} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
