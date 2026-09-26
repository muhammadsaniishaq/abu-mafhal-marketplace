import { supabase } from '../lib/supabase';

// Cached dynamic API key from Supabase app_settings
let cachedApiKey = null;
let lastKeyFetchTime = 0;

const getActiveApiKey = async () => {
    const now = Date.now();
    if (cachedApiKey && (now - lastKeyFetchTime < 60000)) {
        return cachedApiKey;
    }

    try {
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'gemini_api_key')
            .maybeSingle();

        const keyVal = data?.value?.value || data?.value;
        if (keyVal && typeof keyVal === 'string' && keyVal.trim().length > 10) {
            cachedApiKey = keyVal.trim();
            lastKeyFetchTime = now;
            return cachedApiKey;
        }
    } catch (_) {}

    return null;
};

const cleanAIJsonResponse = (text) => {
    if (!text || typeof text !== 'string') return null;
    try {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
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
        const buildSmartCopy = () => {
            const name = (product.name || 'Premium Product').trim();
            const brand = product.brand ? `${product.brand.trim()} ` : '';
            const cat = (product.category || 'Quality Essentials').trim();
            const price = product.price ? `₦${Number(product.price).toLocaleString()}` : 'competitive market price';

            return `Elevate your everyday experience with the authentic ${brand}${name}. Specifically curated for discerning shoppers looking for top-tier ${cat}, this product combines superior craftsmanship, outstanding durability, and modern aesthetics.\n\nKey Highlights & Features:\n• 100% Authentic Quality Guaranteed — Backed by Abu Mafhal Buyer Protection\n• Superior Performance & Ergonomics — Engineered for reliability and everyday convenience\n• Premium Material Build — Built to last with high-grade, resilient materials\n• Instant Nationwide Dispatch — Fast, safe delivery right to your doorstep across Nigeria\n• Outstanding Value — Enjoy exceptional quality at ${price}\n\nUpgrade your lifestyle with the ${brand}${name} today. Limited stock available on Abu Mafhal Marketplace!`;
        };

        try {
            const key = await getActiveApiKey();
            if (!key) return buildSmartCopy();

            const prompt = `Write a compelling, professional e-commerce product description for:
            Name: ${product.name}
            Brand: ${product.brand || 'Top Quality'}
            Category: ${product.category || 'General'}
            
            Keep it engaging, highlight key features with bullet points, and make it around 100-130 words. Tone: Premium, trustworthy, persuasive. Return plain text only.`;

            const body = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
            for (const m of models) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const result = await response.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text && text.trim().length > 20) {
                        return text.trim();
                    }
                } catch (_) {}
            }

            return buildSmartCopy();
        } catch (_) {
            return buildSmartCopy();
        }
    },

    /**
     * Generate SEO title, description and keywords
     * @param {object} product - Product info
     * @returns {Promise<object>} - { title, description, keywords }
     */
    generateSEO: async (product) => {
        const buildSmartSEO = () => {
            const name = (product.name || 'Product').trim();
            const cat = (product.category || 'Electronics').trim();
            const brand = product.brand ? ` - ${product.brand.trim()}` : '';
            return {
                title: `Buy ${name} Online | Best Price in Nigeria${brand}`,
                description: `Shop authentic ${name} at Abu Mafhal. Discover high quality ${cat} with fast delivery across Nigeria and secure payment guaranteed.`,
                keywords: `${name}, buy ${name}, ${cat}, original ${name}, ${product.brand || 'abu mafhal'}, nigeria online shopping, best price ${name}`
            };
        };

        try {
            const key = await getActiveApiKey();
            if (!key) return buildSmartSEO();

            const prompt = `Generate SEO metadata for this product in JSON format:
            Name: ${product.name}
            Category: ${product.category || 'Products'}
            Description: ${product.description || product.name}

            Return purely JSON with these keys:
            - title: (Max 60 chars, include keywords)
            - description: (Max 160 chars, compelling)
            - keywords: (Comma separated list of 8-10 high-value keywords)
            
            RETURN JSON ONLY. NO MARKDOWN.`;

            const body = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
            for (const m of models) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const result = await response.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    const parsed = cleanAIJsonResponse(text);
                    if (parsed && parsed.title) return parsed;
                } catch (_) {}
            }

            return buildSmartSEO();
        } catch (_) {
            return buildSmartSEO();
        }
    },

    /**
     * Suggest product specifications based on category & name
     */
    suggestSpecs: async (product) => {
        const cat = (product.category || '').toLowerCase();
        const brand = product.brand || 'Original';

        if (cat.includes('elect') || cat.includes('phone') || cat.includes('gadget') || cat.includes('tech')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Condition', value: '100% Brand New' },
                { key: 'Connectivity', value: 'Bluetooth 5.3 / Wireless / Type-C' },
                { key: 'Battery', value: 'Long-lasting Rechargeable Battery' },
                { key: 'Warranty', value: '1 Year Manufacturer Warranty' },
                { key: 'Material', value: 'Premium Matte Finish Alloy & ABS' },
            ];
        } else if (cat.includes('fash') || cat.includes('cloth') || cat.includes('wear') || cat.includes('shoe')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Material', value: 'Premium Breathable Fabric' },
                { key: 'Fit Type', value: 'Regular / Comfort Fit' },
                { key: 'Care Instructions', value: 'Machine wash cold / Gentle cycle' },
                { key: 'Origin', value: 'Imported Quality' },
                { key: 'Condition', value: 'Brand New with Tags' },
            ];
        } else if (cat.includes('beauty') || cat.includes('cosmet') || cat.includes('skin')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Skin Type', value: 'All Skin Types / Dermatologist Tested' },
                { key: 'Formula', value: 'Organic & Cruelty-Free' },
                { key: 'Volume / Net Wt', value: 'Standard Retail Size' },
                { key: 'Origin', value: 'Certified Genuine' },
            ];
        } else if (cat.includes('home') || cat.includes('kitchen') || cat.includes('furn')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Material', value: 'High Grade Stainless Steel / Durable Wood' },
                { key: 'Assembly', value: 'Easy Setup / No Tools Required' },
                { key: 'Warranty', value: '6 Months Replacement Guarantee' },
                { key: 'Care', value: 'Wipe clean with soft damp cloth' },
            ];
        }

        return [
            { key: 'Brand', value: brand },
            { key: 'Condition', value: 'Brand New Genuine' },
            { key: 'Warranty', value: 'Official Warranty' },
            { key: 'Package Includes', value: 'Standard Retail Packaging' },
            { key: 'Origin', value: 'Authentic Abu Mafhal Verified' },
        ];
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
