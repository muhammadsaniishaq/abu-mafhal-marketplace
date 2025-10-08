// app/api/ai/review-analysis/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function POST(req) {
    if (!genAI) {
        return NextResponse.json({ error: 'AI service is not initialized due to missing API key.' }, { status: 500 });
    }

    try {
        const { reviewText, productId } = await req.json();

        if (!reviewText) {
            return NextResponse.json({ error: 'reviewText is required.' }, { status: 400 });
        }

        const prompt = `Analyze the sentiment of the following customer review and categorize it as 'Positive', 'Neutral', or 'Negative'.
        Identify the main aspects of the product/service mentioned (e.g., "product quality", "delivery speed", "customer service", "price").
        Provide a brief, 1-2 sentence summary of the review.

        Customer Review for Product ID ${productId || 'N/A'}:
        "${reviewText}"

        Output format:
        Sentiment: [Positive/Neutral/Negative]
        Key Aspects: [Aspect1, Aspect2, ...] (comma-separated list)
        Summary: [A brief, 1-2 sentence summary of the review]`;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const analysisText = response.text();

        let sentiment = 'Unknown';
        let keyAspects = [];
        let summary = 'Could not parse summary from AI analysis.';

        const sentimentMatch = analysisText.match(/Sentiment:\s*(Positive|Neutral|Negative)/i);
        if (sentimentMatch && sentimentMatch[1]) {
            sentiment = sentimentMatch[1];
        }

        const aspectsMatch = analysisText.match(/Key Aspects:\s*(.*)/i);
        if (aspectsMatch && aspectsMatch[1]) {
            keyAspects = aspectsMatch[1].split(',').map(a => a.trim()).filter(a => a !== '');
        }

        const summaryMatch = analysisText.match(/Summary:\s*(.*)/is);
        if (summaryMatch && summaryMatch[1]) {
            summary = summaryMatch[1].trim();
        }

        return NextResponse.json({ sentiment, keyAspects, summary, rawAnalysis: analysisText });

    } catch (error) {
        console.error('Error in /api/ai/review-analysis:', error);
        return NextResponse.json({ error: 'Failed to analyze review sentiment with AI.', details: error.message }, { status: 500 });
    }
}