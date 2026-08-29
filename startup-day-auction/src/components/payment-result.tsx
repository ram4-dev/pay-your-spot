"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ResultState = "syncing" | "approved" | "pending" | "failure" | "error";

export function PaymentResult({
  result,
  paymentId,
  testMode,
}: {
  result?: string;
  paymentId?: string;
  testMode: boolean;
}) {
  const initialState: ResultState = testMode
    ? "approved"
    : result === "failure"
      ? "failure"
      : result === "pending" || !paymentId
        ? "pending"
        : "syncing";
  const [state, setState] = useState<ResultState>(initialState);

  useEffect(() => {
    if (initialState !== "syncing" || !paymentId) return;

    void fetch("/api/payments/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("sync failed");
        setState("approved");
      })
      .catch(() => setState("error"));
  }, [initialState, paymentId]);

  const content = {
    syncing: ["…", "Confirmando tu pago", "Estamos consultando el estado directamente con Mercado Pago."],
    approved: ["✓", "Oferta confirmada", "Tu pago fue aprobado y la landing ya refleja el nuevo liderazgo."],
    pending: ["↻", "Pago pendiente", "Todavía no recibimos una aprobación. La oferta no lidera hasta que el pago se confirme."],
    failure: ["×", "El pago no se completó", "El lugar sigue disponible. Podés volver y crear un checkout nuevo."],
    error: ["!", "No pudimos sincronizarlo", "El webhook seguirá intentando. Volvé a la subasta para ver el estado actualizado."],
  } satisfies Record<ResultState, [string, string, string]>;
  const [mark, title, copy] = content[state];

  return (
    <main className="payment-page">
      <section className="payment-card" aria-live="polite">
        <div className="payment-mark">{mark}</div>
        <h1>{title}</h1>
        <p>{copy}</p>
        <Link className="button button--dark" href="/">Volver a la subasta</Link>
      </section>
    </main>
  );
}
