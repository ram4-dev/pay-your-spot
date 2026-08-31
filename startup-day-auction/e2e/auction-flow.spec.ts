import { expect,test } from "@playwright/test";

test("bids without charging, emails the winner checkout, and locks only after payment",async({page,request})=>{
  await page.goto("/");
  const cards=page.locator("[data-testid^=spot-card-]");await expect(cards).toHaveCount(12);
  const boxes=await cards.evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {width:Math.round(r.width),height:Math.round(r.height)}}));
  expect(new Set(boxes.map(b=>`${b.width}x${b.height}`)).size).toBeGreaterThan(4);
  const overlapCount=await cards.evaluateAll(nodes=>{
    const boxes=nodes.map(node=>node.getBoundingClientRect());let overlaps=0;
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const width=Math.min(boxes[i].right,boxes[j].right)-Math.max(boxes[i].left,boxes[j].left);
      const height=Math.min(boxes[i].bottom,boxes[j].bottom)-Math.max(boxes[i].top,boxes[j].top);
      if(width>0&&height>0) overlaps++;
    }
    return overlaps;
  });
  expect(overlapCount).toBe(0);
  const corner=await page.getByTestId("spot-card-corner-a").boundingBox(),center=await page.getByTestId("spot-card-center-a").boundingBox();
  expect(corner!.y).toBeLessThan(center!.y);expect(corner!.x).toBeLessThan(center!.x);

  await placeBid(page,"First E2E","first@example.com","150000");
  await expect(page.getByTestId("active-auctions")).toHaveText("1");await expect(page.getByTestId("total-raised")).toContainText("0");
  await placeBid(page,"Winner E2E","winner@example.com","155000");
  await expect(page.getByTestId("spot-card-new-spot")).toContainText("Winner E2E");

  let checkoutUrl="";
  await expect.poll(async()=>{
    const audit=await (await request.get("/api/test/audit?spotId=new-spot")).json() as {bids:Array<{company:string;status:string;checkoutUrl:string|null;paymentLinkSentAt:string|null}>};
    const winner=audit.bids.find(b=>b.company==="Winner E2E");checkoutUrl=winner?.checkoutUrl??"";return {status:winner?.status,sent:Boolean(winner?.paymentLinkSentAt),url:Boolean(checkoutUrl)};
  },{timeout:15_000}).toEqual({status:"PAYMENT_PENDING",sent:true,url:true});

  await page.goto(checkoutUrl);await expect(page.getByRole("heading",{name:"Completar pago ganador"})).toBeVisible();
  await page.getByRole("button",{name:"Aprobar pago de prueba"}).click();await expect(page.getByRole("heading",{name:"Oferta confirmada"})).toBeVisible();
  await page.getByRole("link",{name:"Volver a la subasta"}).click();
  await expect(page.getByTestId("total-raised")).toContainText("155.000");await expect(page.getByTestId("spot-card-new-spot")).toBeDisabled();
});

test("shows an animated contextual brand preview and floating action on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");
  await page.getByTestId("spot-card-top-band").click();const dialog=page.getByTestId("bid-dialog");
  await dialog.getByLabel("Marca o empresa").fill("Prisma Labs");await expect(dialog.getByLabel(/Vista previa de Prisma Labs/)).toContainText("Prisma Labs");
  await page.getByRole("button",{name:"Cerrar"}).click();await expect(page.getByTestId("floating-bid-tab")).toContainText("Franja superior");
});

async function placeBid(page:import("@playwright/test").Page,company:string,email:string,amount:string){
  await page.getByTestId("spot-card-new-spot").click();const dialog=page.getByTestId("bid-dialog");
  await dialog.getByLabel("Marca o empresa").fill(company);await dialog.getByLabel("Tu oferta").fill(amount);await dialog.getByLabel("Email de contacto").fill(email);
  await dialog.getByRole("button",{name:/Confirmar oferta sin pagar/}).click();await expect(page.getByTestId("bid-confirmed")).toBeVisible();
  await dialog.getByRole("button",{name:"Seguir la subasta"}).click();
}
