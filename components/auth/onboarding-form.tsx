"use client";

import { useActionState, useState } from "react";
import {
  createHouseholdAction,
  joinHouseholdAction,
} from "@/actions/household";
import type { ActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: ActionResult = { error: null };

export function OnboardingForm() {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [createState, createFormAction, isCreating] = useActionState(
    createHouseholdAction,
    initialState
  );
  const [joinState, joinFormAction, isJoining] = useActionState(
    joinHouseholdAction,
    initialState
  );

  const state = mode === "create" ? createState : joinState;
  const formAction = mode === "create" ? createFormAction : joinFormAction;
  const isPending = mode === "create" ? isCreating : isJoining;

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="text-center">
        <p className="font-display text-2xl font-semibold text-ink">
          Satu langkah lagi 🌱
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Buat household baru, atau join punya pacar kamu.
        </p>
      </div>

      <div className="flex rounded-2xl bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            mode === "create" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Buat baru
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            mode === "join" ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          Join household
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === "create" ? "Buat household" : "Join household"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Kamu akan dapat kode undangan untuk dibagikan ke pacar."
              : "Minta kode undangan dari pacar kamu."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {mode === "create" ? (
              <div className="space-y-1.5">
                <Label htmlFor="household_name">Nama household</Label>
                <Input
                  id="household_name"
                  name="household_name"
                  placeholder="misal: Kita Berdua"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="invite_code">Kode undangan</Label>
                <Input
                  id="invite_code"
                  name="invite_code"
                  placeholder="masukkan kode dari pacar"
                  required
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
            )}

            {state.error && (
              <p className="rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">
                {state.error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isPending}>
              {isPending
                ? "Memproses..."
                : mode === "create"
                  ? "Buat household"
                  : "Join sekarang"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
