import { expect, test } from "@playwright/test";

test("runs the paid auction E2E, refunds the outbid leader, and locks after expiry", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Tu marca, en el centro/ })).toBeVisible();
  const spotCards = page.locator("[data-testid^=spot-card-]");
  await expect(spotCards).toHaveCount(12);
  await expect(page.getByTestId("active-auctions")).toHaveText("0");
  await expect(page.getByTestId("total-raised")).toContainText("0");

  const boxes = await spotCards.evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    }),
  );
  expect(new Set(boxes.map((box) => box.height)).size).toBe(1);
  expect(new Set(boxes.map((box) => box.width)).size).toBe(1);

  await placeBid(page, "First E2E", "first-e2e@example.com", "150000");
  await expect(page.getByRole("heading", { name: "Confirmar oferta" })).toBeVisible();
  await page.getByRole("button", { name: "Aprobar pago de prueba" }).click();
  await expect(page.getByRole("heading", { name: "Oferta confirmada" })).toBeVisible();
  await page.getByRole("link", { name: "Volver a la subasta" }).click();

  await expect(page.getByTestId("active-auctions")).toHaveText("1");
  await expect(page.getByTestId("total-raised")).toContainText("150.000");
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("First E2E");

  await placeBid(page, "Second E2E", "second-e2e@example.com", "155000");
  await page.getByRole("button", { name: "Aprobar pago de prueba" }).click();
  await expect(page.getByRole("heading", { name: "Oferta confirmada" })).toBeVisible();
  await page.getByRole("link", { name: "Volver a la subasta" }).click();

  await expect(page.getByTestId("active-auctions")).toHaveText("1");
  await expect(page.getByTestId("total-raised")).toContainText("155.000");
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("Second E2E");

  const auditResponse = await request.get("/api/test/audit?spotId=new-spot");
  expect(auditResponse.ok()).toBe(true);
  const audit = (await auditResponse.json()) as {
    bids: Array<{ company: string; status: string; refundId: string | null }>;
  };
  expect(audit.bids).toEqual([
    expect.objectContaining({ company: "First E2E", status: "REFUNDED" }),
    expect.objectContaining({ company: "Second E2E", status: "LEADING" }),
  ]);
  expect(audit.bids[0].refundId).toMatch(/^test-refund-/);

  await expect
    .poll(async () => {
      const response = await request.get("/api/auction");
      const state = (await response.json()) as {
        metrics: { activeAuctions: number; lockedSpots: number };
      };
      return {
        activeAuctions: state.metrics.activeAuctions,
        lockedSpots: state.metrics.lockedSpots,
      };
    }, { timeout: 15_000 })
    .toEqual({ activeAuctions: 0, lockedSpots: 1 });

  await page.reload();
  await expect(page.getByTestId("spot-card-new-spot")).toBeDisabled();
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("Cerrada");
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("Second E2E");
  await page.screenshot({ path: "test-results/auction-e2e-final.png", fullPage: true });
});

test("keeps the floating contextual bid panel usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("spot-card-top-band").click();
  await expect(page.getByTestId("bid-dialog")).toContainText("Franja superior");
  await page.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByTestId("floating-bid-tab")).toContainText("Franja superior");
  await page.getByTestId("floating-bid-tab").click();
  await expect(page.getByTestId("bid-dialog")).toBeVisible();
});

async function placeBid(
  page: import("@playwright/test").Page,
  company: string,
  email: string,
  amount: string,
) {
  await page.getByTestId("spot-card-new-spot").click();
  const dialog = page.getByTestId("bid-dialog");
  await expect(dialog).toContainText("Módulo emergente");
  await dialog.getByLabel("Marca o empresa").fill(company);
  await dialog.getByLabel("Tu oferta").fill(amount);
  await dialog.getByLabel("Email de contacto").fill(email);
  await dialog.getByRole("button", { name: /Ir al checkout seguro/ }).click();
}
