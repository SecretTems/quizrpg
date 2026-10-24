"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Mail, Swords, Loader2, LogIn, UserPlus, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { api, useAuth } from "@/lib/store";
import type { SafeUser } from "@/lib/types";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle light or dark mode"
      className="rounded-full"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}

function PasswordInput({ id, name, value, onChange, required, placeholder, autoComplete, hint }: {
  id: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Password</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={72}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Security notice: admins/super admins who sign in without 2FA configured are
 * warned to enable it in Profile → Two-factor authentication.
 */
function warnIfNo2FA(user: SafeUser) {
  if ((user.role === "ADMIN" || user.role === "SUPER_ADMIN") && !user.twoFactorEnabled) {
    window.dispatchEvent(new CustomEvent("quizrpg:2fa-warning", { detail: user.displayName }));
  }
}

export function AuthScreen() {
  const setUser = useAuth((s) => s.setUser);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"login" | "register" | "otp">("login");
  const [otpEmail, setOtpEmail] = useState("");

  const [regForm, setRegForm] = useState({ username: "", email: "", displayName: "", password: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [totpCode, setTotpCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  /** single-use token issued after the password step for admins with 2FA */
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  // forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "newpass">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ user: SafeUser; requires2FA?: boolean; pendingToken?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      if (data.requires2FA && data.pendingToken) {
        // step 2 - admins/super admins with 2FA get a code prompt
        setPendingToken(data.pendingToken);
        setTotpCode("");
        toast({ title: "2FA required", description: "Enter the 6-digit code from your authenticator app." });
        return;
      }
      setUser(data.user);
      warnIfNo2FA(data.user);
      toast({ title: "Welcome back!", description: `Glory awaits, ${data.user.displayName}.` });
    } catch (err: any) {
      if (err?.lockedUntil) {
        const mins = Math.max(1, Math.ceil((err.lockedUntil - Date.now()) / 60000));
        toast({ title: "Account locked", description: `Too many failed attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`, variant: "destructive" });
      } else if (err?.requiresEmailVerification) {
        setOtpEmail(loginForm.username);
        setOtpCode("");
        setStep("otp");
        toast({ title: "Verify your email", description: "Enter the code we emailed you, or request a new one.", variant: "destructive" });
      } else {
        toast({ title: "Access denied", description: err?.message || "Login failed.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }, [loginForm, setUser, toast]);

  const handleTotpLogin = useCallback(async () => {
    if (!pendingToken) return;
    setBusy(true);
    try {
      const data = await api<{ user: SafeUser; requires2FA?: boolean; requiresLogin?: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ pendingToken, totpCode }),
      });
      if (data.requiresLogin) {
        // the pending session expired - fall back to the password step
        setPendingToken(null);
        setTotpCode("");
        toast({ title: "2FA session expired", description: "Please log in again.", variant: "destructive" });
        return;
      }
      setUser(data.user);
      setPendingToken(null);
      setTotpCode("");
      warnIfNo2FA(data.user);
      toast({ title: "Welcome back!", description: `Glory awaits, ${data.user.displayName}.` });
    } catch (err: any) {
      if (err?.requires2FA) {
        // wrong code - the token was consumed, so request a fresh pending login
        setPendingToken(null);
        toast({ title: "2FA failed", description: "Invalid code - log in again to retry.", variant: "destructive" });
      } else {
        toast({ title: "2FA failed", description: err?.message || "Invalid code.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  }, [pendingToken, totpCode, setUser, toast]);

  const handleRegister = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api<{ user: SafeUser; requiresEmailVerification: boolean }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(regForm),
      });
      setOtpEmail(regForm.email);
      setOtpCode("");
      setStep("otp");
      toast({ title: "Hero created!", description: "Check your email for the verification code." });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [regForm, toast]);

  const handleOtpVerify = useCallback(async () => {
    setBusy(true);
    try {
      await api("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: otpEmail, code: otpCode, purpose: "verify" }),
      });
      const user = await api<SafeUser>("/api/auth/me");
      setUser(user);
      setOtpCode("");
      setStep("login");
      toast({ title: "Email verified!", description: "Welcome to the arena." });
    } catch (err: any) {
      toast({ title: "Verification failed", description: err?.message || "Invalid code.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [otpEmail, otpCode, setUser, toast]);

  const handleResendOtp = useCallback(async () => {
    setBusy(true);
    try {
      await api("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email: otpEmail, purpose: "verify" }),
      });
      toast({ title: "Code sent", description: "A new verification code is on its way." });
    } catch (err: any) {
      toast({ title: "Resend failed", description: err?.message || "Could not resend code.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [otpEmail, toast]);

  /* ---------- forgot password flow ---------- */

  const openForgot = useCallback(() => {
    setForgotStep("email");
    setForgotEmail("");
    setForgotCode("");
    setNewPassword("");
    setShowForgot(true);
  }, []);

  const handleForgotEmail = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotStep("otp");
      toast({ title: "Code sent", description: "If that email is registered, a reset code is on its way." });
    } catch (err: any) {
      toast({ title: "Request failed", description: err?.message || "Could not send reset code.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [forgotEmail, toast]);

  const handleForgotOtp = useCallback(async () => {
    setBusy(true);
    try {
      await api("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail, code: forgotCode, purpose: "reset" }),
      });
      setForgotStep("newpass");
    } catch (err: any) {
      toast({ title: "Invalid code", description: err?.message || "Could not verify code.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [forgotEmail, forgotCode, toast]);

  const handleForgotReset = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail, code: forgotCode, password: newPassword }),
      });
      setShowForgot(false);
      toast({ title: "Password reset", description: "Log in with your new password." });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err?.message || "Could not reset password.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, [forgotEmail, forgotCode, newPassword, toast]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_75/0.12),transparent_60%)]" />
        <span className="absolute left-[8%] top-[18%] text-4xl opacity-20 animate-floaty">⚔️</span>
        <span className="absolute right-[10%] top-[24%] text-5xl opacity-20 animate-floaty" style={{ animationDelay: "0.8s" }}>🐉</span>
        <span className="absolute left-[14%] bottom-[16%] text-5xl opacity-20 animate-floaty" style={{ animationDelay: "1.4s" }}>🛡️</span>
        <span className="absolute right-[16%] bottom-[20%] text-4xl opacity-20 animate-floaty" style={{ animationDelay: "2s" }}>📜</span>
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md flex flex-col items-center gap-8"
      >
        <div className="text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Swords className="h-5 w-5" />
            <h1 className="font-display text-3xl font-bold tracking-tight">QUIZRPG</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed break-words">
            Turn your reviewers into battles. Answer questions, slay monsters, earn XP - and level up your learning.
          </p>
        </div>

        <Card className="w-full panel-frame">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Enter the arena</CardTitle>
            <CardDescription>Log in, or forge a new hero.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={step} onValueChange={(v) => setStep(v as typeof step)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="register">Sign up</TabsTrigger>
              </TabsList>

              {/* LOG IN */}
              <TabsContent value="login" className="mt-4">
                {pendingToken ? (
                  /* step 2 - TOTP prompt shown only after a valid password + admin role */
                  <div className="space-y-4">
                    <div className="flex items-start gap-2 text-sm">
                      <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="min-w-0 break-words">
                        Admin account detected. Enter the 6-digit code from your authenticator app to finish signing in.
                      </p>
                    </div>
                    <div className="flex justify-center py-2">
                      <InputOTP maxLength={6} value={totpCode} onChange={(v) => setTotpCode(v)}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={busy || totpCode.length !== 6}
                      onClick={() => void handleTotpLogin()}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Verify & sign in
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-xs"
                      disabled={busy}
                      onClick={() => {
                        setPendingToken(null);
                        setTotpCode("");
                      }}
                    >
                      Back to login
                    </Button>
                  </div>
                ) : (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      required
                      maxLength={20}
                      autoComplete="username"
                    />
                  </div>
                  <PasswordInput
                    id="login-password"
                    value={loginForm.password}
                    onChange={(v) => setLoginForm({ ...loginForm, password: v })}
                    required
                    autoComplete="current-password"
                  />
                  <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Log in
                  </Button>
                  <button
                    type="button"
                    className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={openForgot}
                  >
                    Forgot your password?
                  </button>
                </form>
                )}
              </TabsContent>

              {/* SIGN UP */}
              <TabsContent value="register" className="mt-4">
                <form className="space-y-4" onSubmit={handleRegister}>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                      required
                      maxLength={20}
                      pattern="[a-zA-Z0-9_]+"
                      title="3-20 characters: letters, numbers, underscore"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-display">
                      Display name <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="reg-display"
                      value={regForm.displayName}
                      onChange={(e) => setRegForm({ ...regForm, displayName: e.target.value })}
                      maxLength={30}
                    />
                  </div>
                  <PasswordInput
                    id="reg-password"
                    value={regForm.password}
                    onChange={(v) => setRegForm({ ...regForm, password: v })}
                    required
                    autoComplete="new-password"
                    hint="At least 8 characters, 1 number, and 1 special character."
                  />
                  <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Create hero
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    You&apos;ll be asked to verify your email with a 6-digit code before you can log in.
                  </p>
                </form>
              </TabsContent>

              {/* EMAIL OTP VERIFICATION */}
              <TabsContent value="otp" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="min-w-0 break-words">
                      Enter the 6-digit code sent to <span className="font-semibold break-all">{otpEmail}</span>.
                    </p>
                  </div>
                  <div className="flex justify-center py-2">
                    <InputOTP maxLength={6} value={otpCode} onChange={(v) => setOtpCode(v)}>
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button type="button" className="w-full" disabled={busy || otpCode.length !== 6} onClick={() => void handleOtpVerify()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Verify email
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-xs" disabled={busy} onClick={() => void handleResendOtp()}>
                    Resend code
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* FORGOT PASSWORD MODAL */}
      <Dialog open={showForgot} onOpenChange={setShowForgot}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              {forgotStep === "email" && "Enter the email on your account and we'll send a 6-digit reset code."}
              {forgotStep === "otp" && "Enter the 6-digit code we emailed you."}
              {forgotStep === "newpass" && "Choose a new password for your account."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === "email" && (
            <form className="space-y-4" onSubmit={handleForgotEmail}>
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send reset code
                </Button>
              </DialogFooter>
            </form>
          )}

          {forgotStep === "otp" && (
            <div className="space-y-4">
              <div className="flex justify-center py-2">
                <InputOTP maxLength={6} value={forgotCode} onChange={(v) => setForgotCode(v)}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="button" className="w-full" disabled={busy || forgotCode.length !== 6} onClick={() => void handleForgotOtp()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify code
              </Button>
            </div>
          )}

          {forgotStep === "newpass" && (
            <form className="space-y-4" onSubmit={handleForgotReset}>
              <PasswordInput
                id="forgot-new-password"
                value={newPassword}
                onChange={(v) => setNewPassword(v)}
                required
                autoComplete="new-password"
                hint="At least 8 characters, 1 number, and 1 special character."
              />
              <DialogFooter>
                <Button type="submit" className="w-full gap-1.5" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Reset password
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}