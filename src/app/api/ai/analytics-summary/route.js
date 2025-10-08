// app/api/ai/analytics-summary/route.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export async function POST(req) {
    if (!genAI) {
        return NextResponse.json({ error: 'AI service is not initialized due to missing API key.' }, { status: 500 });
    }

    try {
        const { dateRange, salesData, customerData, marketingCampaignData } = await req.json();

        const prompt = `Analyze the following e-commerce analytics data for the period ${dateRange || 'N/A'} and provide a concise summary of key trends, performance highlights, and actionable insights.

        Sales Data: ${salesData ? JSON.stringify(salesData, null, 2) : 'No sales data provided.'}
        Customer Data (summary/segments): ${customerData ? JSON.stringify(customerData, null, 2) : 'No customer data provided.'}
        Marketing Campaign Performance: ${marketingCampaignData ? JSON.stringify(marketingCampaignData, null, 2) : 'No marketing campaign data provided.'}

        Focus on:
        - Overall sales performance (growth/decline, revenue figures)
        - Popular products/categories and underperformers
        - Customer behavior (e.g., new vs. returning, average order value, churn if available)
        - Campaign effectiveness (ROI, conversion rates)
        - Key recommendations for improvement or strategy adjustment.

        Provide the summary in bullet points, followed by a separate section for clear, actionable recommendations.`;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        return NextResponse.json({ summary: summary });

    } catch (error) {
        console.error('Error in /api/ai/analytics-summary:', error);
        return NextResponse.json({ error: 'Failed to generate analytics summary with AI.', details: error.message }, { status: 500 });
    }
}