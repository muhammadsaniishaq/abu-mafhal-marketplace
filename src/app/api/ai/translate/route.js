// app/api/ai/translate/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function POST(req) {
    if (!genAI) {
        return NextResponse.json({ error: 'AI service is not initialized due to missing API key.' }, { status: 500 });
    }

    try {
        const { text, targetLanguage, sourceLanguage } = await req.json();

        if (!text || !targetLanguage) {
            return NextResponse.json({ error: 'text and targetLanguage are required for translation.' }, { status: 400 });
        }

        const prompt = `Translate the following text from ${sourceLanguage || 'auto-detected'} to ${targetLanguage}.
        
        Text to translate:
        "${text}"

        Provide only the translated text, with no additional commentary or formatting.`;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translatedText = response.text();

        return NextResponse.json({ translatedText: translatedText });

    } catch (error) {
        console.error('Error in /api/ai/translate:', error);
        return NextResponse.json({ error: 'Failed to translate text with AI.', details: error.message }, { status: 500 });
    }
}