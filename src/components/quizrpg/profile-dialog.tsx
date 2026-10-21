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
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = async (open: boolean) => {
    if (!open) {
      setProfile(null);
      setError("");
      onClose();
      return;
    }
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const d = await api<{ profile: ProfileData }>(`/api/profile/${userId}`);
      setProfile(d.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={Boolean(userId)} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
        {profile && (
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
        )}
      </DialogContent>
    </Dialog>
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
