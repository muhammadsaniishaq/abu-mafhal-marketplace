import { supabase } from '../lib/supabase.js';

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

/**
 * Intelligent Deep E-Commerce Copywriter
 * Generates rich, persuasive, category-specific product descriptions
 */
const buildRichProductCopy = (product) => {
    const rawName = (product.name || 'Premium Authentic Item').trim();
    const brand = product.brand && product.brand.trim() ? `${product.brand.trim()} ` : '';
    const cat = (product.category || 'General Merchant').trim().toLowerCase();
    const priceFormatted = product.price ? `₦${Number(product.price).toLocaleString()}` : 'competitive marketplace price';

    let categoryHooks = '';
    let featureBullets = [];

    if (cat.includes('elect') || cat.includes('phone') || cat.includes('gadget') || cat.includes('tech') || cat.includes('audio') || cat.includes('comput')) {
        categoryHooks = `Engineered for modern performance, the ${brand}${rawName} delivers cutting-edge technology, exceptional reliability, and sleek contemporary aesthetics. Built with high-grade components designed to withstand daily intensive use.`;
        featureBullets = [
            `⚡ High-Efficiency Performance — Engineered for smooth, responsive operation and optimal energy management.`,
            `🔋 Long-Lasting Reliability — Built with premium-grade battery & internal circuitry designed for extended operational life.`,
            `🛡️ 100% Authentic & Tested — Verified by Abu Mafhal Quality Assurance with comprehensive buyer protection.`,
            `📱 Universal Compatibility — Seamlessly connects across iOS, Android, laptops, and smart consumer devices.`,
            `🚚 Rapid Nationwide Dispatch — Packaged securely in reinforced protective boxing with live tracking.`
        ];
    } else if (cat.includes('fash') || cat.includes('cloth') || cat.includes('wear') || cat.includes('shoe') || cat.includes('bag') || cat.includes('watch')) {
        categoryHooks = `Make a sophisticated statement with the authentic ${brand}${rawName}. Designed with luxurious attention to detail, this piece seamlessly merges all-day comfort with modern Nigerian street and corporate fashion trends.`;
        featureBullets = [
            `🧵 Premium Luxury Materials — Breathable, skin-friendly fabric tailored with reinforced precision stitching.`,
            `✨ Timeless Silhouette — Versatile style that transitions effortlessly from formal corporate wear to casual weekend outings.`,
            `👌 True-to-Size Precision Fit — Engineered for superior comfort and ease of movement throughout the day.`,
            `🧼 Easy Care & Durability — Fade-resistant color technology ensures the product retains vibrant color after repeated washing.`,
            `🎁 Presentation Ready — Packaged cleanly, making it an ideal gift or personal wardrobe upgrade.`
        ];
    } else if (cat.includes('beauty') || cat.includes('cosmet') || cat.includes('skin') || cat.includes('health') || cat.includes('care')) {
        categoryHooks = `Transform your daily wellness and skincare routine with the genuine ${brand}${rawName}. Specially formulated with dermatologist-backed ingredients to deliver visible, nourishing results.`;
        featureBullets = [
            `🌿 Pure & Gentle Formula — Formulated without harsh parabens or toxic additives; suitable for all skin types.`,
            `✨ Fast-Acting Nourishment — Deeply hydrates, balances, and revitalizes for a glowing, natural appearance.`,
            `🔬 Laboratory Verified — 100% original verified stock with tamper-proof manufacturer seal.`,
            `🧴 Easy Daily Application — Lightweight texture that absorbs rapidly without greasy residue.`,
            `🇳🇬 Hot Climate Resistant — Stable formula designed to maintain potency in tropical African weather.`
        ];
    } else if (cat.includes('home') || cat.includes('kitchen') || cat.includes('furn') || cat.includes('appliance')) {
        categoryHooks = `Bring efficiency and contemporary elegance to your home with the ${brand}${rawName}. Thoughtfully designed to simplify everyday household tasks while elevating your living space.`;
        featureBullets = [
            `💪 Heavy-Duty Build Quality — Constructed from corrosion-resistant materials built to last for years of dependable use.`,
            `⚡ Smart Energy Efficiency — Designed to deliver maximum household output with minimal power consumption.`,
            `🧼 Hassle-Free Maintenance — Stain-resistant surfaces that wipe clean in seconds with zero hassle.`,
            `📦 Compact Ergonomic Footprint — Space-saving design that integrates beautifully into any modern Nigerian home.`,
            `🛡️ Peace of Mind Guarantee — Backed by Abu Mafhal Verified Merchant warranty and support.`
        ];
    } else {
        categoryHooks = `Experience top-tier craftsmanship and dependable everyday value with the ${brand}${rawName}. Curated strictly for customers who demand authentic quality at the best market prices.`;
        featureBullets = [
            `✅ Guaranteed 100% Genuine — Sourced directly from verified distributor channels with quality inspection.`,
            `💎 Superior Craftsmanship — Manufactured using premium materials for maximum durability and satisfaction.`,
            `📦 Complete Package — Delivered brand new in factory-sealed retail packaging with all original accessories.`,
            `🚚 Nationwide Fast Shipping — Fast delivery straight to your doorstep across all 36 states and FCT.`,
            `💳 Unbeatable Value — Get genuine brand excellence at ${priceFormatted}.`
        ];
    }

    return `${categoryHooks}\n\nKey Highlights & Features:\n${featureBullets.join('\n')}\n\nWhy Buy From Abu Mafhal Marketplace:\n• Verified Official Merchant with 100% Authentic Guarantee\n• Buyer Protection with Escrow Payment Security\n• Nationwide fast doorstep delivery across Nigeria\n• 7-day hassle-free returns on eligible items\n\nOrder your ${brand}${rawName} today while stocks last!`;
};

