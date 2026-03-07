import { supabase } from '../lib/supabase';

// REPLACE WITH YOUR GEMINI API KEY
// Get one here: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyD9K1UENZsJf5KVuoxCf_0lUsK2q--f9nA';

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const cleanAIJsonResponse = (text) => {
    if (!text || typeof text !== 'string') return null;
    try {
        // Remove markdown code blocks
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("AI JSON Parse Error:", e, "Raw Text:", text);
        return null;
    }
};

export const geminiService = {

    /**
     * Identify product keywords from an image
     * @param {string} base64Image - Base64 string of the image
     * @returns {Promise<string>} - Suggested search keywords
     */
    searchByImage: async (base64Image) => {
        if (!base64Image) return null;
        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            console.warn('Gemini API Key missing');
            // Mock fallback if key is missing to prevent crash, but warn user
            return "Shoes";
        }

        try {
            const body = {
                contents: [{
                    parts: [
                        { text: "Analyze this image for an e-commerce app. Identify the product. If you are 100% sure of the specific model (e.g. 'iPhone 15 Pro'), return it. IF YOU ARE UNSURE of the specific version, return the SERIES or GENERIC name (e.g. 'iPhone', 'Samsung Galaxy', 'Sneakers'). Do not guess specific numbers if they are not visible. Just say 'iPhone' if it looks like one. Return ONLY the name. No sentences." },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }]
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            console.log("Gemini Raw Response:", JSON.stringify(result, null, 2));

            if (result.error) {
                throw new Error(`API Error: ${result.error.message}`);
            }

            const candidate = result.candidates?.[0];
            if (!candidate) {
                // Check prompt feedback if available
                if (result.promptFeedback?.blockReason) {
                    throw new Error(`Blocked: ${result.promptFeedback.blockReason}`);
                }
                throw new Error("No response from AI.");
            }

            if (candidate.finishReason !== "STOP") {
                console.warn("Gemini Finish Reason:", candidate.finishReason);
            }

            const text = candidate.content?.parts?.[0]?.text;
            if (!text) throw new Error("AI returned empty text.");

            return text.trim();

        } catch (error) {
            console.error("Gemini Image Error Detailed:", error);
            throw error;
        }
    },

    /**
     * Transcribe audio/voice to text intent
     * @param {string} base64Audio - Base64 string of the audio file
     * @returns {Promise<string>} - Transcribed text/intent
     */
    searchByVoice: async (base64Audio) => {
        if (!base64Audio) return null;
        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            console.warn('Gemini API Key missing');
            return "Table";
        }

        try {
            const body = {
                contents: [{
                    parts: [
                        { text: "Listen to this audio and extract the search intent. Return ONLY the key terms the user is looking for (e.g. 'Red Dress')." },
                        {
                            inline_data: {
                                mime_type: "audio/aac", // Better compatibility for Expo AAC recordings
                                data: base64Audio
                            }
                        }
                    ]
                }]
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            return text ? text.trim() : null;

        } catch (error) {
            console.error("Gemini Voice Error:", error);
            throw error;
        }
    },

    /**
     * Generate product description based on basic info
     * @param {object} product - Product name, category, brand, etc.
     * @returns {Promise<string>} - Generated description
     */
    generateDescription: async (product) => {
        try {
            const prompt = `Write a compelling, professional e-commerce product description for:
            Name: ${product.name}
            Brand: ${product.brand}
            Category: ${product.category}
            
            Keep it engaging, highlight key features, and make it around 100-150 words. Use bullet points for features if appropriate. Tone: Premium and Persuasive.`;

            const body = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return "Could not generate description.";
            return text.trim();

        } catch (error) {
            console.error("Gemini Description Error:", error);
            throw error;
        }
    },

    /**
     * Generate SEO title, description and keywords
     * @param {object} product - Product info
     * @returns {Promise<object>} - { title, description, keywords }
     */
    generateSEO: async (product) => {
        try {
            const prompt = `Generate SEO metadata for this product in JSON format:
            Name: ${product.name}
            Category: ${product.category}
            Description: ${product.description || product.name}

            Return purely JSON with these keys:
            - title: (Max 60 chars, include keywords)
            - description: (Max 160 chars, compelling)
            - keywords: (Comma separated list of 10 high-value keywords)
            
            Example output:
            {
                "title": "Premium Wireless Headphones - Noise Cancelling",
                "description": "Experience crystal clear sound with our new wireless headphones. 30hr battery life.",
                "keywords": "headphones, wireless, audio, noise cancelling, bluetooth"
            }
            RETURN JSON ONLY. NO MARKDOWN.`;

            const body = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            return cleanAIJsonResponse(text);

        } catch (error) {
            console.error("Gemini SEO Error:", error);
            throw error;
        }
    },

    /**
     * Generate catchy promo banner copy
     * @param {object} context - { productName, subtitle, discount }
     * @returns {Promise<object>} - { title, subtitle, buttonText, notification }
     */
    generatePromoCopy: async (context) => {
        try {
            const prompt = `Generate catchy e-commerce promo banner copy. 
            Analyze the linked product and the provided image to create content that matches the visual style.
            ${context.productName ? `Linked Product: ${context.productName}` : 'General Store Promotion'}
            ${context.discount ? `Discount: ${context.discount}` : ''}
            ${context.subtitle ? `Current Theme: ${context.subtitle}` : ''}

            Return purely JSON with these keys:
            - title: (Short, high-energy, max 25 chars. Examples: "FLASH SALE", "ELITE DEALS", "LIMITED OFFER")
            - subtitle: (Secondary info, max 40 chars. Examples: "Up to 50% Off Everything!", "Grab Yours Before It's Gone")
            - buttonText: (Call to action, max 15 chars. Examples: "SHOP NOW", "GET OFFER", "CLAIM NOW")
            - notification: (Short push notification style, max 50 chars. Examples: "Don't miss out! 50% discount active now.")

            Return purely JSON. NO MARKDOWN. NO EXPLANATIONS.`;

            const parts = [{ text: prompt }];
            if (context.base64Image) {
                parts.push({
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: context.base64Image
                    }
                });
            }

            const body = {
                contents: [{ parts }]
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const result = await response.json();
            console.log("AI Promo Debug - Raw Result:", JSON.stringify(result));

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log("AI Promo Debug - Extracted Text:", text);

            return cleanAIJsonResponse(text);

        } catch (error) {
            console.error("Gemini Promo Copy Error:", error);
            return null;
        }
    }
};
