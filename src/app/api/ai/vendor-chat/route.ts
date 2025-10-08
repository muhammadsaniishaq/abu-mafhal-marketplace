import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { question, product } = await req.json();

    const prompt = `
You are an AI assistant for e-commerce vendors on Abu Mafhal Marketplace.  
Vendors sell products online.  
Their product (if provided):  
Title: ${product?.title || "N/A"}  
Description: ${product?.description || "N/A"}  
Price: ${product?.price || "N/A"}  
Category: ${product?.category || "N/A"}  

Vendor’s question: ${question}

Answer in clear, actionable advice.  
If product info is missing, give general e-commerce advice.  
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    return NextResponse.json({ reply: aiText });
  } catch (err) {
    console.error("Gemini vendor chatbot error:", err);
    return NextResponse.json({ reply: "AI assistant is unavailable right now." }, { status: 500 });
  }
}
