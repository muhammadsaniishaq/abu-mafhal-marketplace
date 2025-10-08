import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 🔑 Gemini API key (add to .env.local)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json(); // analytics data from frontend
    const { orders, payouts, disputes } = body;

    const prompt = `
You are an AI analytics assistant for an e-commerce multi-vendor marketplace.
Based on the data provided, give insights in plain English.

Data:
- Total Orders: ${orders.length}
- Total Revenue: ${orders.reduce((s: number, o: any) => s + (o.amount || 0), 0)}
- Total Payouts: ${payouts.reduce((s: number, p: any) => s + (p.amount || 0), 0)}
- Total Disputes: ${disputes.length}
- Orders Breakdown: ${JSON.stringify(
      orders.map((o: any) => ({ status: o.status, amount: o.amount || 0 }))
    )}

Generate 3-5 short insights (1–2 sentences each).
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    return NextResponse.json({ insights: aiText });
  } catch (err) {
    console.error("Gemini API error:", err);
    return NextResponse.json({ insights: "Could not generate insights." }, { status: 500 });
  }
}
