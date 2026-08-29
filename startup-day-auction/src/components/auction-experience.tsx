"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { formatArs } from "@/lib/auction/format";
import type { AuctionState, PublicSpot } from "@/lib/auction/types";

const steps = [
  {
    title: "Elegí el lugar",
    copy: "Cada módulo muestra su estado, la oferta líder y el mínimo exacto para entrar.",
  },
  {
    title: "Pagá tu oferta",
    copy: "Mercado Pago confirma la puja en pesos. Hasta ese momento el reloj no comienza.",
  },
  {
    title: "Ganalo en 72 horas",
    copy: "Si seguís primero al cierre, el lugar queda bloqueado para tu marca.",
  },
];

export function AuctionExperience({ initialState }: { initialState: AuctionState }) {
  const [state, setState] = useState(initialState);
  const [selectedId, setSelectedId] = useState(
    initialState.spots.find((spot) => spot.status !== "LOCKED")?.id ?? initialState.spots[0]?.id,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auction", { cache: "no-store" });
    if (response.ok) setState((await response.json()) as AuctionState);
  }, []);

  useEffect(() => {
    const stateTimer = window.setInterval(() => void refresh(), 4_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      window.clearInterval(stateTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  useEffect(() => {
    if (!dialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [dialogOpen]);

  const selectedSpot = useMemo(
    () => state.spots.find((spot) => spot.id === selectedId) ?? state.spots[0],
    [selectedId, state.spots],
  );

  function openSpot(spot: PublicSpot) {
    if (spot.status === "LOCKED") return;
    setSelectedId(spot.id);
    setDialogOpen(true);
  }

  const nearestEnd = state.spots
    .filter((spot) => spot.status === "ACTIVE" && spot.endsAt)
    .map((spot) => spot.endsAt!)
    .sort()[0];

  return (
    <main className="page-shell">
      <header className="site-header">
        <nav className="nav-shell" aria-label="Navegación principal">
          <a className="brand" href="#inicio">
            Startup Day <sup>2026</sup>
          </a>
          <div className="nav-links">
            <a href="#subasta">Subasta en vivo</a>
            <a href="#como-funciona">Cómo funciona</a>
          </div>
          <button
            className="button button--dark nav-action"
            type="button"
            onClick={() => selectedSpot && openSpot(selectedSpot)}
          >
            Quiero un lugar <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>

      <section className="hero" id="inicio">
        <div className="live-pill">
          <span className="live-dot" />
          {state.metrics.activeAuctions} {state.metrics.activeAuctions === 1 ? "subasta activa" : "subastas activas"}
        </div>
        <h1>
          Tu marca, en el <em>centro.</em>
        </h1>
        <p className="hero-copy">
          Elegí un lugar real en la pancarta principal, ofertá en pesos y seguí la subasta durante 72 horas.
        </p>
        <div className="metric-row" aria-label="Estado actual de la subasta">
          <div className="metric">
            <strong data-testid="active-auctions">{state.metrics.activeAuctions}</strong>
            <span>Subastas activas ahora</span>
          </div>
          <div className="metric">
            <strong data-testid="total-raised">{formatArs(state.metrics.totalRaisedCents)}</strong>
            <span>Recaudado confirmado</span>
          </div>
          <div className="metric">
            <strong>{nearestEnd ? formatCountdown(nearestEnd, now) : "—"}</strong>
            <span>{nearestEnd ? "Próximo cierre" : "Esperando la primera oferta"}</span>
          </div>
        </div>
      </section>

      <section className="auction-section" id="subasta" aria-labelledby="auction-title">
        <div className="auction-section-head">
          <div>
            <p className="eyebrow">Pancarta principal · 12 lugares</p>
            <h2 id="auction-title">Elegí exactamente dónde querés estar.</h2>
          </div>
          <p className="auction-head-copy">
            Todos los lugares tienen la misma superficie visual para comparar fácil. Hacé click en uno y ofertá sin perder el contexto.
          </p>
        </div>

        <div className="spot-grid">
          {state.spots.map((spot) => (
            <SpotCard key={spot.id} spot={spot} now={now} onSelect={openSpot} />
          ))}
        </div>
        <div className="auction-legend">
          <span>La subasta de cada lugar comienza con su primer pago aprobado.</span>
          <span>Oferta superada = devolución automática al medio de pago.</span>
        </div>
      </section>

      <section className="process" id="como-funciona" aria-labelledby="process-title">
        <p className="eyebrow">Proceso transparente</p>
        <h2 id="process-title">Tres pasos. Un lugar que queda bloqueado para vos.</h2>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <article className="step" key={step.title}>
              <span className="step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span className="brand">Startup Day <sup>2026</sup></span>
          <p>Pagos procesados por Mercado Pago · importes expresados en pesos argentinos.</p>
          <button
            className="button button--dark"
            type="button"
            onClick={() => selectedSpot && openSpot(selectedSpot)}
          >
            Hacer una oferta
          </button>
        </div>
      </footer>

      {selectedSpot && selectedSpot.status !== "LOCKED" && (
        <button
          className="floating-bid-tab"
          type="button"
          onClick={() => openSpot(selectedSpot)}
          data-testid="floating-bid-tab"
          aria-label={`Ofertar por ${selectedSpot.placement}`}
        >
          <span>Subasta en vivo</span>
          <strong>{selectedSpot.placement}</strong>
          <b aria-hidden="true">↗</b>
        </button>
      )}

      {dialogOpen && selectedSpot && (
        <BidDialog
          spot={selectedSpot}
          onClose={() => setDialogOpen(false)}
          onStateRefresh={refresh}
        />
      )}
    </main>
  );
}

function SpotCard({
  spot,
  now,
  onSelect,
}: {
  spot: PublicSpot;
  now: number;
  onSelect: (spot: PublicSpot) => void;
}) {
  const locked = spot.status === "LOCKED";
  const stateLabel = locked
    ? "Cerrada"
    : spot.status === "ACTIVE"
      ? formatCountdown(spot.endsAt, now)
      : "Disponible";

  return (
    <button
      className={`spot-card spot-card--${spot.tone}${locked ? " spot-card--locked" : ""}`}
      type="button"
      onClick={() => onSelect(spot)}
      disabled={locked}
      data-testid={`spot-card-${spot.id}`}
      aria-label={locked ? `${spot.placement}, subasta cerrada` : `Ofertar por ${spot.placement}`}
    >
      <span className="spot-card-top">
        <span>{spot.tier} · {spot.sizeLabel}</span>
        <span className="spot-status">{stateLabel}</span>
      </span>
      <span className="spot-card-main">
        <h3>{spot.placement}</h3>
        <p>{spot.description}</p>
      </span>
      <span className="spot-card-bottom">
        <span className="spot-bid">
          <span>{spot.currentBidCents ? "Oferta líder" : "Oferta inicial"}</span>
          <strong>{formatArs(spot.currentBidCents ?? spot.startingAmountCents)}</strong>
          <span className="spot-sponsor">{spot.sponsor ?? "Sin ofertas todavía"}</span>
        </span>
        <span className="spot-arrow" aria-hidden="true">↗</span>
      </span>
    </button>
  );
}

function BidDialog({
  spot,
  onClose,
  onStateRefresh,
}: {
  spot: PublicSpot;
  onClose: () => void;
  onStateRefresh: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotId: spot.id,
          company: data.get("company"),
          email: data.get("email"),
          amountArs: Number(data.get("amount")),
        }),
      });
      const payload = (await response.json()) as {
        checkoutUrl?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error?.message ?? "No pudimos iniciar el checkout.");
      }
      await onStateRefresh();
      window.location.assign(payload.checkoutUrl);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No pudimos iniciar el checkout.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        className="bid-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bid-title"
        data-testid="bid-dialog"
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="dialog-summary">
          <p className="eyebrow">Lugar seleccionado · {spot.tier}</p>
          <h2 id="bid-title">{spot.placement}</h2>
          <p>
            {spot.sizeLabel}. Mínimo actual: <strong>{formatArs(spot.minimumBidCents)}</strong>.
          </p>
        </div>
        <form className="bid-form" onSubmit={submit}>
          <label className="field">
            <span>Marca o empresa</span>
            <input name="company" placeholder="Ej. Prisma Labs" autoComplete="organization" required minLength={2} maxLength={80} />
          </label>
          <label className="field">
            <span>Tu oferta</span>
            <span className="currency-field">
              <span>ARS</span>
              <input
                name="amount"
                type="number"
                min={spot.minimumBidCents / 100}
                step={spot.minimumBidCents >= 39_000_000 ? 10_000 : 5_000}
                defaultValue={spot.minimumBidCents / 100}
                inputMode="numeric"
                required
              />
            </span>
            <small>La API vuelve a validar el mínimo antes de crear el checkout.</small>
          </label>
          <label className="field">
            <span>Email de contacto</span>
            <input name="email" type="email" placeholder="vos@empresa.com" autoComplete="email" required maxLength={254} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--red dialog-submit" type="submit" disabled={submitting}>
            {submitting ? "Abriendo checkout…" : "Ir al checkout seguro"} <span aria-hidden="true">↗</span>
          </button>
          <p className="form-note">
            La oferta lidera cuando Mercado Pago la aprueba. Si otra marca te supera, iniciamos la devolución automática del pago.
          </p>
        </form>
      </section>
    </div>
  );
}

function formatCountdown(endsAt: string | null, now: number) {
  if (!endsAt) return "72h 00m";
  const remaining = Math.max(0, new Date(endsAt).getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
