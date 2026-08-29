import { approveTestBid } from "@/lib/payments/orchestrator";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ bidId: string }> },
) {
  if (
    process.env.PAYMENT_PROVIDER !== "test" ||
    process.env.ENABLE_TEST_PAYMENT_PROVIDER !== "1"
  ) {
    return Response.json({ error: "Ruta inexistente" }, { status: 404 });
  }

  try {
    const { bidId } = await context.params;
    const result = await approveTestBid(bidId);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo confirmar la oferta." },
      { status: 409 },
    );
  }
}
