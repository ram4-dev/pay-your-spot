import { PaymentResult } from "@/components/payment-result";

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const value = (key: string) => {
    const entry = query[key];
    return Array.isArray(entry) ? entry[0] : entry;
  };

  return (
    <PaymentResult
      result={value("result")}
      paymentId={value("payment_id") ?? value("collection_id")}
      testMode={value("test") === "1"}
    />
  );
}
