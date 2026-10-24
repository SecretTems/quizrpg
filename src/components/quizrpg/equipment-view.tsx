"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { api } from "@/lib/store";
import { cn } from "@/lib/utils";
import { itemById, SLOT_ICON } from "@/lib/adventure-data";
import type { NormalizedUser } from "@/lib/models";

interface EquipmentViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: NormalizedUser | null;
  onRefresh: () => void;
}

interface BackpackEntry {
  qty: number;
  piece?: { itemId: string; name: string; slot: string; atk: number; def: number; rarity: string } | null;
}

type Slot = "WEAPON" | "ARMOR" | "ACCESSORY";

const SLOT_LABEL: Record<Slot, string> = { WEAPON: "Weapon", ARMOR: "Armor", ACCESSORY: "Accessory" };
const SLOTS: Slot[] = ["WEAPON", "ARMOR", "ACCESSORY"];
const PER_PAGE = 25; // 5 × 5 storage grid

const RING_BY_RARITY: Record<string, string> = {
  LEGENDARY: "border-amber-500/70",
  EPIC: "border-violet-500/70",
  RARE: "border-sky-500/70",
  COMMON: "border-border",
};

/** Square art tile for an item - custom image when present, slot emoji otherwise. */
function ItemTile({ itemId, className }: { itemId: string; className?: string }) {
  const def = itemById(itemId);
  if (def?.image) {
    return <img src={def.image} alt="" className={cn("rounded-lg object-cover", className)} />;
  }
  return (
    <span className={cn("flex items-center justify-center rounded-lg bg-primary/10", className)} aria-hidden="true">
      <span className="text-2xl">{def ? SLOT_ICON[def.slot] : "🎁"}</span>
    </span>
  );
}

