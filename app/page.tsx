'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowUpRight, Check, X } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

type AuctionSpot = {
  id: string;
  placement: string;
  size: string;
  sponsor: string;
  bid: string;
  minimum: number;
  tone: string;
  featured?: boolean;
};

const auctionSpots: AuctionSpot[] = [
  { id: 'top-band', placement: 'Franja superior', size: 'Premium · 2,4 m × 0,6 m', sponsor: 'Aurora Ventures', bid: 'ARS 680.000', minimum: 681000, tone: 'charcoal', featured: true },
  { id: 'side-a', placement: 'Bloque lateral A', size: 'Estándar · 1,2 m × 1,2 m', sponsor: 'Distrito Tech', bid: 'ARS 540.000', minimum: 541000, tone: 'indigo', featured: true },
  { id: 'access', placement: 'Marco de acceso', size: 'Estándar · 1,2 m × 0,6 m', sponsor: 'Espacio reservado', bid: 'ARS 480.000', minimum: 481000, tone: 'reserved', featured: true },
  { id: 'right-band', placement: 'Franja derecha', size: 'Estándar · 1,2 m × 0,6 m', sponsor: 'Punto Norte', bid: 'ARS 390.000', minimum: 391000, tone: 'rose' },
  { id: 'center-a', placement: 'Centro A', size: 'Compacto · 0,8 m × 0,8 m', sponsor: 'Beta Studio', bid: 'ARS 280.000', minimum: 281000, tone: 'blue' },
  { id: 'center-b', placement: 'Centro B', size: 'Compacto · 0,8 m × 0,8 m', sponsor: 'Lumen Cloud', bid: 'ARS 260.000', minimum: 261000, tone: 'violet' },
  { id: 'lower-a', placement: 'Franja inferior A', size: 'Compacto · 0,8 m × 0,6 m', sponsor: 'Nodo Sur', bid: 'ARS 240.000', minimum: 241000, tone: 'green' },
  { id: 'lower-b', placement: 'Franja inferior B', size: 'Compacto · 0,8 m × 0,6 m', sponsor: 'Kinetik', bid: 'ARS 220.000', minimum: 221000, tone: 'yellow' },
  { id: 'side-b', placement: 'Bloque lateral B', size: 'Compacto · 0,8 m × 0,8 m', sponsor: 'Espacio reservado', bid: 'ARS 200.000', minimum: 201000, tone: 'reserved' },
  { id: 'corner-a', placement: 'Esquina superior', size: 'Compacto · 0,6 m × 0,6 m', sponsor: 'Marea Labs', bid: 'ARS 180.000', minimum: 181000, tone: 'slate' },
  { id: 'corner-b', placement: 'Esquina inferior', size: 'Compacto · 0,6 m × 0,6 m', sponsor: 'Catalyst', bid: 'ARS 160.000', minimum: 161000, tone: 'orange' },
  { id: 'new-spot', placement: 'Nuevo lugar', size: 'Compacto · 0,6 m × 0,6 m', sponsor: 'Disponible', bid: 'ARS 150.000', minimum: 151000, tone: 'open' },
];

const steps = [
  { number: '1', title: 'Elegí tu ubicación', copy: 'Mirá el cartel, compará formatos y encontrá el espacio con más visibilidad para tu marca.' },
  { number: '2', title: 'Superá la oferta', copy: 'Hacé tu propuesta antes de que cierre la subasta. La mejor oferta se queda con el lugar.' },
  { number: '3', title: 'Aparecé en Startup Day', copy: 'Subimos tu identidad al cartel final y la llevamos al centro de la conversación.' },
];

