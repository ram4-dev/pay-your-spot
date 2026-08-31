import { describe,expect,it,vi } from "vitest";
import { ResendEmailProvider } from "./resend";

describe("ResendEmailProvider",()=>{
  it("sends the winner link with a stable idempotency key",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({id:"email-123"}));
    const provider=new ResendEmailProvider("private-test-key","Startup Day <subastas@example.com>",fetcher);
    await provider.sendWinnerPayment({bidId:"bid-123",to:"winner@example.com",company:"Winner Labs",placement:"Esquina superior",amountCents:18_000_000,checkoutUrl:"https://pay.example/123",paymentDueAt:"2026-08-30T15:00:00Z"});
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails",expect.objectContaining({method:"POST",headers:expect.objectContaining({"Idempotency-Key":"winner-payment/bid-123"})}));
    const body=JSON.parse(String(fetcher.mock.calls[0][1]?.body));expect(body.to).toEqual(["winner@example.com"]);expect(body.html).toContain("https://pay.example/123");expect(JSON.stringify(body)).not.toContain("private-test-key");
  });
});
