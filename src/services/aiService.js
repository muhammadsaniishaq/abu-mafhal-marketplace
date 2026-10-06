import { supabase } from '../config/supabase.js';

class AIService {
  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    this.geminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  }

  async getActiveKeys() {
    let gemKey = this.geminiKey;
    let oaiKey = this.apiKey;

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

  // Get AI response using OpenAI GPT
  async getOpenAIResponse(userMessage, context = {}, overrideKey) {
    const key = overrideKey || this.apiKey;
    try {
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
              content: `You are a helpful AI shopping assistant for Abu Mafhal Marketplace. 
              Help users with:
              - Product recommendations
              - Order tracking
              - Finding deals
              - Answering product questions
              - Shopping assistance
              
              Current context:
              - User cart items: ${context.cartItems?.length || 0}
              - User logged in: ${context.isLoggedIn ? 'Yes' : 'No'}
              - User name: ${context.userName || 'Guest'}
              
              Be friendly, helpful, and concise. Use emojis appropriately.`
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        return {
          text: data.choices[0].message.content,
          suggestions: this.generateSuggestions(userMessage)
        };
      }
      return this.getFallbackResponse(userMessage);
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  // Get AI response using Google Gemini
  async getGeminiResponse(userMessage, context = {}, overrideKey) {
    const key = overrideKey || this.geminiKey;
    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

    for (const m of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are a helpful AI shopping assistant for Abu Mafhal Marketplace.
                  
                  Context:
                  - Cart items: ${context.cartItems?.length || 0}
                  - User: ${context.userName || 'Guest'}
                  - Logged in: ${context.isLoggedIn ? 'Yes' : 'No'}
                  
                  User message: ${userMessage}
                  
                  Provide a helpful, friendly response with emojis. Be concise and action-oriented.`
                }]
              }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
            }),
          }
        );

        if (!response.ok) continue;
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return {
            text,
            suggestions: this.generateSuggestions(userMessage)
          };
        }
      } catch (error) {
        console.error('Gemini API Error:', error);
      }
    }

    return this.getFallbackResponse(userMessage);
  }

  // Main method to get AI response
  async getAIResponse(userMessage, context = {}) {
    const { geminiKey, openaiKey } = await this.getActiveKeys();

    if (geminiKey) {
      const res = await this.getGeminiResponse(userMessage, context, geminiKey);
      if (res && res.text) return res;
    }
    if (openaiKey) {
      const res = await this.getOpenAIResponse(userMessage, context, openaiKey);
      if (res && res.text) return res;
    }
    return this.getFallbackResponse(userMessage);
  }

  // Fallback response when no API key is configured
  getFallbackResponse(userMessage) {
    const message = userMessage.toLowerCase();

    // Smart pattern matching for common queries
    const responses = {
      recommend: {
        text: 'Based on popular items, I recommend:\n\n📱 iPhone 17 Pro Max - ₦100,000\n💻 MacBook Pro 2024 - ₦450,000\n👟 Nike Air Max - ₦35,000\n\nWould you like details on any of these?',
        suggestions: ['Show iPhone details', 'More electronics', 'Fashion items']
      },
      order: {
        text: '📦 To track your order:\n1. Go to "My Orders"\n2. Enter your order number\n3. View real-time status\n\nNeed help with a specific order?',
        suggestions: ['My Orders', 'Contact Support', 'Order History']
      },
      deal: {
        text: '🎉 Current Deals:\n\n⚡ Flash Sale: 50% off Electronics\n🔥 Weekend Special: Buy 2 Get 1 Free\n💰 New Users: Extra 10% off\n\nWhich interests you?',
        suggestions: ['Electronics deals', 'Fashion offers', 'All categories']
      },
      cart: {
        text: 'Let me help with your cart! You can:\n• View cart items\n• Apply discount codes\n• Proceed to checkout\n• Save for later\n\nWhat would you like to do?',
        suggestions: ['View Cart', 'Apply Coupon', 'Checkout']
      },
      payment: {
        text: '💳 We accept:\n• Paystack (Cards, Bank Transfer)\n• Flutterwave (Mobile Money)\n• Cryptocurrency (BTC, ETH, USDT)\n\nAll secure & encrypted!',
        suggestions: ['Payment Help', 'Refund Policy', 'Contact Support']
      },
    };

    // Find matching response
    for (const [key, value] of Object.entries(responses)) {
      if (message.includes(key)) {
        return value;
      }
    }

    // Default response
    return {
      text: 'I\'m here to help! 😊\n\nI can assist with:\n• Product recommendations\n• Order tracking\n• Finding deals\n• Payment help\n• Shipping info\n\nWhat do you need?',
      suggestions: ['Recommend Products', 'Track Order', 'Find Deals', 'Help']
    };
  }

  // Generate contextual suggestions
  generateSuggestions(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('recommend') || message.includes('suggest')) {
      return ['Show more', 'Electronics', 'Fashion', 'Home & Living'];
    }
    if (message.includes('order') || message.includes('track')) {
      return ['Order status', 'Contact courier', 'Order history'];
    }
    if (message.includes('deal') || message.includes('discount')) {
      return ['All deals', 'Electronics offers', 'Fashion sales'];
    }
    if (message.includes('cart')) {
      return ['View cart', 'Apply coupon', 'Checkout'];
    }
    
    return ['Help', 'Products', 'Deals', 'Support'];
  }

  // Product recommendation based on user behavior
  async getProductRecommendations(userId, preferences = {}) {
    // This would typically call your backend API
    // For now, return sample recommendations
    return {
      trending: [
        { id: 1, name: 'iPhone 17 Pro Max', price: 100000, category: 'Electronics' },
        { id: 2, name: 'MacBook Pro M4', price: 450000, category: 'Electronics' },
        { id: 3, name: 'Nike Air Jordan', price: 35000, category: 'Fashion' },
      ],
      personalized: [
        { id: 4, name: 'Sony WH-1000XM6', price: 85000, category: 'Electronics' },
        { id: 5, name: 'Samsung Galaxy S25', price: 95000, category: 'Electronics' },
      ],
      deals: [
        { id: 6, name: 'iPad Pro 2024', price: 180000, discount: 20, category: 'Electronics' },
        { id: 7, name: 'Apple Watch Series 10', price: 120000, discount: 15, category: 'Electronics' },
      ]
    };
  }

  // Smart search with AI understanding
  async smartSearch(query, filters = {}) {
    // AI-enhanced search that understands context
    // Example: "cheap phones under 50k" -> price filter + category
    const searchTerms = query.toLowerCase();
    
    const results = {
      query,
      filters: {},
      suggestions: []
    };

    // Price detection
    if (searchTerms.includes('cheap') || searchTerms.includes('affordable')) {
      results.filters.maxPrice = 50000;
    }
    if (searchTerms.match(/\d+k/)) {
      const price = parseInt(searchTerms.match(/\d+/)[0]) * 1000;
      results.filters.maxPrice = price;
    }

    // Category detection
    const categories = ['phone', 'laptop', 'fashion', 'shoes', 'electronics'];
    categories.forEach(cat => {
      if (searchTerms.includes(cat)) {
        results.filters.category = cat;
      }
    });

    // Brand detection
    const brands = ['apple', 'samsung', 'nike', 'adidas', 'sony'];
    brands.forEach(brand => {
      if (searchTerms.includes(brand)) {
        results.filters.brand = brand;
      }
    });

    return results;
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;