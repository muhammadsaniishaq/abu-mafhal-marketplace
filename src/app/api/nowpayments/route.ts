import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { amount, orderId } = await req.json();

  const response = await fetch("https://api.nowpayments.io/v1/payment", {
    method: "POST",
    headers: {
      "x-api-key": process.env.NOWPAYMENTS_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: "usd",
      pay_currency: "btc", // or "eth", "usdt"
      order_id: orderId,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?orderId=${orderId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/cancel`,
    }),
  });

  const data = await response.json();
  return NextResponse.json(data);
}
