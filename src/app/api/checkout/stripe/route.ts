// src/app/api/checkout/stripe/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const resp = await fetch(process.env.NEXT_PUBLIC_STRIPE_FUNCTION_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
// Note: This file is a simple proxy to the Stripe function URL defined in environment variables.