"use client";

import { useState } from "react";

export default function VendorChatbot({ product }: { product?: any }) {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setReply("");
    const res = await fetch("/api/ai/vendor-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, product }),
    });
    const data = await res.json();
    setReply(data.reply);
    setLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 border bg-white shadow-lg rounded-lg p-4">
      <h2 className="font-semibold text-lg mb-2">💡 Vendor AI Assistant</h2>
      <textarea
        className="w-full border p-2 rounded mb-2 text-sm"
        placeholder="Ask the AI about improving your sales..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button
        onClick={askAI}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-1.5 rounded hover:bg-blue-700"
      >
        {loading ? "Thinking..." : "Ask AI"}
      </button>

      {reply && (
        <div className="mt-3 border-t pt-2 text-sm max-h-40 overflow-y-auto">
          <p className="whitespace-pre-line">{reply}</p>
        </div>
      )}
    </div>
  );
}
