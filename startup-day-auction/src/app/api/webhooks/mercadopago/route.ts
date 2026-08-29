import { processPaymentById } from "@/lib/payments/orchestrator";
import { validateMercadoPagoSignature } from "@/lib/payments/webhook-signature";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as {
    type?: string;
    data?: { id?: string | number };
  } | null;
  const dataId = url.searchParams.get("data.id") ??
    (body?.data?.id === undefined ? null : String(body.data.id));
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";
  const valid = validateMercadoPagoSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  });

  if (!valid) return Response.json({ error: "Firma inválida" }, { status: 401 });
  if (body?.type !== "payment" || !dataId) return Response.json({ received: true });

  try {
    await processPaymentById(dataId);
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "No se pudo procesar la notificación" }, { status: 503 });
  }
}
