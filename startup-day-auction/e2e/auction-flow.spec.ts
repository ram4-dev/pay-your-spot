import { expect,test } from "@playwright/test";

const TINY_PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64");

test("persists the auction and reserves the winner by email without expiration",async({page})=>{
  await page.goto("/");const cards=page.locator("[data-testid^=spot-card-]");await expect(cards).toHaveCount(12);
  await placeBid(page,"First E2E","first@example.com","5000");await expect(page.getByTestId("spot-card-new-spot")).toContainText("Oferta líder");
  await expect(page.getByTestId("spot-card-new-spot").getByAltText("Logo líder de First E2E")).toBeVisible();
  await page.getByTestId("view-offers-new-spot").click();await expect(page.locator("#ranking")).toBeInViewport();await expect(page.getByTestId("ranking-list").getByAltText("Logo de la oferta #1")).toBeVisible();
  await placeBid(page,"Winner E2E","winner@example.com","6000");await expect(page.getByTestId("ranking-list").locator("li").first().getByAltText("Logo de la oferta #1")).toBeVisible();
  await page.reload();await expect(page.getByTestId("my-bids-list")).toContainText("w•••••@example.com");
  await expect.poll(async()=>await page.getByTestId("offer-button-new-spot").isDisabled(),{timeout:15_000}).toBe(true);
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("Reservada");await expect(page.getByTestId("my-bids-list")).not.toContainText("Pago vencido");

  await page.goto("/admin/reservas");await page.getByLabel("Token de administración").fill("e2e-admin-token");await page.getByRole("button",{name:"Abrir panel"}).click();
  await expect(page.getByText("winner@example.com")).toBeVisible();await expect(page.getByText("first@example.com")).toBeVisible();await expect(page.getByText("Reservada",{exact:true})).toBeVisible();
});

test("keeps direct offer and ranking actions usable on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");await page.getByTestId("view-offers-top-band").click();await expect(page.locator("#ranking")).toBeInViewport();
  await page.goto("/");await page.getByTestId("spot-hit-area-top-band").click();const dialog=page.getByTestId("bid-dialog");await dialog.getByLabel("Logo de la marca").setInputFiles({name:"prisma-labs.jpg",mimeType:"image/jpeg",buffer:Buffer.from([0xff,0xd8,0xff,0xd9])});await expect(dialog.getByAltText("Logo seleccionado")).toBeVisible();
});

async function placeBid(page:import("@playwright/test").Page,company:string,email:string,amount:string){await page.getByTestId("offer-button-new-spot").click();const dialog=page.getByTestId("bid-dialog");await dialog.getByLabel("Logo de la marca").setInputFiles({name:`${company}.png`,mimeType:"image/png",buffer:TINY_PNG});await dialog.getByLabel("Tu oferta").fill(amount);await dialog.getByLabel("Email de contacto").fill(email);await dialog.getByRole("button",{name:/Confirmar oferta sin pagar/}).click();await expect(page.getByTestId("bid-confirmed")).toBeVisible();await dialog.getByRole("button",{name:"Seguir la subasta"}).click();}
