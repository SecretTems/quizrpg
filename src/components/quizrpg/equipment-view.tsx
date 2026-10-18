"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NormalizedUser } from "@/lib/models";

interface EquipmentViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

const EMPTY: { itemId: string | null; name: string | null; atk: number; def: number; rarity: string } = {
  itemId: null, name: null, atk: 0, def: 0, rarity: "",
};

export function EquipmentView({ open, onOpenChange, user, onRefresh }: EquipmentViewProps) {
  interface BackpackEntry { qty: number; piece?: { itemId: string; name: string; slot: string; atk: number; def: number; rarity: string } | null }
  const [backpack, setBackpack] = useState<Record<string, BackpackEntry>>({});
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setBackpack((user?.backpack ?? {}) as Record<string, BackpackEntry>);
  }, [user]);

  const equip = async (slot: "WEAPON" | "ARMOR" | "ACCESSORY", itemId: string) => {
    setMessage(null);
    try {
      const res = await api("/api/equip", {
        method: "POST",
        body: JSON.stringify({ itemId, slot, action: "equip" }),
      });
      onRefresh();
      setMessage({ kind: "success", text: `Equipped ${itemId}.` });
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Equip failed." });
    }
  };

  const unequip = async (slot: "WEAPON" | "ARMOR" | "ACCESSORY") => {
    setMessage(null);
    try {
      await api("/api/equip", { method: "POST", body: JSON.stringify({ itemId: "", slot, action: "unequip" }) });
      onRefresh();
      setMessage({ kind: "success", text: "Unequipped." });
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Unequip failed." });
    }
  };

  const slotLabel: Record<string, string> = { WEAPON: "Main Hand", ARMOR: "Armor", ACCESSORY: "Accessory" };
  const equipped = user?.equipment ?? { WEAPON: null, ARMOR: null, ACCESSORY: null };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md p-4">
      <DialogHeader>
        <DialogTitle>Equipment</DialogTitle>
        <DialogDescription>Equip weapons, armor, and accessories to boost your battle stats.</DialogDescription>
      </DialogHeader>
      {message && (
        <div className={`mb-3 rounded border p-2 text-sm ${message.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {message.text}
        </div>
      )}
      <div className="space-y-4">
        {(["WEAPON", "ARMOR", "ACCESSORY"] as const).map((slot) => {
          const piece = equipped[slot];
          return (
            <Card key={slot} className="panel-frame">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {slotLabel[slot]}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{piece?.rarity ?? "Empty"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">{piece?.name ?? "— Empty —"}</div>
                  <div className="text-xs text-muted-foreground">
                    ATK {piece?.atk ?? 0} • DEF {piece?.def ?? 0}
                  </div>
                </div>
                <div className="flex gap-2">
                  {piece ? (
                    <Button size="sm" variant="outline" onClick={() => unequip(slot)}>Unequip</Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        const owned = Object.entries(backpack).find(([id]) => backpack[id]?.piece?.slot === slot)?.[0];
                        if (owned) equip(slot, owned);
                        else setMessage({ kind: "error", text: `No ${slot.toLowerCase()} in backpack.` });
                      }}
                    >
                      Equip
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-4 border-t border-border/50 pt-3">
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Backpack ({Object.values(backpack).reduce((a, b) => a + b.qty, 0)}/100)</CardTitle>
        <CardContent className="p-3 space-y-2">
          {Object.entries(backpack).length === 0 ? (
            <p className="text-xs text-muted-foreground">Your backpack is empty.</p>
          ) : (
            Object.entries(backpack).map(([itemId, entry]) => (
              <div key={itemId} className="flex items-center justify-between text-sm">
                <span>{itemId} ×{entry.qty}</span>
              </div>
            ))
          )}
        </CardContent>
      </div>
      <DialogDescription className="mt-3 text-xs text-muted-foreground">
        Equipped gear is used in fights. Backpack items (up to 100 spare) are not brought into battle.
      </DialogDescription>
    </DialogContent>
    </Dialog>
  );
}