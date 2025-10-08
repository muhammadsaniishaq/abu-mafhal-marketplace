// ============================================
// AI ASSISTANT - src/components/AIAssistant.jsx
// ============================================
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Sparkles, ShoppingBag, Package, Search, TrendingUp } from 'lucide-react';
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";


const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      text: 'Hello! 👋 I\'m your AI shopping assistant. How can I help you today?',
      timestamp: new Date(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { cartItems } = useCart();
  const { currentUser } = useAuth();

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Quick action buttons
  const quickActions = [
    { icon: ShoppingBag, text: 'Recommend products', action: 'recommend' },
    { icon: Package, text: 'Track my order', action: 'track' },
    { icon: Search, text: 'Find deals', action: 'deals' },
    { icon: TrendingUp, text: 'Trending items', action: 'trending' },
  ];

  // AI Response Logic
  const getAIResponse = (userMessage) => {
    const message = userMessage.toLowerCase();

    // Product recommendations
    if (message.includes('recommend') || message.includes('suggest') || message.includes('buy')) {
      return {
        text: 'Based on your browsing history and preferences, I recommend checking out our trending electronics and fashion items! 🛍️\n\nHere are some top picks:\n\n📱 iPhone 17 Pro Max - ₦100,000\n💻 MacBook Pro 2024 - ₦450,000\n👟 Nike Air Max - ₦35,000\n\nWould you like to see more details about any of these?',
        suggestions: ['Show iPhone details', 'More electronics', 'Fashion items']
      };
    }

    // Order tracking
    if (message.includes('order') || message.includes('track') || message.includes('delivery')) {
      return {
        text: currentUser 
          ? '📦 Let me check your orders...\n\nYour recent order #12345 is:\n✅ Status: On the way\n📍 Location: Lagos Distribution Center\n🚚 Expected delivery: Tomorrow, 2-5 PM\n\nWould you like more details?'
          : 'Please log in to track your orders. I can help you create an account if you need! 😊',
        suggestions: currentUser ? ['Order details', 'Contact courier'] : ['Sign in', 'Create account']
      };
    }

    // Deals and discounts
    if (message.includes('deal') || message.includes('discount') || message.includes('sale') || message.includes('offer')) {
      return {
        text: '🎉 Great news! Here are today\'s hot deals:\n\n⚡ Flash Sale: Up to 50% off Electronics\n🔥 Weekend Special: Buy 2 Get 1 Free on Fashion\n💰 New User Offer: Extra 10% off first purchase\n🎁 Free shipping on orders over ₦10,000\n\nWhich category interests you?',
        suggestions: ['Electronics deals', 'Fashion offers', 'All categories']
      };
    }

    // Cart assistance
    if (message.includes('cart') || message.includes('checkout')) {
      const itemCount = cartItems?.length || 0;
      return {
        text: itemCount > 0
          ? `You have ${itemCount} item${itemCount > 1 ? 's' : ''} in your cart! 🛒\n\nWould you like to:\n• Review your cart\n• Proceed to checkout\n• Find similar items\n• Apply discount codes`
          : 'Your cart is empty. Let me help you find something amazing! What are you looking for today? 🔍',
        suggestions: itemCount > 0 ? ['View cart', 'Checkout', 'Apply coupon'] : ['Browse products', 'See deals']
      };
    }

    // Product search
    if (message.includes('find') || message.includes('search') || message.includes('looking for')) {
      return {
        text: 'I can help you find exactly what you need! 🔍\n\nWhat category are you interested in?\n\n📱 Electronics\n👕 Fashion\n🏠 Home & Living\n💄 Beauty\n⚽ Sports\n📚 Books\n\nOr tell me a specific product name!',
        suggestions: ['Electronics', 'Fashion', 'Home & Living', 'Beauty']
      };
    }

    // Payment help
    if (message.includes('payment') || message.includes('pay')) {
      return {
        text: '💳 We accept multiple payment methods:\n\n✅ Paystack (Cards, Bank Transfer, USSD)\n✅ Flutterwave (Cards, Mobile Money)\n✅ Cryptocurrency (Bitcoin, Ethereum, USDT)\n\nAll payments are secure and encrypted. Need help with a specific payment method?',
        suggestions: ['Payment issues', 'Refund policy', 'Contact support']
      };
    }

    // Shipping info
    if (message.includes('ship') || message.includes('deliver')) {
      return {
        text: '🚚 Shipping Information:\n\n📍 We deliver nationwide\n⏱️ Standard: 3-7 business days\n🚀 Express: 1-2 business days (₦2,500)\n💝 Free shipping on orders over ₦10,000\n\nWhere are you located?',
        suggestions: ['Shipping cost', 'Delivery time', 'Track order']
      };
    }

    // Compare products
    if (message.includes('compare')) {
      return {
        text: '⚖️ I can help you compare products!\n\nOur comparison tool lets you:\n• Compare prices\n• Check specifications\n• Read reviews\n• See ratings\n\nWhat products would you like to compare?',
        suggestions: ['Compare phones', 'Compare laptops', 'View comparisons']
      };
    }

    // Trending items
    if (message.includes('trend') || message.includes('popular') || message.includes('best seller')) {
      return {
        text: '🔥 Trending Now:\n\n1. iPhone 17 Pro Max ⭐ 4.9/5\n2. Samsung Galaxy S25 Ultra ⭐ 4.8/5\n3. Sony WH-1000XM6 Headphones ⭐ 4.9/5\n4. Nike Air Jordan 1 ⭐ 4.7/5\n5. MacBook Pro M4 ⭐ 5.0/5\n\nThese items are flying off the shelves! Want to see any of them?',
        suggestions: ['Show details', 'More trending', 'Add to cart']
      };
    }

    // Greetings
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
      return {
        text: `Hello${currentUser ? ' ' + currentUser.displayName : ''}! 👋\n\nI'm here to help you with:\n• Product recommendations\n• Order tracking\n• Finding deals\n• Answering questions\n\nWhat can I do for you today?`,
        suggestions: ['Recommend products', 'Track order', 'Find deals']
      };
    }

    // Thank you
    if (message.includes('thank') || message.includes('thanks')) {
      return {
        text: 'You\'re welcome! 😊 Is there anything else I can help you with today?',
        suggestions: ['Browse products', 'View cart', 'Track order']
      };
    }

    // Help
    if (message.includes('help')) {
      return {
        text: '🤖 I can assist you with:\n\n✨ Product recommendations\n📦 Order tracking\n💰 Finding deals & discounts\n🔍 Product search\n💳 Payment assistance\n🚚 Shipping information\n⚖️ Product comparisons\n📞 Customer support\n\nWhat do you need help with?',
        suggestions: ['Recommend products', 'Track order', 'Find deals', 'Contact support']
      };
    }

    // Default response
    return {
      text: 'I understand you\'re asking about "' + userMessage + '". Let me help you with that!\n\nCould you provide more details? Or try one of these options:',
      suggestions: ['Recommend products', 'Track order', 'Find deals', 'Contact support']
    };
  };

  // Handle sending message
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Add user message
    const userMsg = {
      id: messages.length + 1,
      type: 'user',
      text: inputMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      const aiResponse = getAIResponse(inputMessage);
      
      const aiMsg = {
        id: messages.length + 2,
        type: 'ai',
        text: aiResponse.text,
        suggestions: aiResponse.suggestions,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1000);
  };

  // Handle quick action
  const handleQuickAction = (action) => {
    const actionMessages = {
      recommend: 'Can you recommend some products for me?',
      track: 'I want to track my order',
      deals: 'Show me the best deals',
      trending: 'What are the trending items?',
    };

    setInputMessage(actionMessages[action] || '');
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
    handleSendMessage();
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 animate-pulse"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">AI Shopping Assistant</h3>
                <p className="text-xs opacity-90">Online • Always here to help</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 p-2 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="p-3 bg-gray-50 border-b grid grid-cols-2 gap-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(action.action)}
                className="flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-blue-50 transition text-sm"
              >
                <action.icon className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700">{action.text}</span>
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  {message.suggestions && message.type === 'ai' && (
                    <div className="mt-3 space-y-2">
                      {message.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="block w-full text-left text-xs bg-white text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl p-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;