export function EquipmentView({ open, onOpenChange, user, onRefresh }: EquipmentViewProps) {
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  /** which loadout slot is being picked for (0-2), or null when not picking */
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  /* ---- derived straight from the refreshed user prop (never stale) ---- */
  const backpack = (user?.backpack ?? {}) as Record<string, BackpackEntry>;
  const equipped = user?.equipment ?? { WEAPON: null, ARMOR: null, ACCESSORY: null };
  const entries = Object.entries(backpack);
  const totalQty = entries.reduce((sum, [, e]) => sum + (e?.qty ?? 0), 0);
  const equippedIds = new Set(
    Object.values(equipped)
      .map((p) => p?.itemId)
      .filter((v): v is string => Boolean(v)),
  );
  const selected = selectedItemId && backpack[selectedItemId] ? selectedItemId : null;
  const selectedDef = selected ? itemById(selected) : undefined;

  const pages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
  const safePage = Math.min(page, pages - 1);
  const pageEntries = entries.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);
  /* ---- battle loadout: 3 slots, each holds ONE consumable (duplicates allowed) ---- */
  const loadout = (user?.loadout ?? [null, null, null]).slice(0, 3) as (string | null)[];
  const consumableEntries = entries.filter(([id]) => itemById(id)?.slot === "CONSUMABLE");

  function saveLoadout(next: (string | null)[]) {
    void act({ action: "setLoadout", loadout: next }, "Loadout saved.");
  }

  function setLoadoutSlot(index: number, itemId: string | null) {
    const next = [...loadout];
    next[index] = itemId;
    setPickingSlot(null);
    saveLoadout(next);
  }

  /** Equip button on an empty slot - uses the Storage selection with a type check. */
  function equipSelectedInto(slot: Slot) {
    if (!selected || !selectedDef) {
      setMessage({ kind: "error", text: "Select an item in Storage first, then click Equip." });
      return;
    }
    if (selectedDef.slot !== slot) {
      setMessage({
        kind: "error",
        text: `${selectedDef.name} doesn't fit the ${SLOT_LABEL[slot].toLowerCase()} slot.`,
      });
      return;
    }
    void act({ action: "equip", itemId: selected, slot }, `Equipped ${selectedDef.name}.`);
  }

  async function act(body: Record<string, unknown>, okMsg: string) {
    setMessage(null);
    setBusy(true);
    try {
      await api("/api/equip", { method: "POST", body: JSON.stringify(body) });
      onRefresh();
      setMessage({ kind: "success", text: okMsg });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setBusy(false);
    }
  }

  function unequip(slot: Slot) {
    void act({ action: "unequip", slot }, "Unequipped.");
  }

  function discardSelected() {
    if (!selected) return;
    void act({ action: "discard", itemId: selected }, "Item discarded.");
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto p-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Equipment</DialogTitle>
          <DialogDescription>
            Select an item in Storage, then click Equip on a slot - or equip straight from your Inventory.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div
            className={cn(
              "rounded border p-2 text-sm",
              message.kind === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
            role="status"
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* ---------- left: equipment + inventory ---------- */}
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Equipment</h4>
              <div className="space-y-2">
                {SLOTS.map((slot) => {
                  const piece = equipped[slot];
                  return (
                    <div
                      key={slot}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2"
                    >
                      {piece ? (
                        <ItemTile itemId={piece.itemId} className="h-14 w-14 shrink-0 border-2 border-border" />
                      ) : (
                        <span
                          className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed border-border/70"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{SLOT_LABEL[slot]}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {piece ? `${piece.name} · ATK ${piece.atk} / DEF ${piece.def}` : "Empty slot"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => (piece ? unequip(slot) : equipSelectedInto(slot))}
                      >
                        {piece ? "Unequip" : "Equip"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Battle loadout</h4>
                <span className="text-[11px] tabular-nums text-muted-foreground">3 slots · 1 item each</span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Pick which consumables you bring into battle. Each slot holds one item - the same item can fill all
                three slots. The stack stays in storage; using one in battle consumes a single unit.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {loadout.map((itemId, i) => {
                  const def = itemId ? itemById(itemId) : undefined;
                  const qty = itemId ? (backpack[itemId]?.qty ?? 0) : 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={busy}
                      onClick={() => setPickingSlot(pickingSlot === i ? null : i)}
                      aria-pressed={pickingSlot === i}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all hover:border-primary/50",
                        pickingSlot === i ? "border-primary ring-2 ring-primary/40" : "border-border/60",
                      )}
                    >
                      {def ? (
                        <ItemTile itemId={itemId!} className={cn("h-14 w-14 border-2", RING_BY_RARITY[def.rarity] ?? "border-border")} />
                      ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed border-border/70 text-muted-foreground" aria-hidden="true">+</span>
                      )}
                      <span className="w-full truncate text-center text-[10px] font-semibold">{def?.name ?? "Empty slot"}</span>
                      {def && qty > 0 && <span className="text-[10px] text-muted-foreground">×{qty} in storage</span>}
                    </button>
                  );
                })}
              </div>

              {pickingSlot !== null && (
                <div className="mt-2 space-y-1 rounded-lg border border-primary/40 bg-primary/5 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold">Fill slot {pickingSlot + 1}:</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" disabled={busy} onClick={() => setLoadoutSlot(pickingSlot, null)}>
                      Clear slot
                    </Button>
                  </div>
                  {consumableEntries.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No consumables in storage - visit the Shop.</p>
                  ) : (
                    <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">
                      {consumableEntries.map(([id, entry]) => {
                        const d = itemById(id);
                        if (!d) return null;
                        // a slot holds one unit - grey out the option once every
                        // owned unit is already sitting in another slot
                        const usedInOtherSlots = loadout.filter((v, i) => v === id && i !== pickingSlot).length;
                        const owned = entry.qty ?? 1;
                        const exhausted = usedInOtherSlots >= owned;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={busy || exhausted}
                            title={exhausted ? `All ${owned}× already in your loadout` : `${d.name} ×${owned}`}
                            onClick={() => setLoadoutSlot(pickingSlot, id)}
                            className={cn(
                              "flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-1 text-[10px] font-semibold hover:border-primary",
                              exhausted && "cursor-not-allowed opacity-40 hover:border-border",
                            )}
                          >
                            <ItemTile itemId={id} className="h-6 w-6" />
                            <span className="max-w-24 truncate">{d.name}</span>
                            <span className="text-muted-foreground">×{owned}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ---------- right: storage ---------- */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Storage</h4>
              <span className="text-[11px] tabular-nums text-muted-foreground">{totalQty}/100 items</span>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                Your storage is empty.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: PER_PAGE }).map((_, i) => {
                    const entry = pageEntries[i];
                    if (!entry) {
                      return (
                        <span
                          key={`empty-${i}`}
                          className="aspect-square rounded-lg border border-dashed border-border/50"
                          aria-hidden="true"
                        />
                      );
                    }
                    const [itemId, e] = entry;
                    const def = itemById(itemId);
                    const isSelected = selected === itemId;
                    const isEquipped = equippedIds.has(itemId);
                    return (
                      <button
                        key={itemId}
                        type="button"
                        onClick={() => setSelectedItemId(itemId)}
                        aria-pressed={isSelected}
                        title={def?.name ?? itemId}
                        className={cn(
                          "relative flex aspect-square items-center justify-center rounded-lg border-2 bg-card p-1.5 transition-all hover:border-primary/50",
                          isSelected
                            ? "border-primary ring-2 ring-primary/40"
                            : (def && RING_BY_RARITY[def.rarity]) || "border-border",
                          isEquipped && "opacity-70",
                        )}
                      >
                        <ItemTile itemId={itemId} className="h-full w-full" />
                        {(e.qty ?? 1) > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold tabular-nums text-white">
                            {e.qty}
                          </span>
                        )}
                        {isEquipped && (
                          <span className="absolute left-0.5 top-0.5 rounded bg-primary px-1 text-[8px] font-bold uppercase text-primary-foreground">
                            on
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="min-h-8 rounded-md border border-border/50 bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {selected && selectedDef ? (
                    <>
                      <span className="font-semibold text-foreground">{selectedDef.name}</span>
                      {" · "}
                      {SLOT_LABEL[selectedDef.slot as Slot] ?? selectedDef.slot}
                      {selectedDef.slot !== "CONSUMABLE" && (
                        <> · ATK {selectedDef.atk} / DEF {selectedDef.def}</>
                      )}
                      {equippedIds.has(selected) && <span className="ml-1 font-bold text-primary">· Equipped</span>}
                      {(backpack[selected]?.qty ?? 1) > 1 && <> · ×{backpack[selected]?.qty}</>}
                    </>
                  ) : (
                    "Select an item to equip it into a slot or discard it."
                  )}
                </p>

                <div className="flex items-center justify-between">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={!selected || busy || (selected ? equippedIds.has(selected) : true)}
                        aria-label="Discard selected item"
                        title={selected && equippedIds.has(selected) ? "Unequip it first" : "Discard the selected item"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Discard {selectedDef?.name ?? "this item"}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          One unit will be removed from your storage. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => discardSelected()}
                        >
                          Discard
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={safePage <= 0}
                      aria-label="Previous storage page"
                      onClick={() => setPage(safePage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-10 text-center text-xs font-semibold tabular-nums">
                      {safePage + 1}/{pages}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={safePage >= pages - 1}
                      aria-label="Next storage page"
                      onClick={() => setPage(safePage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogDescription className="text-xs">
          Equipped gear boosts your battle stats. Storage holds up to 100 items - discard what you don't need.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