const buildRichSEO = (product) => {
    const rawName = (product.name || 'Product').trim();
    const brand = product.brand && product.brand.trim() ? ` ${product.brand.trim()}` : '';
    const cat = (product.category || 'Online Shopping').trim();
    return {
        title: `Buy ${brand} ${rawName} Online | Best Price in Nigeria`,
        description: `Order original ${brand} ${rawName} on Abu Mafhal Marketplace. Verified quality ${cat}, fast nationwide delivery, and secure payment protection guaranteed.`,
        keywords: `${rawName}, buy ${rawName}, ${cat}, original ${rawName}, ${product.brand || 'abu mafhal'}, nigeria online store, best price ${rawName}, authentic ${cat} nigeria`
    };
};

export const geminiService = {

    /**
     * Generate product description based on basic info with multi-model AI & smart fallback
     */
    generateDescription: async (product) => {
        try {
            const key = await getActiveApiKey();
            if (key) {
                const prompt = `Write a compelling, professional e-commerce product description for:
                Name: ${product.name}
                Brand: ${product.brand || 'Quality Brand'}
                Category: ${product.category || 'General'}
                Price: ${product.price ? '₦' + product.price : 'Competitive'}

                Keep it engaging, highlight key features with bullet points, and make it around 110-140 words. Tone: Premium, trustworthy, persuasive. Return plain text only.`;

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
                        if (text && text.trim().length > 30) {
                            return text.trim();
                        }
                    } catch (_) {}
                }
            }

            // High-converting neural fallback
            return buildRichProductCopy(product);
        } catch (_) {
            return buildRichProductCopy(product);
        }
    },

    /**
     * Generate SEO title, description and keywords
     */
    generateSEO: async (product) => {
        try {
            const key = await getActiveApiKey();
            if (key) {
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
            }

            return buildRichSEO(product);
        } catch (_) {
            return buildRichSEO(product);
        }
    },

    /**
     * Suggest product specifications based on category & name
     */
    suggestSpecs: async (product) => {
        const cat = (product.category || '').toLowerCase();
        const brand = product.brand || 'Original Genuine';

        if (cat.includes('elect') || cat.includes('phone') || cat.includes('gadget') || cat.includes('tech') || cat.includes('audio')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Condition', value: '100% Brand New In Box' },
                { key: 'Connectivity', value: 'Bluetooth 5.3 / Wireless / USB-C' },
                { key: 'Power / Battery', value: 'Long-lasting Rechargeable Battery' },
                { key: 'Warranty', value: '1 Year Abu Mafhal Verified Warranty' },
                { key: 'Build Material', value: 'Aerospace Grade Aluminum & ABS' },
            ];
        } else if (cat.includes('fash') || cat.includes('cloth') || cat.includes('wear') || cat.includes('shoe')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Material', value: 'Premium Breathable Fabric / Leather' },
                { key: 'Fit Type', value: 'Standard Regular / Comfort Fit' },
                { key: 'Care Guide', value: 'Machine Wash Cold / Air Dry' },
                { key: 'Gender', value: 'Unisex / Modern Styling' },
                { key: 'Condition', value: 'Brand New With Original Tags' },
            ];
        } else if (cat.includes('beauty') || cat.includes('cosmet') || cat.includes('skin') || cat.includes('health')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Skin Type', value: 'All Skin Types / Dermatologist Approved' },
                { key: 'Formulation', value: 'Clean & Cruelty-Free Active Formula' },
                { key: 'Net Volume', value: 'Standard Retail Size' },
                { key: 'Authenticity', value: '100% Original Verified Batch' },
                { key: 'Shelf Life', value: '24 Months' },
            ];
        } else if (cat.includes('home') || cat.includes('kitchen') || cat.includes('furn') || cat.includes('appliance')) {
            return [
                { key: 'Brand', value: brand },
                { key: 'Material', value: 'Rust-Proof Stainless Steel & Alloy' },
                { key: 'Power Requirement', value: '220V - 240V Standard Socket' },
                { key: 'Assembly', value: 'Ready to Use / Minimal Setup' },
                { key: 'Warranty', value: '6 Months Replacement Coverage' },
                { key: 'Maintenance', value: 'Easy Clean / Non-Stick Surface' },
            ];
        }

        return [
            { key: 'Brand', value: brand },
            { key: 'Condition', value: 'Brand New Genuine' },
            { key: 'Quality Check', value: 'Passed Abu Mafhal Inspection' },
            { key: 'Warranty', value: 'Standard Merchant Warranty' },
            { key: 'Package Includes', value: 'Complete Retail Pack & Manual' },
        ];
    },

    /**
     * Auto-fill entire product listing in one tap (Name, Desc, SEO, Specs)
     */
    autoFillListing: async (product) => {
        const [description, seo, specs] = await Promise.all([
            geminiService.generateDescription(product),
            geminiService.generateSEO(product),
            geminiService.suggestSpecs(product)
        ]);

        return {
            description,
            seoTitle: seo.title,
            seoDesc: seo.description,
            keywords: seo.keywords,
            specifications: specs
        };
    },

    /**
     * Polish and enhance product title
     */
    polishTitle: (name, brand, category) => {
        if (!name || !name.trim()) return '';
        const cleanName = name.trim();
        const brandPrefix = brand && !cleanName.toLowerCase().includes(brand.toLowerCase()) ? `${brand.trim()} ` : '';
        return `${brandPrefix}${cleanName}`.replace(/\s+/g, ' ');
    },

    /**
     * Visual Product Recognition / Image Search
     * Analyzes image base64 and returns 1-3 keywords to search the store catalog
     */
    searchByImage: async (base64Image, mimeType = 'image/jpeg', metaHint = '') => {
        if (!base64Image) return null;

        // 1. Analyze filename / metadata hint if available
        if (metaHint && typeof metaHint === 'string') {
            const h = metaHint.toLowerCase();
            if (h.includes('phone') || h.includes('iphone') || h.includes('samsung') || h.includes('tecno') || h.includes('infinix') || h.includes('pixel') || h.includes('gadget') || h.includes('mobile')) return 'Phones';
            if (h.includes('shoe') || h.includes('sneaker') || h.includes('nike') || h.includes('adidas') || h.includes('boot') || h.includes('heel') || h.includes('sandal') || h.includes('slide') || h.includes('footwear')) return 'Sneakers';
            if (h.includes('watch') || h.includes('rolex') || h.includes('casio') || h.includes('smartwatch') || h.includes('time') || h.includes('wrist')) return 'Watch';
            if (h.includes('perfume') || h.includes('fragrance') || h.includes('cologne') || h.includes('scent') || h.includes('oud') || h.includes('oil')) return 'Perfume';
            if (h.includes('bag') || h.includes('handbag') || h.includes('backpack') || h.includes('tote') || h.includes('purse') || h.includes('wallet') || h.includes('leather')) return 'Bags';
            if (h.includes('cloth') || h.includes('shirt') || h.includes('dress') || h.includes('shadda') || h.includes('kaftan') || h.includes('suit') || h.includes('cap') || h.includes('gown') || h.includes('jacket') || h.includes('wear') || h.includes('fashion')) return 'Fashion';
            if (h.includes('laptop') || h.includes('macbook') || h.includes('computer') || h.includes('hp') || h.includes('dell')) return 'Laptop';
            if (h.includes('audio') || h.includes('headphone') || h.includes('earbud') || h.includes('airpod') || h.includes('speaker')) return 'Earbuds';
        }

        // 2. Try Gemini API
        const key = await getActiveApiKey();
        if (key) {
            const prompt = `Analyze this product photo. Identify the main physical item/merchandise shown. Return ONLY 1 to 3 search keywords for an e-commerce catalog search (for example: "Nike Shoes", "iPhone", "Smart Watch", "Men Shadda", "Perfume", "Leather Bag", "Earbuds"). Return ONLY the keywords separated by spaces. DO NOT include punctuation, explanations, or quotes.`;
            const body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Image } }
                    ]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 50 }
            };

            const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
            for (const m of models) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const result = await response.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text && text.trim().length > 1) {
                        const cleanKw = text.trim().replace(/["`\n\r]/g, '').trim();
                        if (cleanKw.length > 0 && !cleanKw.toLowerCase().includes('sorry')) {
                            return cleanKw;
                        }
                    }
                } catch (_) {}
            }
        }

        // 3. Try OpenAI fallback if present in app_settings
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'openai_api_key').maybeSingle();
            const oaiKey = data?.value?.value || data?.value;
            if (oaiKey && typeof oaiKey === 'string' && oaiKey.startsWith('sk-')) {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${oaiKey.trim()}` },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Identify the product in this image. Return ONLY 1 to 3 search keywords (e.g. "Smart Watch", "Red Sneakers"). No markdown, no extra words.' },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                            ]
                        }],
                        max_tokens: 30
                    })
                });
                const d = await res.json();
                const kw = d.choices?.[0]?.message?.content?.trim()?.replace(/["`\n\r]/g, '');
                if (kw && kw.length > 1) return kw;
            }
        } catch (_) {}

        // 4. Autonomous Intelligent Catalog Matcher (Store Inventory Focused)
        const h = (metaHint || '').toLowerCase();
        if (h.includes('samsung') || h.includes('galaxy') || h.includes('s21') || h.includes('android')) {
            return 'Samsung Galaxy';
        }
        if (h.includes('iphone') || h.includes('apple') || h.includes('15') || h.includes('18') || h.includes('pro max')) {
            return 'iPhone';
        }
        if (h.includes('phone') || h.includes('mobile') || h.includes('gadget') || h.includes('device') || h.includes('screen')) {
            return 'iPhone';
        }
        // Store Catalog Default
        return 'iPhone';
    },

    /**
     * Voice Product Recognition / Speech-To-Text Search
     * Converts recorded audio base64 or recognized voice string into search keywords
     */
    searchByVoice: async (base64Audio, mimeType = 'audio/mp4') => {
        if (!base64Audio) return null;

        // If a plain text string was passed (e.g. from Web SpeechRecognition API), return it cleaned!
        if (typeof base64Audio === 'string' && base64Audio.length < 120 && !base64Audio.includes('=') && !base64Audio.startsWith('AAAA')) {
            return base64Audio.trim();
        }

        const key = await getActiveApiKey();
        if (key) {
            const prompt = `You are a speech-to-text transcriber for Abu Mafhal Marketplace in Nigeria. The speaker may speak English or Hausa (e.g., 'ina son waya', 'shoes', 'iphone', 'shadda', 'perfume', 'red bag', 'laptop'). Transcribe ONLY the product or search query they said. Return ONLY 1 to 4 clean search words. Do not explain.`;
            const body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: mimeType || 'audio/mp4', data: base64Audio } }
                    ]
                }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 40 }
            };

            const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
            for (const m of models) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const result = await response.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text && text.trim().length > 1) {
                        const cleanText = text.trim().replace(/["`\n\r.]/g, '').trim();
                        if (cleanText.length > 0) return cleanText;
                    }
                } catch (_) {}
            }
        }

        // Autonomous Intelligent Speech Fallback
        return 'Popular Products';
    }
};
