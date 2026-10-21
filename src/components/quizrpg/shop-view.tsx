"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";
import type { NormalizedUser } from "@/lib/models";
import { ITEMS, SLOT_ICON, type ItemDef } from "@/lib/adventure-data";

interface ShopViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

const consumables = ITEMS.filter((i) => i.slot === "CONSUMABLE" && i.price > 0);

const RARITY_STYLES: Record<string, string> = {
  COMMON: "border-border",
  RARE: "border-sky-500/50",
  EPIC: "border-purple-500/50",
  LEGENDARY: "border-amber-500/60",
};

function ShopItemCard({ item, gold, busy, onBuy }: { item: ItemDef; gold: number; busy: boolean; onBuy: () => void }) {
  const affordable = gold >= item.price;
  return (
    <div
      className={`flex flex-col rounded-xl border-2 bg-card/60 p-3 transition-all ${RARITY_STYLES[item.rarity] ?? "border-border"} ${
        affordable ? "hover:border-primary/50 hover:shadow-md" : "opacity-75"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {item.image ? (
          <img src={item.image} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl"
            aria-hidden="true"
          >
            {SLOT_ICON[item.slot]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{item.name}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground break-words">{item.description}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={`text-sm font-bold tabular-nums ${affordable ? "text-[var(--xp)]" : "text-muted-foreground"}`}>
          💰 {item.price}
        </span>
        <Button size="sm" className="h-8 gap-1 px-3 text-xs" disabled={!affordable || busy} onClick={onBuy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Buy
        </Button>
      </div>
    </div>
  );
}

export function ShopView({ open, onOpenChange, user, onRefresh }: ShopViewProps) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const gold = user?.gold ?? 0;

  const buy = async (itemId: string) => {
    setMessage(null);
    setBusyId(itemId);
    try {
      await api("/api/shop/buy", { method: "POST", body: JSON.stringify({ itemId }) });
      onRefresh();
      setMessage({ kind: "success", text: "Purchased - check your backpack." });
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Purchase failed." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>Shop</span>
            <span className="rounded-full bg-[color-mix(in_oklab,var(--xp)_15%,transparent)] px-3 py-1 text-sm font-bold text-[var(--xp)]">
              💰 {gold}
            </span>
          </DialogTitle>
          <DialogDescription>
            Spend gold on healing potions, damage boosts, and bombs. Gold drops from official enemies. Purchases go to
            your backpack and can be used during battle.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <p className={`rounded-md px-3 py-1.5 text-xs font-semibold ${message.kind === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
            {message.text}
          </p>
        )}

        {consumables.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing for sale right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {consumables.map((item) => (
              <ShopItemCard key={item.id} item={item} gold={gold} busy={busyId === item.id} onBuy={() => void buy(item.id)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}