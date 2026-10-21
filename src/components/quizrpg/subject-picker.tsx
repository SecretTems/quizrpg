"use client";

import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Subject picker: tap an available subject to add it, tap the X on a selected
 * chip to remove it. Replaces the old comma-separated free-text input.
 */
export function SubjectPicker({
  available,
  selected,
  onChange,
}: {
  available: string[];
  selected: string[];
  onChange: (subjects: string[]) => void;
}) {
  const toggle = (s: string) => {
    if (selected.includes(s)) onChange(selected.filter((x) => x !== s));
    else onChange([...selected, s]);
  };

  const remove = (s: string) => onChange(selected.filter((x) => x !== s));

  const addCustom = () => {
    const input = document.getElementById("custom-subject-input") as HTMLInputElement | null;
    const value = input?.value.trim();
    if (!value) return;
    if (!selected.includes(value)) onChange([...selected, value]);
    if (input) input.value = "";
  };

  const notSelected = available.filter((s) => !selected.includes(s));

  return (
    <div className="space-y-2">
      {/* selected subjects as removable chips */}
      <div className="flex flex-wrap gap-1.5">
        {selected.length === 0 && (
          <p className="text-xs text-muted-foreground">No subjects selected yet.</p>
        )}
        {selected.map((s) => (
          <span
            key={s}
            className="group inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold"
          >
            {s}
            <button
              type="button"
              aria-label={`Remove ${s}`}
              className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100 hover:text-destructive"
              onClick={() => remove(s)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {/* available subjects as tap-to-add buttons */}
      {notSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notSelected.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={cn(
                "rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
              )}
            >
              <Plus className="mr-1 inline h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* custom subject entry */}
      <div className="flex gap-1.5">
        <Input
          id="custom-subject-input"
          placeholder="Add a custom subject…"
          maxLength={40}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={addCustom}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
