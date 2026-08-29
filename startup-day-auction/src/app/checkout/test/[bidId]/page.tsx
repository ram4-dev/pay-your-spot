import { TestCheckoutButton } from "@/components/test-checkout-button";
import { getAuctionDatabase } from "@/lib/auction/database";
import { formatArs } from "@/lib/auction/format";
import { getAuctionState, getInternalBid } from "@/lib/auction/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TestCheckoutPage({
  params,
}: {
  params: Promise<{ bidId: string }>;
}) {
  if (
    process.env.PAYMENT_PROVIDER !== "test" ||
    process.env.ENABLE_TEST_PAYMENT_PROVIDER !== "1"
  ) {
    return <NotAvailable title="404" copy="Esta ruta no está habilitada." />;
  }

  const { bidId } = await params;
  const database = getAuctionDatabase();
  const bid = getInternalBid(database, bidId);
  const spot = bid
    ? getAuctionState(database).spots.find((candidate) => candidate.id === bid.spotId)
    : null;
  if (!bid || !spot) {
    return <NotAvailable title="Oferta inexistente" copy="Este checkout no corresponde a una oferta válida." />;
  }

  return (
    <main className="test-checkout-page">
      <section className="payment-card">
        <div className="payment-mark">MP</div>
        <p className="eyebrow">Checkout de prueba E2E</p>
        <h1>Confirmar oferta</h1>
        <div className="test-checkout-details">
          <strong>{bid.company}</strong>
          <span>{spot.placement} · {formatArs(bid.amountCents)}</span>
        </div>
        <p>Esta pantalla sólo existe cuando el proveedor de pruebas está habilitado explícitamente.</p>
        <TestCheckoutButton bidId={bid.id} />
      </section>
    </main>
  );
}

function NotAvailable({ title, copy }: { title: string; copy: string }) {
  return (
    <main className="payment-page">
      <section className="payment-card"><h1>{title}</h1><p>{copy}</p></section>
    </main>
  );
}
