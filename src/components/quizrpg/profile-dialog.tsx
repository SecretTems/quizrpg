"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";

interface ProfileData {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  role: string;
  level: number;
  xp: number;
  battlesWon: number;
  battlesLost: number;
  bestScore: number;
  bestStreak: number;
  createdAt: string;
}

/** Public profile dialog, opened by tapping a player on the leaderboard. */
export function ProfileDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={Boolean(userId)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        {userId && <ProfileBody key={userId} userId={userId} />}
      </DialogContent>
    </Dialog>
  );
}

/** Loaded per-open; `key` remounts it for each new userId so the fetch runs once. */
function ProfileBody({ userId }: { userId: string }) {
  // fetch once per mount (mount happens exactly once per picked player)
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "loaded"; profile: ProfileData }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  if (state.kind === "loading") {
    // promise chain settles into setState; safe because the component is keyed
    // per userId and remounts fresh for each new player
    void api<{ profile: ProfileData }>(`/api/profile/${userId}`)
      .then((d) => setState({ kind: "loaded", profile: d.profile }))
      .catch((err) =>
        setState({ kind: "error", message: err instanceof Error ? err.message : "Could not load profile." }),
      );
  }

  if (state.kind === "loading") {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state.kind === "error") return <p className="py-6 text-center text-sm text-destructive">{state.message}</p>;
  const profile = state.profile;
  if (!profile) return <p className="py-6 text-center text-sm text-muted-foreground">No profile data.</p>;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-col items-center gap-2 text-center">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="h-16 w-16 rounded-full border border-border object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-muted/50 text-3xl" aria-hidden="true">
              {profile.role === "PLAYER" ? "🧑‍🎓" : "🛡️"}
            </span>
          )}
          <span>{profile.displayName}</span>
          <span className="text-xs font-normal text-muted-foreground">@{profile.username}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Level" value={`Lv ${profile.level}`} />
        <Stat label="Total XP" value={`✨ ${profile.xp}`} />
        <Stat label="Wins / Losses" value={`${profile.battlesWon} / ${profile.battlesLost}`} />
        <Stat label="Best score" value={`⭐ ${profile.bestScore}`} />
        <Stat label="Best streak" value={`🔥 ${profile.bestStreak}`} />
        <Stat label="Joined" value={new Date(profile.createdAt).toLocaleDateString()} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
