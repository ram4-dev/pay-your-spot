"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TestCheckoutButton({ bidId }: { bidId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function approve() {
    setSubmitting(true);
    setError(null);
    const response = await fetch(`/api/test/payments/${encodeURIComponent(bidId)}/approve`, {
      method: "POST",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "No se pudo aprobar el pago de prueba.");
      setSubmitting(false);
      return;
    }
    router.push("/pago/resultado?result=success&test=1");
  }

  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button--red dialog-submit" type="button" onClick={approve} disabled={submitting}>
        {submitting ? "Confirmando…" : "Aprobar pago de prueba"}
      </button>
    </>
  );
}
