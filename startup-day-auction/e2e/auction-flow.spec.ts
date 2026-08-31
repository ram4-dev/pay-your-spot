import { expect,test } from "@playwright/test";

test("persists the auction and reserves the winner by email without expiration",async({page})=>{
  await page.goto("/");const cards=page.locator("[data-testid^=spot-card-]");await expect(cards).toHaveCount(12);
  await placeBid(page,"First E2E","first@example.com","150000");await expect(page.getByTestId("active-auctions")).toHaveText("1");
  await page.getByTestId("view-offers-new-spot").click();await expect(page.locator("#ranking")).toBeInViewport();await expect(page.getByTestId("ranking-list")).toContainText("First E2E");
  await placeBid(page,"Winner E2E","winner@example.com","155000");await expect(page.getByTestId("ranking-list").locator("li").first()).toContainText("Winner E2E");
  await page.reload();await expect(page.getByTestId("my-bids-list")).toContainText("w•••••@example.com");
  await expect.poll(async()=>await page.getByTestId("offer-button-new-spot").isDisabled(),{timeout:15_000}).toBe(true);
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("Reservada");await expect(page.getByTestId("my-bids-list")).not.toContainText("Pago vencido");

  await page.goto("/admin/reservas");await page.getByLabel("Token de administración").fill("e2e-admin-token");await page.getByRole("button",{name:"Abrir panel"}).click();
  await expect(page.getByText("winner@example.com")).toBeVisible();await expect(page.getByText("first@example.com")).toBeVisible();await expect(page.getByText("Reservada",{exact:true})).toBeVisible();
});

test("keeps direct offer and ranking actions usable on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");await page.getByTestId("view-offers-top-band").click();await expect(page.locator("#ranking")).toBeInViewport();
  await page.getByTestId("offer-button-top-band").click();const dialog=page.getByTestId("bid-dialog");await dialog.getByLabel("Marca o empresa").fill("Prisma Labs");await expect(dialog.getByLabel(/Vista previa de Prisma Labs/)).toContainText("Prisma Labs");
});

async function placeBid(page:import("@playwright/test").Page,company:string,email:string,amount:string){await page.getByTestId("offer-button-new-spot").click();const dialog=page.getByTestId("bid-dialog");await dialog.getByLabel("Marca o empresa").fill(company);await dialog.getByLabel("Tu oferta").fill(amount);await dialog.getByLabel("Email de contacto").fill(email);await dialog.getByRole("button",{name:/Confirmar oferta sin pagar/}).click();await expect(page.getByTestId("bid-confirmed")).toBeVisible();await dialog.getByRole("button",{name:"Seguir la subasta"}).click();}
