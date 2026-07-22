"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { PinPad } from "./pin-pad";
import { hasPinSet, setPin, verifyPin, removePin } from "@/lib/pin";

type Step = "idle" | "verify_old" | "enter_new" | "confirm_new";

export function PinSettingsSheet() {
  const [open, setOpen] = useState(false);
  const [pinExists, setPinExists] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [firstEntry, setFirstEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setPinExists(hasPinSet());
      setStep("idle");
      setError(null);
    }
  }

  function startSetup() {
    setStep(pinExists ? "verify_old" : "enter_new");
    setError(null);
  }

  async function handlePinEntry(pin: string) {
    if (step === "verify_old") {
      const valid = await verifyPin(pin);
      if (!valid) {
        setError("PIN lama salah.");
        setPadKey((k) => k + 1);
        return;
      }
      setStep("enter_new");
      setError(null);
      return;
    }

    if (step === "enter_new") {
      setFirstEntry(pin);
      setStep("confirm_new");
      setError(null);
      return;
    }

    if (step === "confirm_new") {
      if (pin !== firstEntry) {
        setError("PIN gak cocok. Coba dari awal.");
        setStep("enter_new");
        setFirstEntry("");
        setPadKey((k) => k + 1);
        return;
      }
      await setPin(pin);
      setPinExists(true);
      setStep("idle");
      setError(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="bg-surface-muted" aria-label="Kunci PIN">
          <Lock className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Kunci PIN
        </SheetTitle>

        {step === "idle" && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              {pinExists
                ? "PIN aktif. App bakal minta PIN tiap kali dibuka atau di-resume."
                : "Belum ada PIN. Aktifin biar app minta PIN tiap kali dibuka — cocok kalau HP sering dipegang orang lain sebentar."}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Catatan: ini gerbang tampilan, bukan enkripsi data. Untuk proteksi
              maksimal, jangan install app di device yang gak kamu percaya.
            </p>
            <div className="mt-5 flex gap-3">
              <Button className="flex-1" onClick={startSetup}>
                {pinExists ? "Ubah PIN" : "Aktifkan PIN"}
              </Button>
              {pinExists && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmRemove(true)}
                >
                  Matikan PIN
                </Button>
              )}
            </div>
          </>
        )}

        {step !== "idle" && (
          <div className="mt-6">
            <p className="mb-6 text-center text-sm text-ink-muted">
              {step === "verify_old" && "Masukkan PIN lama kamu"}
              {step === "enter_new" && "Masukkan PIN baru (6 digit)"}
              {step === "confirm_new" && "Ulangi PIN baru"}
            </p>
            {error && (
              <p className="mb-4 text-center text-sm text-danger">{error}</p>
            )}
            <PinPad key={padKey} onComplete={handlePinEntry} error={Boolean(error)} />
          </div>
        )}
      </SheetContent>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Matikan PIN?"
        description="App gak akan minta PIN lagi tiap dibuka. Siapapun yang pegang device ini bisa langsung lihat data kamu."
        destructive
        confirmLabel="Matikan"
        onConfirm={() => {
          removePin();
          setPinExists(false);
          setConfirmRemove(false);
        }}
      />
    </Sheet>
  );
}