export default function Home() {
  const [selectedSpot, setSelectedSpot] = useState(auctionSpots[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function openBid(spot: AuctionSpot) {
    setSelectedSpot(spot);
    setSubmitted(false);
    setDialogOpen(true);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

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
          <Button className="button button--primary button--small" onClick={() => openBid(auctionSpots[0])}>
            Quiero un lugar
            <ArrowRight aria-hidden="true" size={15} strokeWidth={2.2} />
          </Button>
        </nav>
      </header>

      <section className="hero section-shell" id="inicio">
        <div className="live-pill"><span className="live-dot" />42 marcas siguiendo la subasta ahora</div>
        <h1>Tu marca, en el centro<br />de Startup Day.</h1>
        <p className="hero-copy">Las marcas que ganen estarán presentes en la pancarta principal del stand durante todo el evento.</p>
        <div className="progress-wrap" aria-label="Progreso de la recaudación">
          <div className="progress-copy"><strong>ARS 3.480.000 recaudados</strong><span>meta superada 174%</span></div>
          <div className="progress-track"><span className="progress-fill" /></div>
        </div>
        <p className="deadline">La subasta cierra en 08d 14h 22m · todavía podés superar una oferta.</p>
      </section>

      <section className="wall-section wide-shell" aria-labelledby="wall-title">
        <div className="eyebrow-row">
          <p className="eyebrow" id="wall-title">Pancarta principal · elegí un lugar</p>
          <span>12 ubicaciones</span>
        </div>
        <div className="sponsor-wall">
          <div className="event-strip">
            <div className="event-mark">SD</div>
            <div><strong>Startup Day 2026</strong><span>Pancarta principal · puesto central</span></div>
            <p>Hacé click en cualquier ubicación para ofertar</p>
          </div>
          <div className="sponsor-grid">
            {auctionSpots.map((spot) => <SponsorCard key={spot.id} spot={spot} onSelect={openBid} />)}
          </div>
        </div>
      </section>

      <section className="auction wide-shell" id="subasta" aria-labelledby="auction-title">
        <p className="status-label"><span /> Subasta en vivo · 6 de 12 lugares tomados</p>
        <div className="section-heading auction-heading">
          <h2 id="auction-title">Las mejores ubicaciones, en juego.</h2>
          <p>Cada lugar muestra la oferta actual. Elegí tu zona y ofertá sin salir de esta pantalla.</p>
        </div>
        <div className="auction-grid">
          {auctionSpots.filter((spot) => spot.featured).map((spot, index) => (
            <button className="auction-card" type="button" key={spot.id} onClick={() => openBid(spot)}>
              <div className="auction-card-top"><span>0{index + 1}</span><span>{spot.size.split(' · ')[0]}</span></div>
              <div className="auction-card-main"><h3>{spot.placement}</h3><p>{spot.size}</p></div>
              <div className="auction-card-bid"><div><span>Oferta actual</span><strong>{spot.bid}</strong></div><span className="auction-card-arrow"><ArrowUpRight aria-hidden="true" size={20} /></span></div>
              <p className="auction-card-sponsor">{spot.sponsor}</p>
            </button>
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
        <div className="section-heading section-heading--compact"><p className="eyebrow">El proceso</p><h2 id="steps-title">Cómo funciona</h2></div>
        <div className="steps-grid">
          {steps.map((step) => <article className="step-card" key={step.number}><span className="step-number">{step.number}</span><h3>{step.title}</h3><p>{step.copy}</p></article>)}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span className="brand brand--light">Startup Day <sup>2026</sup></span>
          <p>La vidriera principal del ecosistema startup.</p>
          <Button className="button button--light button--small" onClick={() => openBid(selectedSpot)}>Hacer una oferta</Button>
        </div>
      </footer>

      <Button className="floating-bid-tab" onClick={() => openBid(selectedSpot)} aria-label={`Ofertar por ${selectedSpot.placement}`}>
        <span className="floating-bid-live"><span />Subasta en vivo</span>
        <strong>Ofertar por un lugar</strong>
        <ArrowUpRight aria-hidden="true" size={20} />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="auction-dialog" showCloseButton={false}>
          <DialogClose className="auction-dialog-close" aria-label="Cerrar panel de oferta"><X aria-hidden="true" size={18} /></DialogClose>
          {submitted ? (
            <output className="dialog-success" aria-live="polite">
              <span className="success-icon"><Check aria-hidden="true" size={27} /></span>
              <p className="eyebrow">Oferta recibida</p>
              <h2>Tu propuesta por {selectedSpot.placement} está en revisión.</h2>
              <p>Te vamos a contactar por email para confirmar la puja.</p>
              <Button className="button button--primary dialog-submit" onClick={() => setDialogOpen(false)}>Listo</Button>
            </output>
          ) : (
            <>
              <DialogHeader className="auction-dialog-header">
                <div className="dialog-place-row"><span className={`dialog-place-mark sponsor-card--${selectedSpot.tone}`}>SD</span><div><p>Lugar seleccionado</p><strong>{selectedSpot.placement}</strong></div></div>
                <DialogTitle>Hacé tu oferta acá.</DialogTitle>
                <DialogDescription>{selectedSpot.size}. La oferta actual es <strong>{selectedSpot.bid}</strong>.</DialogDescription>
              </DialogHeader>
              <form className="dialog-form" onSubmit={handleSubmit}>
                <label className="dialog-field" htmlFor="bid-company"><span>Marca o empresa</span><Input id="bid-company" name="company" placeholder="Ej. Prisma Labs" autoComplete="organization" required /></label>
                <label className="dialog-field" htmlFor="bid-amount"><span>Tu oferta (ARS)</span><div className="dialog-currency"><span>ARS</span><Input id="bid-amount" name="amount" type="number" min={selectedSpot.minimum} step="1000" placeholder={selectedSpot.minimum.toLocaleString('es-AR')} inputMode="numeric" required /></div><small>Mínimo para superar la puja: ARS {selectedSpot.minimum.toLocaleString('es-AR')}.</small></label>
                <label className="dialog-field" htmlFor="bid-email"><span>Email de contacto</span><Input id="bid-email" name="email" type="email" placeholder="vos@empresa.com" autoComplete="email" required /></label>
                <Button className="button button--primary dialog-submit" type="submit">Enviar oferta<ArrowRight aria-hidden="true" size={18} /></Button>
                <p className="form-note">Revisaremos tu propuesta y te contactaremos para confirmar la puja.</p>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SponsorCard({ spot, onSelect }: { spot: AuctionSpot; onSelect: (spot: AuctionSpot) => void }) {
  const initials = spot.sponsor === 'Disponible' ? '+' : spot.sponsor.split(' ').map((word) => word[0]).join('').slice(0, 2);
  return (
    <button className={`sponsor-card sponsor-card--${spot.tone}`} type="button" onClick={() => onSelect(spot)} aria-label={`Ofertar por ${spot.placement}, oferta actual ${spot.bid}`}>
      <span className="sponsor-card-top"><span>{spot.placement}</span><ArrowUpRight aria-hidden="true" size={15} /></span>
      <span className="sponsor-mark" aria-hidden="true">{initials}</span>
      <strong>{spot.sponsor}</strong>
      <span>{spot.bid}</span>
    </button>
  );
}
