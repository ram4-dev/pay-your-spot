import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const sponsors = [
  { name: 'Beta Studio', bid: 'ARS 280.000', tone: 'blue' },
  { name: 'Marea Labs', bid: 'ARS 180.000', tone: 'slate' },
  { name: 'Catalyst', bid: 'ARS 160.000', tone: 'orange' },
  { name: 'Distrito Tech', bid: 'ARS 540.000', tone: 'indigo' },
  { name: 'Lumen Cloud', bid: 'ARS 260.000', tone: 'violet' },
  { name: 'Nuevo lugar', bid: 'ARS 150.000', tone: 'open' },
  { name: 'Espacio reservado', bid: 'ARS 480.000', tone: 'reserved' },
  { name: 'Nodo Sur', bid: 'ARS 240.000', tone: 'green' },
  { name: 'Punto Norte', bid: 'ARS 390.000', tone: 'rose' },
  { name: 'Kinetik', bid: 'ARS 220.000', tone: 'yellow' },
  { name: 'Espacio reservado', bid: 'ARS 200.000', tone: 'reserved' },
  { name: 'Aurora Ventures', bid: 'ARS 680.000', tone: 'charcoal' },
];

const auctionRows = [
  {
    name: 'Franja superior',
    size: 'Premium · 2,4 m × 0,6 m',
    sponsor: 'Aurora Ventures',
    bid: 'ARS 680.000',
  },
  {
    name: 'Bloque lateral',
    size: 'Estándar · 1,2 m × 1,2 m',
    sponsor: 'Distrito Tech',
    bid: 'ARS 540.000',
  },
  {
    name: 'Marco de acceso',
    size: 'Estándar · 1,2 m × 0,6 m',
    sponsor: 'Espacio reservado',
    bid: 'ARS 480.000',
  },
];

const steps = [
  {
    number: '1',
    title: 'Elegí tu ubicación',
    copy: 'Mirá el cartel, compará formatos y encontrá el espacio con más visibilidad para tu marca.',
  },
  {
    number: '2',
    title: 'Superá la oferta',
    copy: 'Hacé tu propuesta antes de que cierre la subasta. La mejor oferta se queda con el lugar.',
  },
  {
    number: '3',
    title: 'Aparecé en Startup Day',
    copy: 'Subimos tu identidad al cartel final y la llevamos al centro de la conversación.',
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Navegación principal">
          <a className="brand" href="#inicio" aria-label="Startup Day 2026, inicio">
            <span>Startup Day</span>
            <sup>2026</sup>
          </a>
          <div className="nav-links">
            <a href="#subasta">Subasta en vivo</a>
            <a href="#como-funciona">Cómo funciona</a>
          </div>
          <Link className="button button--primary button--small" href="/subasta">
            Quiero un lugar
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2.2} />
          </Link>
        </nav>
      </header>

      <section className="hero section-shell" id="inicio">
        <div className="live-pill">
          <span className="live-dot" />
          42 marcas siguiendo la subasta ahora
        </div>
        <h1>
          Tu marca, en el centro
          <br />
          de Startup Day.
        </h1>
        <p className="hero-copy">
          Las marcas que ganen estarán presentes en la pancarta principal del stand durante todo el evento.
        </p>

        <div className="progress-wrap" aria-label="Progreso de la recaudación">
          <div className="progress-copy">
            <strong>ARS 3.480.000 recaudados</strong>
            <span>meta superada 174%</span>
          </div>
          <div className="progress-track">
            <span className="progress-fill" />
          </div>
        </div>
        <p className="deadline">La subasta cierra en 08d 14h 22m · todavía podés superar una oferta.</p>
      </section>

      <section className="wall-section section-shell" aria-labelledby="wall-title">
        <div className="eyebrow-row">
          <p className="eyebrow" id="wall-title">Pancarta principal · zonas de marca</p>
          <span>12 ubicaciones</span>
        </div>
        <div className="sponsor-wall">
          {sponsors.slice(0, 5).map((sponsor) => (
            <SponsorCard key={sponsor.name + sponsor.bid} {...sponsor} />
          ))}
          <article className="event-card">
            <div className="event-mark">SD</div>
            <strong>Startup Day</strong>
            <span>Puesto central</span>
          </article>
          {sponsors.slice(5).map((sponsor) => (
            <SponsorCard key={sponsor.name + sponsor.bid} {...sponsor} />
          ))}
        </div>
      </section>

      <section className="auction section-shell" id="subasta" aria-labelledby="auction-title">
        <p className="status-label"><span /> Subasta en vivo · 6 de 12 lugares tomados</p>
        <div className="section-heading">
          <h2 id="auction-title">Las mejores ubicaciones, en juego.</h2>
          <p>Cada lugar muestra la oferta actual. Elegí tu zona y superá la puja antes del cierre.</p>
        </div>

        <div className="auction-list">
          {auctionRows.map((spot, index) => (
            <article className="auction-row" key={spot.name}>
              <span className="spot-number">0{index + 1}</span>
              <div className="spot-detail">
                <strong>{spot.name}</strong>
                <span>{spot.size}</span>
              </div>
              <strong className="spot-sponsor">{spot.sponsor}</strong>
              <div className="spot-bid">
                <strong>{spot.bid}</strong>
                <span>oferta actual</span>
              </div>
              <Link className="bid-link" href="/subasta">
                Superar
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="impact" aria-labelledby="impact-title">
        <div className="impact-inner">
          <p className="impact-eyebrow">Visibilidad que se ve</p>
          <h2 id="impact-title">Todas las miradas pasan por el stand.<br />Tu marca también.</h2>
          <p>Una sola pancarta concentra a la comunidad startup durante el día más esperado del ecosistema.</p>
        </div>
      </section>

      <section className="steps section-shell" id="como-funciona" aria-labelledby="steps-title">
        <div className="section-heading section-heading--compact">
          <p className="eyebrow">El proceso</p>
          <h2 id="steps-title">Cómo funciona</h2>
        </div>
        <div className="steps-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span className="brand brand--light">Startup Day <sup>2026</sup></span>
          <p>La vidriera principal del ecosistema startup.</p>
          <Link className="button button--light button--small" href="/subasta">Hacer una oferta</Link>
        </div>
      </footer>
    </main>
  );
}

function SponsorCard({ name, bid, tone }: { name: string; bid: string; tone: string }) {
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);

  return (
    <article className={`sponsor-card sponsor-card--${tone}`}>
      <span className="sponsor-mark" aria-hidden="true">{tone === 'open' ? '+' : initials}</span>
      <strong>{name}</strong>
      <span>{bid}</span>
    </article>
  );
}
