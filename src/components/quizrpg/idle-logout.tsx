"use client";

import { useEffect, useRef, useState } from "react";
import { Timer, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/store";

const IDLE_LIMIT_MS = 15 * 60 * 1000; // log out after 15 minutes of inactivity
const WARN_BEFORE_MS = 60 * 1000; // show the "still there?" modal 1 minute before

/**
 * Watches user activity (mouse, keys, scroll, touch) and logs the player out
 * after 15 idle minutes. One minute before the cutoff a modal appears with a
 * countdown; any activity (or clicking "Stay logged in") resets the timer.
 */
export function IdleLogout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);
  const idleLoggedOutRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();
    warnedRef.current = false;
    idleLoggedOutRef.current = false;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      if (warnedRef.current) {
        warnedRef.current = false;
        setWarnOpen(false);
      }
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;

      if (idle >= IDLE_LIMIT_MS) {
        if (!idleLoggedOutRef.current) {
          idleLoggedOutRef.current = true;
          setWarnOpen(false);
          void logout();
        }
        return;
      }

      const remaining = IDLE_LIMIT_MS - idle;
      if (remaining <= WARN_BEFORE_MS && !warnedRef.current) {
        warnedRef.current = true;
        setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));
        setWarnOpen(true);
      } else if (warnedRef.current) {
        setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, [user, logout]);

  if (!user) return null;

  return (
    <Dialog
      open={warnOpen}
      onOpenChange={(open) => {
        if (!open) {
          // closing the modal counts as "stay logged in"
          lastActivityRef.current = Date.now();
          warnedRef.current = false;
          setWarnOpen(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" /> Still there?
          </DialogTitle>
          <DialogDescription>
            You've been inactive for a while. For your account's safety you'll be
            logged out automatically when the timer runs out.
          </DialogDescription>
        </DialogHeader>
        <p className="text-center font-display text-3xl tabular-nums" aria-live="polite">
          {secondsLeft}s
        </p>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button
            onClick={() => {
              lastActivityRef.current = Date.now();
              warnedRef.current = false;
              setWarnOpen(false);
            }}
            className="gap-1.5"
          >
            Stay logged in
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" /> Log out now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
