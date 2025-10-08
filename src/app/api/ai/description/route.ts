import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, keywords, category } = body;
    if (!title) {
      return NextResponse.json({ error: "Product title is required" }, { status: 400 });
    }

    const prompt = `
Generate a professional and SEO-optimized e-commerce product description.

Product Name: ${title}
Category: ${category || "General"}
Keywords: ${keywords || "N/A"}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const data = await response.json();
    const description = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate description.";

    return NextResponse.json({ description });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate description" }, { status: 500 });
  }
}