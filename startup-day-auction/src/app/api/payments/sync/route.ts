import { processPaymentById } from "@/lib/payments/orchestrator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { paymentId?: unknown } | null;
  if (!body || typeof body.paymentId !== "string" || !/^\d+$/.test(body.paymentId)) {
    return Response.json({ error: "paymentId inválido" }, { status: 400 });
  }

  try {
    const result = await processPaymentById(body.paymentId);
    return Response.json(result);
  } catch {
    return Response.json({ error: "No pudimos sincronizar el pago." }, { status: 502 });
  }
}
