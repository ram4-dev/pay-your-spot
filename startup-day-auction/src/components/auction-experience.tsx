"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { formatArs } from "@/lib/auction/format";
import type { AuctionState, BidStatus, PublicSpot, TrackedBid } from "@/lib/auction/types";

const steps = [
  {
    title: "Elegí el lugar",
    copy: "Cada módulo muestra su estado, la oferta líder y el mínimo exacto para entrar.",
  },
  {
    title: "Ofertá sin pagar",
    copy: "Tu oferta entra de inmediato. No se cobra nada mientras la subasta está abierta.",
  },
  {
    title: "Queda reservado",
    copy: "Al cierre, el lugar queda reservado al email ganador para que el equipo continúe la gestión manualmente.",
  },
];

export function AuctionExperience({ initialState }: { initialState: AuctionState }) {
  const [state, setState] = useState(initialState);
  const [selectedId, setSelectedId] = useState(
    initialState.spots.find((spot) => spot.status === "AVAILABLE" || spot.status === "ACTIVE")?.id ?? initialState.spots[0]?.id,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [trackedBids, setTrackedBids] = useState<TrackedBid[]>([]);

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

  const refreshTrackedBids = useCallback(async () => {
    const ids = JSON.parse(window.localStorage.getItem("startup-day-bids") ?? "[]") as string[];
    const responses = await Promise.all(ids.slice(-20).reverse().map(async (id) => {
      const response = await fetch(`/api/bids/${encodeURIComponent(id)}`, { cache: "no-store" });
      return response.ok ? await response.json() as TrackedBid : null;
    }));
    setTrackedBids(responses.filter((bid): bid is TrackedBid => bid !== null));
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshTrackedBids(), 0);
    const timer = window.setInterval(() => void refreshTrackedBids(), 4_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [refreshTrackedBids]);

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
    if (spot.status === "RESERVED") return;
    setSelectedId(spot.id);
    setDialogOpen(true);
  }

  function rememberBid(bidId: string) {
    const ids = JSON.parse(window.localStorage.getItem("startup-day-bids") ?? "[]") as string[];
    window.localStorage.setItem("startup-day-bids", JSON.stringify([...new Set([...ids, bidId])]));
    void refreshTrackedBids();
  }

  function viewOffers(spot: PublicSpot) {
    setSelectedId(spot.id);
    window.requestAnimationFrame(() => document.getElementById("ranking")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
            <a href="#ranking">Ranking</a>
            <a href="#mis-ofertas">Mis ofertas</a>
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
        <h1>
          Tu marca, en el <em>centro.</em>
        </h1>
        <p className="hero-copy">
          Elegí un lugar real en la pancarta, ofertá sin pagar y seguí la subasta durante 72 horas.
        </p>
        <div className="metric-row" aria-label="Estado actual de la subasta">
          <div className="metric">
            <strong data-testid="active-auctions">{state.metrics.activeAuctions}</strong>
            <span>Subastas activas ahora</span>
          </div>
          <div className="metric">
            <strong data-testid="reserved-value">{formatArs(state.metrics.reservedValueCents)}</strong>
            <span>Valor de reservas cerradas</span>
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
            El mapa respeta la posición y proporción de cada espacio. Hacé click exactamente donde querés ver tu marca.
          </p>
        </div>

        <div className="banner-map" aria-label="Mapa real de lugares en la pancarta">
          <div className="banner-stage-copy" aria-hidden="true"><strong>STARTUP<br />DAY</strong><span>2026 · Buenos Aires</span></div>
          {state.spots.map((spot) => (
            <SpotCard key={spot.id} spot={spot} now={now} onSelect={openSpot} onViewOffers={viewOffers} />
          ))}
        </div>
        <div className="auction-legend">
          <span>La primera oferta inicia el reloj de 72 horas. No se cobra al ofertar.</span>
          <span>Al cierre, la reserva queda vinculada al email ganador para gestión manual.</span>
        </div>
        {selectedSpot && <AuctionRanking spot={selectedSpot} spots={state.spots} now={now} onSelect={setSelectedId} />}
      </section>

      <MyBids bids={trackedBids} now={now} />

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
          <p>Subastas y reservas administradas por email · importes expresados en pesos argentinos.</p>
          <button
            className="button button--dark"
            type="button"
            onClick={() => selectedSpot && openSpot(selectedSpot)}
          >
            Hacer una oferta
          </button>
        </div>
      </footer>

      {selectedSpot && (selectedSpot.status === "AVAILABLE" || selectedSpot.status === "ACTIVE") && (
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

      {dialogOpen && selectedSpot && (selectedSpot.status === "AVAILABLE" || selectedSpot.status === "ACTIVE") && (
        <BidDialog
          spot={selectedSpot}
          onClose={() => setDialogOpen(false)}
          onStateRefresh={refresh}
          onBidRegistered={rememberBid}
        />
      )}
    </main>
  );
}

function SpotCard({
  spot,
  now,
  onSelect,
  onViewOffers,
}: {
  spot: PublicSpot;
  now: number;
  onSelect: (spot: PublicSpot) => void;
  onViewOffers: (spot: PublicSpot) => void;
}) {
  const unavailable = spot.status === "RESERVED";
  const stateLabel = spot.status === "RESERVED"
    ? "Reservada"
    : spot.status === "ACTIVE"
      ? formatCountdown(spot.endsAt, now)
      : "Disponible";

  return (
    <article
      className={`banner-slot banner-slot--${spot.id} spot-card spot-card--${spot.tone}${unavailable ? " spot-card--locked" : ""}`}
      data-testid={`spot-card-${spot.id}`}
      aria-label={`${spot.placement}, ${stateLabel}`}
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
        <span className="spot-actions">
          <button className="spot-action spot-action--secondary" type="button" onClick={() => onViewOffers(spot)} data-testid={`view-offers-${spot.id}`}>
            Ver ofertas{spot.ranking.length ? ` · ${spot.ranking.length}` : ""}
          </button>
          <button className="spot-action spot-action--primary" type="button" onClick={() => onSelect(spot)} disabled={unavailable} data-testid={`offer-button-${spot.id}`}>
            {unavailable ? stateLabel : "Ofertar"} <span aria-hidden="true">↗</span>
          </button>
        </span>
      </span>
    </article>
  );
}

function BidDialog({
  spot,
  onClose,
  onStateRefresh,
  onBidRegistered,
}: {
  spot: PublicSpot;
  onClose: () => void;
  onStateRefresh: () => Promise<void>;
  onBidRegistered: (bidId:string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [confirmed, setConfirmed] = useState(false);

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
        bidId?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.bidId) {
        throw new Error(payload.error?.message ?? "No pudimos registrar la oferta.");
      }
      await onStateRefresh();
      onBidRegistered(payload.bidId);
      setConfirmed(true);
      setSubmitting(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No pudimos registrar la oferta.",
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
        {confirmed ? <div className="bid-confirmed" data-testid="bid-confirmed">
          <span aria-hidden="true">✓</span>
          <h3>Oferta registrada</h3>
          <p>La oferta y el email quedaron guardados. Si terminás primero, el lugar quedará reservado a ese correo para que el equipo te contacte manualmente.</p>
          <button className="button button--dark" type="button" onClick={onClose}>Seguir la subasta</button>
        </div> : <form className="bid-form" onSubmit={submit}>
          <BrandPreview spot={spot} company={company} />
          <label className="field">
            <span>Marca o empresa</span>
            <input name="company" value={company} onChange={(event)=>setCompany(event.target.value)} placeholder="Ej. Prisma Labs" autoComplete="organization" required minLength={2} maxLength={80} />
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
            <small>La oferta se valida y queda activa sin iniciar ningún cobro.</small>
          </label>
          <label className="field">
            <span>Email de contacto</span>
            <input name="email" type="email" placeholder="vos@empresa.com" autoComplete="email" required maxLength={254} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--red dialog-submit" type="submit" disabled={submitting}>
            {submitting ? "Registrando oferta…" : "Confirmar oferta sin pagar"} <span aria-hidden="true">↗</span>
          </button>
          <p className="form-note">
            Este email identifica tu oferta y la futura reserva. No se realiza ningún cobro ni envío automático.
          </p>
        </form>}
      </section>
    </div>
  );
}

function AuctionRanking({spot,spots,now,onSelect}:{spot:PublicSpot;spots:PublicSpot[];now:number;onSelect:(id:string)=>void}) {
  return <section className="live-ranking" id="ranking" aria-labelledby="ranking-title">
    <div className="ranking-head">
      <div><p className="eyebrow">Estado persistido · actualización en vivo</p><h3 id="ranking-title">Ranking de la subasta</h3></div>
      <label className="ranking-select"><span>Ver lugar</span><select value={spot.id} onChange={event=>onSelect(event.target.value)}>{spots.map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.placement}</option>)}</select></label>
    </div>
    <div className="ranking-summary">
      <span className={`auction-state auction-state--${spot.status.toLowerCase()}`}>{spotStatusLabel(spot.status)}</span>
      <strong>{spot.ranking.length} {spot.ranking.length===1?"oferta":"ofertas"}</strong>
      <span>{spot.status==="ACTIVE"?`Cierra en ${formatCountdown(spot.endsAt,now)}`:spot.status==="RESERVED"?"Reserva vinculada al email ganador":"Todavía no comenzó"}</span>
    </div>
    {spot.ranking.length ? <ol className="ranking-list" data-testid="ranking-list">
      {spot.ranking.map(bid=><li key={`${bid.createdAt}-${bid.rank}`} className={bid.rank===1?"ranking-row ranking-row--leader":"ranking-row"}>
        <span className="rank-number">#{bid.rank}</span><span className="rank-brand"><strong>{bid.company}</strong><small>{bid.status==="RESERVED"||bid.status==="CONTACTED"?"Ganadora":bid.rank===1?"Liderando":"Oferta superada"}</small></span><strong className="rank-amount">{formatArs(bid.amountCents)}</strong><span className="rank-status">{bidStatusLabel(bid.status)}</span>
      </li>)}
    </ol> : <div className="ranking-empty"><strong>Sin ofertas todavía</strong><span>La primera oferta abre esta subasta durante 72 horas.</span></div>}
  </section>;
}

function MyBids({bids,now}:{bids:TrackedBid[];now:number}) {
  return <section className="my-bids" id="mis-ofertas" aria-labelledby="my-bids-title">
    <div className="my-bids-head"><div><p className="eyebrow">Seguimiento privado en este dispositivo</p><h2 id="my-bids-title">Mis ofertas</h2></div><p>El email nunca aparece en el ranking público. Acá podés verificar qué oferta o reserva está vinculada a tu correo.</p></div>
    {bids.length ? <div className="my-bids-grid" data-testid="my-bids-list">{bids.map(bid=><article className="my-bid" key={bid.id}>
      <div className="my-bid-top"><span className="auction-state">{bidStatusLabel(bid.status)}</span><span>{bid.rank?`#${bid.rank} en el ranking`:"Ronda finalizada"}</span></div>
      <h3>{bid.placement}</h3><strong className="my-bid-amount">{formatArs(bid.amountCents)}</strong>
      <dl><div><dt>Marca</dt><dd>{bid.company}</dd></div><div><dt>Email vinculado</dt><dd>{bid.maskedEmail}</dd></div><div><dt>Estado</dt><dd>{trackedBidExplanation(bid,now)}</dd></div></dl>
    </article>)}</div> : <div className="my-bids-empty"><strong>Todavía no ofertaste desde este navegador.</strong><span>Cuando confirmes una oferta va a aparecer acá, vinculada al email que ingresaste.</span></div>}
  </section>;
}

function bidStatusLabel(status:BidStatus) { return ({LEADING:"Liderando",OUTBID:"Superada",RESERVED:"Reservada",CONTACTED:"Contactada",FAILED:"Fallida"} satisfies Record<BidStatus,string>)[status]; }
function spotStatusLabel(status:PublicSpot["status"]) { return {AVAILABLE:"Disponible",ACTIVE:"En vivo",RESERVED:"Reservada"}[status]; }
function trackedBidExplanation(bid:TrackedBid,now:number) {
  if(bid.status==="LEADING") return `Vas primero. La subasta cierra en ${formatCountdown(bid.endsAt,now)}.`;
  if(bid.status==="OUTBID") return "Otra marca hizo una oferta mayor. Podés volver a ofertar.";
  if(bid.status==="RESERVED") return "Ganaste. El lugar está reservado a tu email para gestión manual.";
  if(bid.status==="CONTACTED") return "Reserva confirmada y marcada como contactada por el equipo.";
  return bidStatusLabel(bid.status);
}

function BrandPreview({spot,company}:{spot:PublicSpot;company:string}) {
  const mark=(company.trim()||"TU MARCA").slice(0,18);
  return <div className="brand-preview" aria-label={`Vista previa de ${mark} en ${spot.placement}`}>
    <div className="brand-preview-head"><span>Vista previa en vivo</span><strong>{spot.placement}</strong></div>
    <div className="preview-map"><span className="preview-event">STARTUP DAY</span><span className={`preview-logo preview-logo--${spot.id}`}>{mark}</span></div>
  </div>;
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
