import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  // Call Gemini here using fetch to Google API with GEMINI_API_KEY (server-side)
  // Return a fake response for now:
  return NextResponse.json({ text: `Gemini would answer to: ${prompt}` });
}
