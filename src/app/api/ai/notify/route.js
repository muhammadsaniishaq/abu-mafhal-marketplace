// app/api/ai/notify/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function POST(req) {
    if (!genAI) {
        return NextResponse.json({ error: 'AI service is not initialized due to missing API key.' }, { status: 500 });
    }

    try {
        const { emailType, context, recipientName, senderName, tone = "professional" } = await req.json();

        if (!emailType || !context) {
            return NextResponse.json({ error: 'emailType and context are required to compose an email.' }, { status: 400 });
        }

        const prompt = `Compose a ${tone} email for an e-commerce context.

        Email Type: ${emailType} (e.g., "marketing campaign for new arrivals", "order confirmation", "customer support response about a refund", "product announcement", "shipping update")
        Context/Key Points to include: ${context}
        Recipient Name: ${recipientName || 'Valued Customer'}
        Sender Name: ${senderName || 'E-commerce Store Team'}

        Include a clear subject line. The email should be well-structured with a greeting, body, and polite closing.
        Output format:
        Subject: [Your Subject Line]
        
        Dear [Recipient Name or appropriate greeting],
        
        [Email Body, 2-4 paragraphs]
        
        Sincerely,
        [Sender Name]`;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const generatedEmail = response.text();

        let subject = "Generated Email";
        let body = generatedEmail;

        const subjectMatch = generatedEmail.match(/Subject:\s*(.*)\n/i);
        if (subjectMatch && subjectMatch[1]) {
            subject = subjectMatch[1].trim();
            body = generatedEmail.replace(subjectMatch[0], '').trim(); // Remove subject line from body
        }

        return NextResponse.json({ subject, body, rawEmail: generatedEmail });

    } catch (error) {
        console.error('Error in /api/ai/notify:', error);
        return NextResponse.json({ error: 'Failed to compose email with AI.', details: error.message }, { status: 500 });
    }
}