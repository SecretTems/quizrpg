"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NormalizedUser } from "@/lib/models";
import { ITEMS } from "@/lib/adventure-data";

interface GachaViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

const CATS: { id: "WEAPON" | "ARMOR" | "ACCESSORY" | "CONSUMABLE"; label: string }[] = [
  { id: "WEAPON", label: "Weapons" },
  { id: "ARMOR", label: "Armors" },
  { id: "ACCESSORY", label: "Accessories" },
  { id: "CONSUMABLE", label: "Special Potions" },
];

export function GachaView({ open, onOpenChange, user, onRefresh }: GachaViewProps) {
  const [pullResult, setPullResult] = useState<{
    rarity: string;
    item: { id: string; name: string; image?: string; slot?: string } | null;
    cost: number;
  } | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const pull = async () => {
    setPullResult(null);
    setMessage(null);
    try {
      const res = await api<{ rarity: string; item: { id: string; name: string } | null; gems: number }>("/api/gacha/pull", {
        method: "POST",
      });
      onRefresh();
      setPullResult({ rarity: res.rarity, item: res.item, cost: 3 });
      setMessage(
        res.item
          ? { kind: "success", text: `Pulled ${res.rarity}: ${res.item.name}!` }
          : { kind: "error", text: "Nothing this time. Better luck next pull." },
      );
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Pull failed." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md p-4">
      <DialogHeader>
        <DialogTitle>Gacha</DialogTitle>
        <DialogDescription>
          Spend gems for a chance at unique weapons, armors, accessories, and special potions.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold">💎 Gems: {user?.gems ?? 0}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {CATS.map((c) => (
          <Button key={c.id} size="sm" variant="outline" className="w-full text-left">
            {c.label}
          </Button>
        ))}
      </div>
      <Button
        size="lg"
        className="w-full py-2 font-bold shadow"
        disabled={(user?.gems ?? 0) < 3}
        onClick={pull}
      >
        Pull - 3 Gems
      </Button>
      {pullResult && (
        <Card className="mt-4 panel-frame">
          <CardContent className="p-3 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{pullResult.rarity}</div>
            <div className="mt-1 flex items-center justify-center gap-2">
              {pullResult.item?.image && (
                <img src={pullResult.item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
              )}
              <div className="font-bold">{pullResult.item ? pullResult.item.name : "Nothing"}</div>
            </div>
          </CardContent>
        </Card>
      )}
      {message && (
        <p className={`mt-3 text-xs ${message.kind === "success" ? "text-emerald-600" : "text-destructive"}`}>{message.text}</p>
      )}
      <DialogDescription className="mt-3 text-xs text-muted-foreground">
        Each pull costs 3 gems. Unique items can only be owned once; duplicates become shop fodder.
      </DialogDescription>
    </DialogContent>
    </Dialog>
  );
}