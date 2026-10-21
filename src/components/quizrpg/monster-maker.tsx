"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Skull, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { IMonster, NormalizedCategory } from "@/lib/models";

interface MonsterMakerProps {
  categories: NormalizedCategory[];
  /** preselect a category (e.g. when jumped here from the Category Maker) */
  initialCategoryId?: string | null;
  onReload: () => void;
}

interface MonsterForm {
  name: string;
  emoji: string;
  image: string;
  hp: string;
  atkMin: string;
  atkMax: string;
  subjects: string;
}

const EMPTY_FORM: MonsterForm = {
  name: "",
  emoji: "👾",
  image: "",
  hp: "60",
  atkMin: "6",
  atkMax: "9",
  subjects: "",
};

export function MonsterMaker({ categories, initialCategoryId, onReload }: MonsterMakerProps) {
  const user = useAuth((s) => s.user);
  const { toast } = useToast();
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const editable = categories.filter((c) => isStaff || c.ownerId === user?.id);

  const [selectedId, setSelectedId] = useState<string | null>(initialCategoryId ?? null);

  // derive the selection so it never goes stale while the list loads or changes
  const catId =
    selectedId && editable.some((c) => c.id === selectedId)
      ? selectedId
      : initialCategoryId && editable.some((c) => c.id === initialCategoryId)
        ? initialCategoryId
        : editable[0]?.id ?? "";
  const cat = editable.find((c) => c.id === catId) ?? null;
  const monsters: IMonster[] = cat?.monsters ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState<MonsterForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function persist(next: IMonster[]) {
    if (!cat) return;
    setBusy(true);
    try {
      await api(`/api/categories/${cat.id}`, { method: "PUT", body: JSON.stringify({ monsters: next }) });
      toast({ title: "Monster lineup saved 👾" });
      onReload();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditIndex(null);
    setForm({
      ...EMPTY_FORM,
      subjects: cat?.subjects.join(", ") ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(index: number) {
    const m = monsters[index];
    if (!m) return;
    setEditIndex(index);
    setForm({
      name: m.name,
      emoji: m.emoji,
      image: m.image ?? "",
      hp: String(m.hp),
      atkMin: String(m.atkMin),
      atkMax: String(m.atkMax),
      subjects: m.subjects.join(", "),
    });
    setDialogOpen(true);
  }

  async function pickImage(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, "monster");
      setForm((f) => ({ ...f, image: url }));
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
    const hp = Math.min(9999, Math.max(10, Number(form.hp) || 0));
    const atkMin = Math.max(1, Number(form.atkMin) || 0);
    const atkMax = Math.max(atkMin, Number(form.atkMax) || 0);
    const subjects = form.subjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!form.name.trim()) {
      toast({ title: "Name required", description: "Give the monster a name.", variant: "destructive" });
      return;
    }
    if (!form.hp || hp < 10) {
      toast({ title: "Invalid HP", description: "HP must be at least 10.", variant: "destructive" });
      return;
    }
    const monster: IMonster = {
      name: form.name.trim(),
      emoji: form.emoji.trim() || "👾",
      image: form.image,
      hp,
      atkMin,
      atkMax,
      subjects,
    };
    const next =
      editIndex === null
        ? [...monsters, monster]
        : monsters.map((m, i) => (i === editIndex ? monster : m));
    setSaving(true);
    try {
      await persist(next);
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= monsters.length) return;
    const next = [...monsters];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  function removeAt(index: number) {
    void persist(monsters.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base">👾 Monster Maker</h3>
          <p className="text-sm text-muted-foreground">
            Design each category's monster lineup - they are fought in order, one after another.
          </p>
        </div>
        <Button className="gap-1.5" disabled={!cat || busy} onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Monster
        </Button>
      </div>

      {editable.length > 0 && (
        <Select value={catId || undefined} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full sm:w-72" aria-label="Choose a category">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {editable.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                📂 {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!cat ? (
        <Card className="panel-frame">
          <CardContent className="py-12 text-center">
            <p className="font-semibold">No editable category</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a category first in the Category Maker, then come back to add its monsters.
            </p>
          </CardContent>
        </Card>
      ) : monsters.length === 0 ? (
        <Card className="panel-frame">
          <CardContent className="py-12 text-center">
            <Skull className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 font-semibold">No monsters yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              &ldquo;{cat.name}&rdquo; needs at least one monster before players can fight it.
            </p>
            <Button className="mt-3 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add the first monster
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {monsters.map((m, i) => (
            <Card key={`${m.name}-${i}`}>
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                {m.image ? (
                  <img src={m.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-2xl">
                    {m.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    ❤️ {m.hp} HP · ⚔️ {m.atkMin}-{m.atkMax} ATK · 📚{" "}
                    {m.subjects.length ? m.subjects.join(" · ") : "category subjects"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Move ${m.name} up`}
                    disabled={i === 0 || busy}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Move ${m.name} down`}
                    disabled={i === monsters.length - 1 || busy}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => openEdit(i)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label={`Remove ${m.name}`}
                        disabled={busy}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove &ldquo;{m.name}&rdquo;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The monster will be taken out of this category&apos;s lineup.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => removeAt(i)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editIndex === null ? "New monster" : "Edit monster"}</DialogTitle>
            <DialogDescription>
              Monsters fight in the order shown - the first one opens the battle.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="m-name">Name</Label>
              <Input
                id="m-name"
                value={form.name}
                maxLength={40}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Algebra Owl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-emoji">Emoji</Label>
              <Input
                id="m-emoji"
                value={form.emoji}
                maxLength={8}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                placeholder="👾"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Image</Label>
              <div className="flex items-center gap-2">
                {form.image ? (
                  <img src={form.image} alt="" className="h-9 w-9 rounded border border-border object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickImage(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                </Button>
                {form.image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Remove image"
                    onClick={() => setForm({ ...form, image: "" })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-hp">HP</Label>
              <Input id="m-hp" type="number" min={10} max={9999} value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-atk-min">ATK min</Label>
              <Input id="m-atk-min" type="number" min={1} value={form.atkMin} onChange={(e) => setForm({ ...form, atkMin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-atk-max">ATK max</Label>
              <Input id="m-atk-max" type="number" min={1} value={form.atkMax} onChange={(e) => setForm({ ...form, atkMax: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="m-subjects">Question subjects</Label>
              <Input
                id="m-subjects"
                value={form.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                placeholder="English, History (comma separated)"
                maxLength={200}
              />
              <p className="text-[11px] text-muted-foreground">
                The battle draws this monster&apos;s questions from these subjects. Leave blank to use the
                category&apos;s subjects.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || uploading} className="gap-1.5">
              {saving || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editIndex === null ? "Add monster" : "Save monster"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
