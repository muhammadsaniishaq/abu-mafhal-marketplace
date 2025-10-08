import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { productName } = await req.json();
  const prompt = `Suggest a simple eCommerce category for the product "${productName}".`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = await response.json();
  const category = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Uncategorized";

  return NextResponse.json({ category });
}
