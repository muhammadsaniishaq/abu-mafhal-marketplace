import React, { useState, useEffect, useRef } from 'react';
// Assume the firebase services and global variables are available in the scope
// of the immersive environment.

// --- CONFIGURATION CONSTANTS (To be used by the Next.js API Route) ---
// In a real Next.js app, this would be a server-side API call.
// We are simulating the core logic here for demonstration purposes.
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
const API_KEY = ""; // Canvas will populate this key at runtime

// Helper function to implement exponential backoff for API retries
const fetchWithExponentialBackoff = async (url, options, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && response.status === 429 && i < retries - 1) {
                // Too Many Requests, retry
                console.warn(`Rate limit exceeded, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                continue;
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === retries - 1) {
                console.error("API call failed after all retries:", error);
                throw error;
            }
            console.error(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
};

// Simulated Server-Side Logic for the Chat Assistant
const fetchAIChatResponse = async (chatHistory) => {
    const systemPrompt = "You are Abu Mafhal, a friendly and expert e-commerce marketplace assistant. Your primary goal is to help customers find products, answer general FAQs, and route order-specific questions. Keep responses concise and helpful. You are powered by Google Gemini.";

    const payload = {
        contents: chatHistory.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        })),
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    };

    try {
        // Use the simulated API route URL (if deployed) or the direct API endpoint
        const response = await fetchWithExponentialBackoff(`${API_URL}?key=${API_KEY}`, options);
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that request right now.";
        return { text };
    } catch (error) {
        console.error("Error fetching AI response:", error);
        return { text: "I apologize, the connection to the AI assistant is currently down." };
    }
};


// Main Chat Assistant Component
const App = () => {
    const initialHistory = [
        { role: 'model', text: "Hello! I'm Abu Mafhal's AI Assistant. How can I help you with your shopping or vendor needs today?" }
    ];
    const [chatHistory, setChatHistory] = useState(initialHistory);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Scroll to the bottom of the chat when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);


    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', text: input.trim() };
        
        // 1. Add user message to history
        const newHistory = [...chatHistory, userMessage];
        setChatHistory(newHistory);
        setInput('');
        setIsLoading(true);

        try {
            // 2. Call the simulated API route
            const aiResponse = await fetchAIChatResponse(newHistory);
            
            // 3. Add AI response to history
            const aiMessage = { role: 'model', text: aiResponse.text };
            setChatHistory(currentHistory => [...currentHistory, aiMessage]);

        } catch (error) {
            console.error("Failed to get response:", error);
            setChatHistory(currentHistory => [
                ...currentHistory,
                { role: 'model', text: "A critical error occurred while fetching the response. Please try again." }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const getIcon = (role) => {
        if (role === 'user') {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-indigo-500">
                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                </svg>
            );
        } else {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-pink-600">
                    <path fillRule="evenodd" d="M11.54 22.351A8.252 8.252 0 0 0 21 12.388V7.5c0-.621-.504-1.125-1.125-1.125h-4.232c-.443 1.343-1.045 2.583-1.802 3.682-1.42 2.1-3.683 3.49-6.262 3.893-1.282.204-2.522-.178-3.546-.991-.3-.236-.612-.48-.941-.727a23.951 23.951 0 0 1-.47.66 2.25 2.25 0 0 1-2.454.496.75.75 0 0 1-.438-.667 8.254 8.254 0 0 0 6.559 1.776c1.246-.195 2.453-.615 3.559-1.28l.2.33a8.25 8.25 0 0 0 8.017 4.102c.98-.14 1.93-.374 2.825-.7a.75.75 0 0 0 .445-.668Z" clipRule="evenodd" />
                </svg>
            );
        }
    };


    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-[Inter]">
            <div className="w-full max-w-lg bg-white shadow-2xl rounded-xl flex flex-col h-[80vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-pink-600 to-indigo-600 text-white shadow-md">
                    <h1 className="text-xl font-bold flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2">
                            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.75 7.75a.75.75 0 0 0-.75-.75H6a.75.75 0 0 0-.75.75v8.5a.75.75 0 0 0 .75.75h12.75a.75.75 0 0 0 .75-.75v-8.5ZM5.25 7.5a.75.75 0 0 0-.75.75V16a.75.75 0 0 0 .75.75h-.75a.75.75 0 0 1-.75-.75V8.25a.75.75 0 0 1 .75-.75h.75ZM19.5 7.5a.75.75 0 0 0-.75.75V16a.75.75 0 0 0 .75.75h.75a.75.75 0 0 1 .75.75v-8.5a.75.75 0 0 1-.75-.75h-.75Z" />
                        </svg>
                        Abu Mafhal AI Chat
                    </h1>
                    <p className="text-sm opacity-90 mt-1">Ready to assist with products, orders, and policies.</p>
                </div>

                {/* Chat History Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.map((message, index) => (
                        <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex items-start max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className="flex-shrink-0 mt-1">
                                    {getIcon(message.role)}
                                </div>
                                <div className={`p-3 rounded-lg shadow-md mx-2 text-sm whitespace-pre-wrap ${
                                    message.role === 'user' 
                                        ? 'bg-indigo-100 text-gray-800 rounded-tr-none' 
                                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                                }`}>
                                    {message.text}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="flex items-start max-w-[80%] flex-row">
                                <div className="flex-shrink-0 mt-1">
                                    {getIcon('model')}
                                </div>
                                <div className="p-3 rounded-lg shadow-md mx-2 text-sm bg-white border border-gray-200 rounded-tl-none animate-pulse">
                                    <div className="h-2 w-12 bg-gray-300 rounded"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex space-x-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me about products, orders, or vendors..."
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm disabled:bg-gray-200"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-semibold shadow-md transition duration-150 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.105 2.289a.75.75 0 0 0-.826.802l.399 9.497a.75.75 0 0 0 .85.666l8.8-1.559c.17-.03-.357-.752.417-.923l8.8-1.559a.75.75 0 0 0 .417-.923l-.399-9.497a.75.75 0 0 0-.85-.666l-8.8 1.559a1.5 1.5 0 0 1-.417.923l-.418-.112-8.8-1.559a.75.75 0 0 0-.85-.666Z" />
                                </svg>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default App;
