"use client";

import { useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NormalizedUser } from "@/lib/models";
import { GACHA_CATEGORIES, GACHA_COST_RANDOM, GACHA_COST_FOCUSED, GACHA_MAX_COPIES } from "@/lib/adventure-data";

interface GachaViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

const CAT_LABEL: Record<string, string> = {
  WEAPON: "Weapons",
  ARMOR: "Armors",
  ACCESSORY: "Accessories",
  CONSUMABLE: "Special Potions",
};

export function GachaView({ open, onOpenChange, user, onRefresh }: GachaViewProps) {
  const [focus, setFocus] = useState<string | null>(null); // null = random (default)
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{
    rarity: string;
    item: { id: string; name: string; image?: string } | null;
    destroyed: boolean;
    cost: number;
  } | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const cost = focus ? GACHA_COST_FOCUSED : GACHA_COST_RANDOM;
  const gems = user?.gems ?? 0;

  const pull = async () => {
    setPulling(true);
    setPullResult(null);
    setMessage(null);
    try {
      const res = await api<{
        rarity: string;
        item: { id: string; name: string; image?: string } | null;
        destroyed: boolean;
        cost: number;
        gems: number;
      }>("/api/gacha/pull", {
        method: "POST",
        body: JSON.stringify({ focus }),
      });
      onRefresh();
      setPullResult({ rarity: res.rarity, item: res.item, destroyed: res.destroyed, cost: res.cost });
      if (res.destroyed) {
        setMessage({ kind: "error", text: `Duplicate over the copy limit (${res.rarity}) - it was destroyed.` });
      } else if (res.item) {
        setMessage({ kind: "success", text: `Pulled ${res.rarity}: ${res.item.name}!` });
      } else {
        setMessage({ kind: "error", text: "Nothing this time. Better luck next pull." });
      }
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Pull failed." });
    } finally {
      setPulling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gacha</DialogTitle>
          <DialogDescription>
            Spend gems for a chance at gear. A focused pull boosts one category&apos;s odds a little; a random pull is
            cheaper and can hit any of the four.
          </DialogDescription>
        </DialogHeader>

        <div className="font-bold">💎 Gems: {gems}</div>

        {/* category focus picker - Random selected by default */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFocus(null)}
            aria-pressed={focus === null}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all",
              focus === null ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent",
            )}
          >
            <Shuffle className="h-4 w-4" /> Random
          </button>
          {GACHA_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFocus(c)}
              aria-pressed={focus === c}
              className={cn(
                "min-h-11 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all",
                focus === c ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-accent",
              )}
            >
              {CAT_LABEL[c]}
            </button>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full gap-1.5 py-2 font-bold shadow"
          disabled={pulling || gems < cost}
          onClick={() => void pull()}
        >
          {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : focus ? null : <Shuffle className="h-4 w-4" />}
          {focus ? `Pull ${CAT_LABEL[focus]} - ${GACHA_COST_FOCUSED} Gems` : `Random Pull - ${GACHA_COST_RANDOM} Gems`}
        </Button>

        {pullResult && (
          <Card className="panel-frame">
            <CardContent className="p-3 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{pullResult.rarity}</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                {pullResult.item?.image && (
                  <img src={pullResult.item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                )}
                <div className="font-bold">
                  {pullResult.destroyed
                    ? "Destroyed (over copy limit)"
                    : pullResult.item
                      ? pullResult.item.name
                      : "Nothing"}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {message && (
          <p className={`text-xs ${message.kind === "success" ? "text-emerald-600" : "text-destructive"}`}>{message.text}</p>
        )}

        <DialogDescription className="text-xs text-muted-foreground">
          Random pull costs {GACHA_COST_RANDOM} gems, focused pull {GACHA_COST_FOCUSED}. Copy limits: {GACHA_MAX_COPIES.RARE}×
          per rare, {GACHA_MAX_COPIES.EPIC}× per epic, {GACHA_MAX_COPIES.LEGENDARY}× per legendary - extras are destroyed.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}