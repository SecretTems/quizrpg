"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, Loader2, LibraryBig, Globe2, UserRound, Check, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DifficultyBadge, StatusBadge, subjectIcon } from "@/components/quizrpg/bits";
import { cn } from "@/lib/utils";
import type { QuestionDTO } from "@/lib/types";
import type { Difficulty } from "@/lib/game";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER"];

interface QuestionForm {
  subject: string;
  difficulty: Difficulty;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const EMPTY_FORM: QuestionForm = {
  subject: "",
  difficulty: "EASY",
  text: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
};

type Scope = "official" | "mine" | "pending";

export function QuestionBankView() {
  const user = useAuth((s) => s.user);
  const { toast } = useToast();
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [scope, setScope] = useState<Scope>("mine");
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>("ALL");
  const [difficulty, setDifficulty] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionDTO | null>(null);
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ scope });
    if (subject !== "ALL") p.set("subject", subject);
    if (difficulty !== "ALL") p.set("difficulty", difficulty);
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [scope, subject, difficulty, search]);

  const load = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([
        api<{ questions: QuestionDTO[] }>(`/api/questions?${query}`),
        api<{ subjects: string[] }>("/api/subjects"),
      ]);
      setQuestions(q.questions);
      setAllSubjects(s.subjects);
    } catch (err) {
      toast({ title: "Failed to load questions", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(q: QuestionDTO) {
    setEditing(q);
    setForm({
      subject: q.subject,
      difficulty: q.difficulty,
      text: q.text,
      options: [...q.options],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    });
    setDialogOpen(true);
  }

  async function save(submitForReview = false) {
    const filled = form.options.filter((o) => o.trim());
    if (!form.subject.trim() || !form.text.trim() || filled.length < 2) {
      toast({
        title: "Incomplete form",
        description: "Subject, question text and at least 2 options are required (max 10).",
        variant: "destructive",
      });
      return;
    }
    if (!filled[form.correctIndex]?.trim()) {
      toast({ title: "Pick a correct answer", description: "Mark which option is correct.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        options: filled,
        personal: scope === "mine" && isStaff,
        submitForReview,
      };
      if (editing) {
        await api(`/api/questions/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast({ title: "Question updated" });
      } else {
        await api("/api/questions", { method: "POST", body: JSON.stringify(payload) });
        toast({
          title: submitForReview ? "Submitted for approval ⏳" : "Question added",
          description: submitForReview
            ? "An admin will review it before it joins the official bank."
            : scope === "official" && isStaff
              ? "Added to the official bank."
              : "Added to your custom bank.",
        });
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function moderate(id: string, action: "approve" | "reject") {
    setDeletingId(id);
    try {
      await api(`/api/questions/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      toast({ title: action === "approve" ? "Question approved ★" : "Question rejected" });
      await load();
    } catch (err) {
      toast({ title: "Action failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await api(`/api/questions/${id}`, { method: "DELETE" });
      toast({ title: "Question deleted" });
      await load();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  const canEdit = (q: QuestionDTO) => isStaff || q.ownerId === user?.id;
  const canModerate = (q: QuestionDTO) => isStaff && q.status === "PENDING";

  const scopeTabs: { id: Scope; label: string; icon: React.ReactNode }[] = [
    { id: "mine", label: "My Custom Bank", icon: <UserRound className="h-3.5 w-3.5" /> },
    { id: "official", label: "Official Bank", icon: <Globe2 className="h-3.5 w-3.5" /> },
  ];
  if (isStaff) scopeTabs.push({ id: "pending", label: "Approvals", icon: <Check className="h-3.5 w-3.5" /> });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg">📚 Question Bank</h2>
          <p className="text-sm text-muted-foreground">
            {scope === "official"
              ? "The approved bank every player draws from — view-only unless you're staff."
              : scope === "pending"
                ? "Submitted questions awaiting review. Approve to make them official."
                : "Your own questions (🧩 Custom). Submit them for approval to make them official."}
          </p>
        </div>
        {scope !== "official" && (
          <Button className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Question
          </Button>
        )}
      </div>

      {/* filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <div className="flex rounded-lg border border-border p-0.5">
            {scopeTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setScope(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  scope === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-40" aria-label="Filter by subject">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All subjects</SelectItem>
              {allSubjects.map((s) => (
                <SelectItem key={s} value={s}>{subjectIcon(s)} {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-36" aria-label="Filter by difficulty">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All levels</SelectItem>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-44 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="pl-8"
              aria-label="Search questions"
            />
          </div>
        </CardContent>
      </Card>

      {/* list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <Card className="panel-frame">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <LibraryBig className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">Nothing here yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {scope === "official"
                ? "The official bank has no matching questions yet."
                : scope === "pending"
                  ? "No submissions waiting for review."
                  : "Your custom bank is empty. Create questions — they stay private to you until approved."}
            </p>
            {scope !== "official" && (
              <Button variant="outline" className="gap-1.5" onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add your first question
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[calc(100vh-20rem)] space-y-2 overflow-y-auto pr-1">
          {questions.map((q, idx) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            >
              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold">
                      {subjectIcon(q.subject)} {q.subject}
                    </span>
                    <DifficultyBadge difficulty={q.difficulty} />
                    <StatusBadge status={q.status} />
                    {scope === "official" && isStaff && (
                      <span className="text-[10px] text-muted-foreground">by {q.ownerUsername ?? "Game Master (official)"}</span>
                    )}
                    <span className="ml-auto flex gap-1">
                      {canModerate(q) && (
                        <>
                          <Button
                            variant="ghost" size="sm" className="h-8 gap-1 text-emerald-600"
                            onClick={() => void moderate(q.id, "approve")}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            variant="ghost" size="sm" className="h-8 gap-1 text-destructive"
                            onClick={() => void moderate(q.id, "reject")}
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {canEdit(q) && scope !== "official" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit question: ${q.text.slice(0, 30)}`} onClick={() => openEdit(q)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canEdit(q) && scope !== "official" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label={`Delete question: ${q.text.slice(0, 30)}`}>
                              {deletingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this question?</AlertDialogTitle>
                              <AlertDialogDescription>&ldquo;{q.text.slice(0, 120)}{q.text.length > 120 ? "…" : ""}&rdquo; — this cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => void remove(q.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{q.text}</p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, i) => (
                      <div
                        key={i}
                        className={cn(
                          "rounded-md border px-2.5 py-1.5 text-xs",
                          i === q.correctIndex
                            ? "border-emerald-600/40 bg-emerald-500/10 font-semibold text-emerald-800 dark:text-emerald-300"
                            : "border-border bg-muted/30 text-muted-foreground",
                        )}
                      >
                        <span className="mr-1.5 font-bold">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                        {i === q.correctIndex && <span className="ml-1.5" aria-label="correct answer">✔</span>}
                      </div>
                    ))}
                  </div>
                  {q.reviewNote && q.status === "REJECTED" && (
                    <p className="text-xs italic text-destructive">Reviewer note: {q.reviewNote}</p>
                  )}
                  {q.explanation && <p className="text-xs italic text-muted-foreground">💡 {q.explanation}</p>}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit question" : "New question"}</DialogTitle>
            <DialogDescription>
              {isStaff && scope !== "mine"
                ? "Saved directly to the official bank — no approval needed."
                : "Saved to your custom bank. You can also submit it for admin approval to make it official."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-subject">Subject</Label>
                <Input
                  id="q-subject"
                  list="subject-suggestions"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Mathematics"
                />
                <datalist id="subject-suggestions">
                  {allSubjects.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as Difficulty })}>
                  <SelectTrigger aria-label="Question difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-text">Question</Label>
              <Textarea
                id="q-text"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="What is the question you want to ask?"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Options — mark the correct one (2–10)</Label>
                <div className="flex gap-1">
                  <Button
                    type="button" variant="outline" size="sm" className="h-7 w-7 p-0 text-lg leading-none"
                    disabled={form.options.length <= 2}
                    aria-label="Remove last option"
                    onClick={() => {
                      const options = form.options.slice(0, -1);
                      setForm({ ...form, options, correctIndex: Math.min(form.correctIndex, options.length - 1) });
                    }}
                  >
                    −
                  </Button>
                  <Button
                    type="button" variant="outline" size="sm" className="h-7 w-7 p-0 text-lg leading-none"
                    disabled={form.options.length >= 10}
                    aria-label="Add option"
                    onClick={() => setForm({ ...form, options: [...form.options, ""] })}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, correctIndex: i })}
                      aria-label={`Mark option ${String.fromCharCode(65 + i)} as correct`}
                      aria-pressed={form.correctIndex === i}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                        form.correctIndex === i
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </button>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const options = [...form.options];
                        options[i] = e.target.value;
                        setForm({ ...form, options });
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}${i >= 2 ? " (optional)" : ""}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Tip: exactly 2 options = True / False.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-explanation">Explanation <span className="text-muted-foreground font-normal">(shown after answering)</span></Label>
              <Input
                id="q-explanation"
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                placeholder="Why is the correct answer right?"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            {!isStaff && (
              <Button variant="outline" className="gap-1.5" disabled={saving} onClick={() => void save(true)}>
                <Send className="h-4 w-4" /> Submit for approval
              </Button>
            )}
            <Button onClick={() => void save(false)} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
