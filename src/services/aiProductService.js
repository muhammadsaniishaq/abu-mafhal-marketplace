// ============================================
// AI PRODUCT DESCRIPTION SERVICE
// src/services/aiProductService.js
// ============================================

class AIProductService {
  constructor() {
    this.openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
    this.geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  }

  /**
   * Generate product description using AI
   */
  async generateDescription(productData) {
    const { name, category, price, features } = productData;

    // If no API keys available, use template-based generation
    if (!this.openaiKey && !this.geminiKey) {
      return this.generateTemplateDescription(productData);
    }

    try {
      if (this.geminiKey) {
        return await this.generateWithGemini(productData);
      } else if (this.openaiKey) {
        return await this.generateWithOpenAI(productData);
      }
    } catch (error) {
      console.error('AI description generation failed:', error);
      // Fallback to template
      return this.generateTemplateDescription(productData);
    }
  }

  /**
   * Generate with OpenAI GPT
   */
  async generateWithOpenAI(productData) {
    const { name, category, price, features, brand } = productData;

    const prompt = `Write a compelling, SEO-optimized product description for an e-commerce listing:

Product Name: ${name}
Category: ${category}
Price: ₦${price.toLocaleString()}
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
        'Authorization': `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
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
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.choices[0].message.content;
  }

  /**
   * Generate with Google Gemini
   */
  async generateWithGemini(productData) {
    const { name, category, price, features, brand } = productData;

    const prompt = `Write a compelling, SEO-optimized product description for:

Product: ${name}
Category: ${category}
Price: ₦${price.toLocaleString()}
${brand ? `Brand: ${brand}` : ''}
${features ? `Features: ${features}` : ''}

Create 3-4 engaging paragraphs that highlight benefits and value.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.candidates[0].content.parts[0].text;
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