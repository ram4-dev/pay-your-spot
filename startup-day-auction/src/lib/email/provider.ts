import "server-only";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

class TestEmailProvider implements EmailProvider {
  readonly name="test" as const;
  async sendWinnerPayment(input:Parameters<EmailProvider["sendWinnerPayment"]>[0]) { return {id:`test-email-${input.bidId}`}; }
}

export function getEmailProvider():EmailProvider {
  if (process.env.EMAIL_PROVIDER==="test" && process.env.ENABLE_TEST_PAYMENT_PROVIDER==="1") return new TestEmailProvider();
  return new ResendEmailProvider(process.env.RESEND_API_KEY??"",process.env.AUCTION_FROM_EMAIL??"");
}
