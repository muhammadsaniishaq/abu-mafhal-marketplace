// app/api/ai/fraud/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function POST(req) {
    if (!genAI) {
        return NextResponse.json({ error: 'AI service is not initialized due to missing API key.' }, { status: 500 });
    }

    try {
        const { transactionDetails, userHistory, deviceFingerprint, ipAddress } = await req.json();

        if (!transactionDetails) {
            return NextResponse.json({ error: 'transactionDetails are required.' }, { status: 400 });
        }

        const prompt = `Analyze the following transaction details and associated information to identify potential signs of fraudulent activity.
        Assign a "Fraud Risk Score" from 1-10 (1=Very Low Risk, 10=Very High Risk) and provide a concise explanation of the identified risk factors.

        Transaction Details: ${JSON.stringify(transactionDetails, null, 2)}
        User History: ${userHistory ? JSON.stringify(userHistory, null, 2) : 'No user history provided.'}
        Device Fingerprint Hash: ${deviceFingerprint || 'N/A'}
        IP Address: ${ipAddress || 'N/A'}
        
        Indicators to look for:
        - Mismatched billing/shipping addresses or unusual shipping addresses.
        - High-value first-time purchases.
        - Rapid succession of orders or unusual order patterns.
        - Geographic discrepancies (IP vs. shipping location).
        - High number of recent failed payment attempts.
        - Unusual payment method usage.
        - Suspicious user account behavior (e.g., very new account, sudden changes).

        Output format:
        Risk Score: [1-10]
        Explanation: [Detailed explanation of findings and reasoning for the score.]`;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const fraudAnalysis = response.text();

        let riskScore = 0;
        let explanation = "No clear risk factors identified by AI.";

        const scoreMatch = fraudAnalysis.match(/Risk Score:\s*(\d+)/);
        if (scoreMatch && scoreMatch[1]) {
            riskScore = parseInt(scoreMatch[1], 10);
        }

        const explanationMatch = fraudAnalysis.match(/Explanation:\s*(.*)/s);
        if (explanationMatch && explanationMatch[1]) {
            explanation = explanationMatch[1].trim();
        }

        return NextResponse.json({ riskScore, explanation, rawAnalysis: fraudAnalysis });

    } catch (error) {
        console.error('Error in /api/ai/fraud:', error);
        return NextResponse.json({ error: 'Failed to perform fraud detection analysis with AI.', details: error.message }, { status: 500 });
    }
}