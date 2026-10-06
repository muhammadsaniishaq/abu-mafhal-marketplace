import { supabase } from '../config/supabase.js';

class AIProductService {
  constructor() {
    this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    this.geminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  async getActiveKeys() {
    let gemKey = this.geminiKey;
    let oaiKey = this.openaiKey;

    try {
      const cached = localStorage.getItem('@abumafhal_settings_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        const g = parsed.gemini_api_key?.value || parsed.gemini_api_key;
        const o = parsed.openai_api_key?.value || parsed.openai_api_key;
        if (g && typeof g === 'string') gemKey = g.trim();
        if (o && typeof o === 'string') oaiKey = o.trim();
      }
    } catch (_) {}

    if (!gemKey || !oaiKey) {
      try {
        const { data } = await supabase.from('app_settings').select('key,value').in('key', ['gemini_api_key', 'openai_api_key']);
        if (data) {
          const gRow = data.find(d => d.key === 'gemini_api_key');
          const oRow = data.find(d => d.key === 'openai_api_key');
          const g = gRow?.value?.value || gRow?.value;
          const o = oRow?.value?.value || oRow?.value;
          if (g && typeof g === 'string') gemKey = g.trim();
          if (o && typeof o === 'string') oaiKey = o.trim();
        }
      } catch (_) {}
    }

    return { geminiKey: gemKey, openaiKey: oaiKey };
  }

  /**
   * Generate product description using AI
   */
  async generateDescription(productData) {
    const { name, category, price, features } = productData;
    const { geminiKey, openaiKey } = await this.getActiveKeys();

    try {
      if (geminiKey) {
        const desc = await this.generateWithGemini(productData, geminiKey);
        if (desc) return desc;
      }
      if (openaiKey) {
        const desc = await this.generateWithOpenAI(productData, openaiKey);
        if (desc) return desc;
      }
    } catch (error) {
      console.error('AI description generation failed:', error);
    }

    return this.generateTemplateDescription(productData);
  }

  /**
   * Generate with OpenAI GPT
   */
  async generateWithOpenAI(productData, overrideKey) {
    const key = overrideKey || this.openaiKey;
    if (!key) return null;

    const { name, category, price, features, brand } = productData;

    const prompt = `Write a compelling, SEO-optimized product description for an e-commerce listing:

Product Name: ${name}
Category: ${category}
Price: ₦${price ? Number(price).toLocaleString() : 'Competitive'}
${brand ? `Brand: ${brand}` : ''}
${features ? `Key Features: ${features}` : ''}

Requirements:
- 3-4 paragraphs
- Highlight key benefits and features
- Use persuasive language
- Include relevant keywords
- Professional and engaging tone
- Focus on customer value`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert e-commerce copywriter who creates compelling product descriptions that convert.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }

  /**
   * Generate with Google Gemini
   */
  async generateWithGemini(productData, overrideKey) {
    const key = overrideKey || this.geminiKey;
    if (!key) return null;

    const { name, category, price, features, brand } = productData;

    const prompt = `Write a compelling, SEO-optimized product description for:

Product: ${name}
Category: ${category}
Price: ₦${price ? Number(price).toLocaleString() : 'Competitive'}
${brand ? `Brand: ${brand}` : ''}
${features ? `Features: ${features}` : ''}

Create 3-4 engaging paragraphs that highlight benefits and value. Return plain text.`;

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    for (const m of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
            }),
          }
        );
        if (!response.ok) continue;
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 30) return text.trim();
      } catch (_) {}
    }

    return null;
  }

  /**
   * Template-based description generator (fallback)
   */
  generateTemplateDescription(productData) {
    const { name, category, price, features, brand } = productData;

    const categoryDescriptions = {
      electronics: 'cutting-edge technology and innovative features',
      fashion: 'stylish design and premium quality materials',
      home: 'comfort, functionality, and elegant design',
      sports: 'performance, durability, and professional quality',
      beauty: 'premium ingredients and transformative results',
      books: 'engaging content and valuable knowledge',
      toys: 'fun, safety, and educational value',
      food: 'authentic taste and premium quality',
    };

    const categoryDesc = categoryDescriptions[category?.toLowerCase()] || 'exceptional quality and value';

    let description = `Discover the **${name}**, a premium ${category} product that combines ${categoryDesc}.\n\n`;

    if (brand) {
      description += `Brought to you by **${brand}**, a trusted name in quality. `;
    }

    description += `At just **₦${price?.toLocaleString()}**, this product offers exceptional value for money.\n\n`;

    if (features) {
      description += `**Key Features:**\n${features}\n\n`;
    }

    description += `Perfect for those who demand the best, this ${name} is designed to exceed your expectations. Whether you're looking for quality, performance, or style, this product delivers on all fronts.\n\n`;
    
    description += `**Why Choose This Product?**\n`;
    description += `✅ High-quality ${category} product\n`;
    description += `✅ Competitive pricing\n`;
    description += `✅ Fast delivery available\n`;
    description += `✅ Customer satisfaction guaranteed\n\n`;
    
    description += `Order now and experience the difference! Limited stock available.`;

    return description;
  }

  /**
   * Generate SEO keywords
   */
  generateKeywords(productData) {
    const { name, category, brand } = productData;
    
    const keywords = [
      name.toLowerCase(),
      category?.toLowerCase(),
      brand?.toLowerCase(),
      `buy ${name.toLowerCase()}`,
      `${name.toLowerCase()} online`,
      `best ${category?.toLowerCase()}`,
      `${brand?.toLowerCase()} ${category?.toLowerCase()}`,
      `affordable ${name.toLowerCase()}`,
    ].filter(Boolean);

    return [...new Set(keywords)].join(', ');
  }

  /**
   * Generate product title variations for A/B testing
   */
  generateTitleVariations(name, category) {
    return [
      name,
      `Premium ${name}`,
      `${name} - Best in ${category}`,
      `${name} | Free Shipping`,
      `New ${name} Collection`,
    ];
  }

  /**
   * Suggest optimal price based on category
   */
  suggestPrice(category, basePrice) {
    const markup = {
      electronics: 1.2,
      fashion: 1.5,
      home: 1.3,
      sports: 1.4,
      beauty: 1.6,
      books: 1.2,
      toys: 1.3,
      food: 1.2,
    };

    const multiplier = markup[category?.toLowerCase()] || 1.3;
    return Math.round(basePrice * multiplier);
  }

  /**
   * Generate product tags
   */
  generateTags(productData) {
    const { name, category, brand } = productData;
    
    const tags = [
      'trending',
      'new arrival',
      category?.toLowerCase(),
      brand?.toLowerCase(),
      'featured',
      'best seller',
      'premium',
    ].filter(Boolean);

    return [...new Set(tags)];
  }

  /**
   * Optimize product listing
   */
  async optimizeProductListing(productData) {
    const description = await this.generateDescription(productData);
    const keywords = this.generateKeywords(productData);
    const tags = this.generateTags(productData);
    const titleVariations = this.generateTitleVariations(productData.name, productData.category);

    return {
      description,
      keywords,
      tags,
      titleVariations,
      optimizedTitle: titleVariations[0],
    };
  }
}

// Export singleton instance
export const aiProductService = new AIProductService();
export default aiProductService;