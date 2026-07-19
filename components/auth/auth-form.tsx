"use client";

import { useActionState } from "react";
import { useState } from "react";
import { signIn, signUp, type ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionResult = { error: null };

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="font-display text-3xl font-semibold text-ink">
          Money Tracker
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Catat keuangan kalian berdua, kapan aja.
        </p>
      </div>

      <div className="mb-6 flex rounded-2xl bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            mode === "signin" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Masuk
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            mode === "signup" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Daftar
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" placeholder="Nama kamu" required />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="kamu@email.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>

        {state.error && (
          <p className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending
            ? "Memproses..."
            : mode === "signin"
              ? "Masuk"
              : "Buat akun"}
        </Button>
      </form>
    </div>
  );
}
