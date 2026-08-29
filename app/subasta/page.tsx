'use client';

import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { type SyntheticEvent, useState } from 'react';

export default function BidPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="bid-page">
      <header className="bid-header">
        <nav className="bid-nav" aria-label="Navegación de oferta">
          <Link className="back-link" href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Volver al cartel
          </Link>
          <Link className="brand" href="/" aria-label="Startup Day 2026, inicio">
            <span>Startup Day</span>
            <sup>2026</sup>
          </Link>
          <span className="nav-spacer" />
        </nav>
      </header>

      <section className="bid-shell">
        <div className="bid-intro">
          <p className="status-label"><span /> Subasta en vivo · cierra en 08d 14h</p>
          <h1>Hacé tu oferta.</h1>
          <p>Estás por competir por un lugar en la pancarta principal del evento.</p>

          <article className="selected-spot">
            <p className="eyebrow">Lugar seleccionado</p>
            <div className="selected-card">
              <div className="selected-mark">AV</div>
              <div>
                <h2>Franja superior</h2>
                <p>Oferta actual: <strong>ARS 680.000</strong></p>
              </div>
            </div>
            <p className="placement-note">La ubicación más visible: frente de la entrada y a la altura de la mirada.</p>
          </article>
        </div>

        <div className="form-card">
          {submitted ? (
            <output className="success-state" aria-live="polite">
              <span className="success-icon"><Check aria-hidden="true" size={28} /></span>
              <p className="eyebrow">Oferta recibida</p>
              <h2>Tu propuesta ya está en revisión.</h2>
              <p>Te vamos a contactar por email para confirmar la puja y los próximos pasos.</p>
              <button className="button button--primary bid-submit" type="button" onClick={() => setSubmitted(false)}>
                Enviar otra oferta
              </button>
              <Link className="back-after-submit" href="/">Volver al cartel</Link>
            </output>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-heading">
                <p className="eyebrow">Tu propuesta</p>
                <h2>Superá la oferta actual</h2>
              </div>

              <label className="field">
                <span>Marca o empresa</span>
                <input name="company" placeholder="Ej. Prisma Labs" autoComplete="organization" required />
              </label>

              <label className="field">
                <span>Tu oferta (ARS)</span>
                <div className="currency-field">
                  <span>ARS</span>
                  <input
                    name="amount"
                    type="number"
                    min="681000"
                    step="1000"
                    placeholder="700.000"
                    inputMode="numeric"
                    required
                  />
                </div>
                <small>La oferta mínima para superar la puja es ARS 681.000.</small>
              </label>

              <label className="field">
                <span>Email de contacto</span>
                <input name="email" type="email" placeholder="vos@empresa.com" autoComplete="email" required />
              </label>

              <button className="button button--primary bid-submit" type="submit">
                Enviar oferta
                <ArrowRight aria-hidden="true" size={18} />
              </button>
              <p className="form-note">Al enviar, revisaremos tu propuesta y te contactaremos para confirmar la puja.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
