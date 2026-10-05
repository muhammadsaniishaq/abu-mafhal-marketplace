import { generateAutonomousUserResponse } from './autonomousAIEngine.js';

export const AIService = {
    /**
     * Send a message to the AI
     * @param {string} prompt - The user's new message
     * @param {Array} history - Array of previous messages { role: 'user' | 'assistant', content: string }
     * @param {string} provider - 'gemini' | 'openai'
     * @param {string} geminiKey - Gemini API Key from settings
     * @param {string} openaiKey - OpenAI API Key from settings
     * @param {string} systemRole - 'user' or 'admin' context
     */
    async generateResponse({ prompt, history = [], provider = 'gemini', geminiKey, openaiKey, systemRole = 'user', imageBase64 = null, imageMimeType = 'image/jpeg', userContext = '' }) {
        const contextNote = userContext ? `\n\n[USER ACCOUNT CONTEXT]:\n${userContext}` : '';
        const followUpInstruction = `\n\nIMPORTANT: After your response, on a new line write EXACTLY: FOLLOW_UP: <question1> | <question2> | <question3> (3 brief, relevant follow-up questions in the SAME language as the user's message). Do NOT skip this.`;

        const langRule = `\n\nLANGUAGE RULE (CRITICAL): Detect the language of each user message and ALWAYS respond in that exact same language. If the user writes in English → respond in English. If in Hausa → respond in Hausa. If mixing both → respond in the same mix. Never switch languages unprompted.`;

        const marketplaceKnowledge = `\n\nABU-MAFHAL MARKETPLACE KNOWLEDGE:
- Payment methods: Bank Transfer, Card Payment, USSD, Paystack gateway, Pay on Delivery, Pay Small Small (0% interest BNPL)
- Orders: Users can track orders via the Orders tab. Statuses: Pending → Processing → Shipped → Delivered
- Returns: Users can request a return within 7 days of delivery via the Support Tickets section
- Support: Users open tickets via Help & Support → New Ticket
- Vendors: Sellers apply via Become a Vendor page; Admin approves/rejects
- Wallet: Users have an in-app wallet; they can top-up via bank transfer
- Referrals: Users earn rewards by referring friends via a referral code
- Delivery: Standard delivery 3-7 business days; Express same-day in Kano and select areas`;

        const systemPrompt = systemRole === 'admin'
            ? `You are a highly intelligent and professional AI Assistant for the Admin of Abu-Mafhal Marketplace. Help manage the platform, write announcements, analyze business trends, draft emails and promos, and give actionable business advice. Be concise, clear, and professional.${langRule}${marketplaceKnowledge}${contextNote}${followUpInstruction}`
            : `You are a helpful, friendly AI Shopping Assistant for Abu-Mafhal Marketplace. Your job is to assist customers with: tracking orders, understanding payments, returning items, finding products, and using the app. Always be warm, clear, and helpful. Never share sensitive data like passwords or full card numbers.${langRule}${marketplaceKnowledge}${contextNote}${followUpInstruction}`;

        let rawText = '';

        // Priority 1: Gemini (if requested and key provided)
        if (provider === 'gemini' && geminiKey && geminiKey.trim().length > 10) {
            try {
                rawText = await this.callGemini(prompt, history, geminiKey, systemPrompt, imageBase64, imageMimeType);
            } catch (gemErr) {
                console.warn('[AI] Gemini call failed:', gemErr.message, 'Trying OpenAI fallback...');
            }
        }

        // Priority 2: OpenAI (if provider is openai, or as fallback from Gemini)
        if (!rawText && openaiKey && openaiKey.trim().length > 10) {
            try {
                rawText = await this.callOpenAI(prompt, history, openaiKey, systemPrompt, imageBase64, imageMimeType);
            } catch (oaiErr) {
                console.warn('[AI] OpenAI call failed:', oaiErr.message, 'Falling back to Autonomous Engine...');
            }
        }

        // Priority 3: Autonomous Intelligent Engine (Zero-failure local guarantee)
        if (!rawText) {
            console.log('[AI] Utilizing Abu Mafhal Autonomous AI Engine...');
            const autoRes = generateAutonomousUserResponse({ prompt, history, userContext });
            return autoRes;
        }

        // Parse follow-up suggestions from cloud response
        const suggMatch = rawText.match(/FOLLOW_UP:\s*(.+)/);
        const suggestions = suggMatch
            ? suggMatch[1].split('|').map(s => s.trim()).filter(Boolean).slice(0, 3)
            : ['Track my order 📦', 'Payment options 💳', 'Find authentic items ✨'];
        const text = rawText.replace(/FOLLOW_UP:.*$/m, '').trim();
        return { text, suggestions };
    },

    /**
     * Analyze a product image and return search keywords for Supabase
     * Returns: { name, category, keywords: string[], color, description }
     */
    async analyzeProductImage(imageBase64, imageMimeType = 'image/jpeg', geminiKey) {
        try {
            if (!geminiKey) throw new Error("Gemini API Key is required for visual product search.");
            const { modelId, version } = await this.getBestGeminiModel(geminiKey);
            const url = `https://generativelanguage.googleapis.com/${version}/models/${modelId}:generateContent?key=${geminiKey}`;

            const prompt = `Analyze this product image carefully. Return ONLY a valid JSON object (no markdown, no backticks) with these exact fields:
{
  "name": "Product name or type (e.g. Nike Air Max, Red Dress, Leather Bag)",
  "category": "One of: clothing, shoes, bags, electronics, accessories, food, beauty, home, sports, other",
  "color": "Main color(s)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "description": "Short 1-sentence description"
}
Be specific. If unsure, make your best guess.`;

            const body = {
                contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
            };

            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "Image analysis failed");

            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const cleaned = rawText.replace(/```json|```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (err) {
            console.warn('[AI] Product image analysis fallback:', err.message);
            return {
                name: 'Authentic Store Item',
                category: 'all',
                color: '',
                keywords: ['authentic', 'popular', 'trending', 'featured'],
                description: 'Verified merchandise from Abu Mafhal Marketplace'
            };
        }
    },

    async getBestGeminiModel(apiKey) {
        // First try v1, then v1beta
        for (const version of ['v1', 'v1beta']) {
            const url = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = await response.json();
            const models = data.models || [];
            // Find models that support generateContent and contain 'gemini'
            const geminiModels = models.filter(m =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                m.name?.toLowerCase().includes('gemini')
            );
            if (geminiModels.length > 0) {
                // Prefer flash > pro > anything else
                const best =
                    geminiModels.find(m => m.name.includes('flash')) ||
                    geminiModels.find(m => m.name.includes('pro')) ||
                    geminiModels[0];
                const modelId = best.name.replace('models/', '');
                console.log(`[AI] Using Gemini model: ${modelId} (${version})`);
                return { modelId, version };
            }
        }
        throw new Error("No Gemini models found for this API Key. Please verify the key has Gemini API access enabled.");
    },

    async callGemini(newPrompt, history, apiKey, systemPrompt, imageBase64 = null, imageMimeType = 'image/jpeg') {
        // Auto-discover the best available model for this key
        const { modelId, version } = await this.getBestGeminiModel(apiKey);
        const url = `https://generativelanguage.googleapis.com/${version}/models/${modelId}:generateContent?key=${apiKey}`;

        // Build contents array (inlining system prompt for compatibility)
        const contents = [
            { role: 'user', parts: [{ text: `SYSTEM INSTRUCTIONS: ${systemPrompt}\n\nConfirm you understand.` }] },
            { role: 'model', parts: [{ text: "Understood. I'll follow these instructions strictly." }] }
        ];

        history.forEach(msg => {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        });

        // Build the user's final message parts (text + optional image)
        const userParts = [{ text: newPrompt || 'What do you see in this image?' }];
        if (imageBase64) {
            userParts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
        }
        contents.push({ role: 'user', parts: userParts });

        const body = {
            contents: contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('[AI] Gemini response status:', response.status);

        if (!response.ok) {
            throw new Error(data.error?.message || "Gemini API Error");
        }

        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("No response generated from Gemini.");
        }
    },

    async callOpenAI(newPrompt, history, apiKey, systemPrompt, imageBase64 = null, imageMimeType = 'image/jpeg') {
        const url = 'https://api.openai.com/v1/chat/completions';

        // Build the user message content (text + optional image)
        let userContent;
        if (imageBase64) {
            userContent = [
                { type: 'text', text: newPrompt || 'What is in this image?' },
                { type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } }
            ];
        } else {
            userContent = newPrompt;
        }

        // Format for OpenAI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(msg => ({
                role: msg.role, // 'user' or 'assistant'
                content: msg.content
            })),
            { role: 'user', content: userContent }
        ];

        const body = {
            model: "gpt-4o-mini", // Fast and cost-effective
            messages: messages,
            temperature: 0.7,
            max_tokens: 800,
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "OpenAI API Error");
        }

        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        } else {
            throw new Error("No response generated from OpenAI.");
        }
    }
};
