// app/api/ai/kyc/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function POST(req) {
    if (!genAI) {
        return NextResponse.json({ error: 'AI service is not initialized due to missing API key.' }, { status: 500 });
    }

    try {
        const { userId, documentType, documentData, selfieImageBase64 } = await req.json(); // documentData could be text/JSON, selfie as Base64

        if (!userId || !documentType || (!documentData && !selfieImageBase64)) {
            return NextResponse.json({ error: 'userId, documentType, and either documentData (for text-based review) or selfieImageBase64 (for image review) are required for KYC.' }, { status: 400 });
        }

        const parts = [
            { text: `Perform a Know Your Customer (KYC) verification assessment based on the provided information for User ID: ${userId}.` },
            { text: `Document Type: ${documentType}` },
        ];

        if (documentData) {
            parts.push({ text: `Document Data: ${JSON.stringify(documentData, null, 2)}` });
            parts.push({ text: "Review the document data for consistency, completeness, and validity (e.g., matching names, valid dates, correct formats)." });
        }

        if (selfieImageBase64) {
            // Assuming selfieImageBase64 is a data URL (e.g., "data:image/jpeg;base64,...")
            const selfieBase64Only = selfieImageBase64.split(',')[1] || selfieImageBase64;
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg", // Assume JPEG for selfies, adjust if needed (e.g. from client)
                    data: selfieBase64Only,
                },
            });
            parts.push({ text: "Analyze the provided selfie image for liveness detection (signs of a live person, not a photo of a photo), facial recognition against document details (if available), and check for discrepancies, signs of spoofing, or image manipulation." });
        }

        parts.push({ text: `Based on all the provided data, assess the verification status as "Verified", "Pending Review", or "Failed".
        Provide a detailed explanation for the status, highlighting any red flags or successful verification points.
        Output format:
        Verification Status: [Verified/Pending Review/Failed]
        Explanation: [Detailed explanation]` });

        // Use vision model if an image is involved, otherwise gemini-pro (though vision model handles text too)
        const model = selfieImageBase64 ? genAI.getGenerativeModel({ model: "gemini-pro-vision" }) : genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent({ contents: [{ parts }] });
        const response = await result.response;
        const kycAnalysis = response.text();

        let verificationStatus = 'Pending Review';
        let explanation = 'AI analysis in progress or could not be fully parsed.';

        const statusMatch = kycAnalysis.match(/Verification Status:\s*(Verified|Pending Review|Failed)/i);
        if (statusMatch && statusMatch[1]) {
            verificationStatus = statusMatch[1];
        }

        const explanationMatch = kycAnalysis.match(/Explanation:\s*(.*)/is);
        if (explanationMatch && explanationMatch[1]) {
            explanation = explanationMatch[1].trim();
        }

        return NextResponse.json({ verificationStatus, explanation, rawAnalysis: kycAnalysis });

    } catch (error) {
        console.error('Error in /api/ai/kyc:', error);
        return NextResponse.json({ error: 'Failed to perform KYC verification with AI.', details: error.message }, { status: 500 });
    }
}