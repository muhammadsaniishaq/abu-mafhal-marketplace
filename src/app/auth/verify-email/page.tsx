"use client";

import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/firebase";

export default function VerifyEmail() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setMessage("✅ Verification email sent again. Check your inbox!");
      }
    } catch (err: any) {
      setError("❌ " + err.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-xl font-bold">Verify Your Email 📧</h1>
      <p className="mt-2">Click the link in your email to continue.</p>
      <button
        onClick={handleResend}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        Resend Email
      </button>
      {message && <p className="mt-2 text-green-600">{message}</p>}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  );
}
