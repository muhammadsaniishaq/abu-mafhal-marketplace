import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, amount, orderId } = await req.json();

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: orderId,
      amount,
      currency: "NGN",
      redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?orderId=${orderId}`,
      customer: { email },
      payment_options: "card,banktransfer,ussd",
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
