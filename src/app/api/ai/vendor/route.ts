import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load Gemini API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json(); // product info
    const { product } = body;

    const prompt = `
You are an AI assistant for e-commerce vendors.
Analyze this product and suggest improvements to make it more attractive:

Product:
- Title: ${product.title}
- Description: ${product.description}
- Price: ${product.price}
- Category: ${product.category}
- Images: ${product.images?.length || 0} provided

Give 3–5 short, actionable suggestions for the vendor.
Keep the tone professional but encouraging.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    return NextResponse.json({ suggestions: aiText });
  } catch (err) {
    console.error("Gemini vendor AI error:", err);
    return NextResponse.json({ suggestions: "Could not generate suggestions." }, { status: 500 });
  }
}
