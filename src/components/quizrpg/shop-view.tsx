"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { NormalizedUser } from "@/lib/models";
import { ITEMS } from "@/lib/adventure-data";

interface ShopViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

const consumables = ITEMS.filter((i) => i.slot === "CONSUMABLE" && i.price > 0);

export function ShopView({ open, onOpenChange, user, onRefresh }: ShopViewProps) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const buy = async (itemId: string, price: number) => {
    setMessage(null);
    try {
      await api("/api/shop/buy", { method: "POST", body: JSON.stringify({ itemId }) });
      onRefresh();
      setMessage({ kind: "success", text: "Purchased." });
    } catch (err: any) {
      setMessage({ kind: "error", text: err?.message ?? "Purchase failed." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md p-4">
      <DialogHeader>
        <DialogTitle>Shop</DialogTitle>
        <DialogDescription>
          Spend gold on healing potions, damage boosts, and bombs. Gold drops from official enemies.
        </DialogDescription>
      </DialogHeader>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold">💰 Gold: {user?.gold ?? 0}</span>
        {message && (
          <span className={`text-xs ${message.kind === "success" ? "text-emerald-600" : "text-destructive"}`}>
            {message.text}
          </span>
        )}
      </div>
      <CardContent>
        {consumables.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing for sale right now.</p>
        ) : (
          consumables.map((item) => (
            <Card key={item.id} className="panel-frame">
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--xp)]">{item.price} 💰</span>
                  <Button
                    size="sm"
                    disabled={(user?.gold ?? 0) < item.price}
                    onClick={() => buy(item.id, item.price)}
                  >
                    Buy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
      <DialogDescription className="mt-3 text-xs text-muted-foreground">
        Purchased consumables go to your backpack and can be used during battle.
      </DialogDescription>
    </DialogContent>
    </Dialog>
  );
}