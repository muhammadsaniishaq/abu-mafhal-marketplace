"use client";

import { useEffect, useState } from "react";
import { auth } from "@/firebase";
import { sendEmailVerification } from "firebase/auth";

export default function VerifyEmailBanner() {
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user && !user.emailVerified) {
      setShow(true);
    }
  }, []);

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    setSending(true);
    setMessage(null);
    try {
      await sendEmailVerification(auth.currentUser);
      setMessage("✅ Verification email sent! Check your inbox.");
    } catch (err: any) {
      setMessage("❌ " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!show) return null;

  return (
    <div className="w-full bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 flex items-center justify-between">
      <span>
        ⚠️ Please verify your email to unlock all features of Abu Mafhal Marketplace.
      </span>
      <div className="flex items-center space-x-3">
        <button
          onClick={resendVerification}
          disabled={sending}
          className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
        >
          {sending ? "Sending..." : "Resend Email"}
        </button>
      </div>
      {message && <span className="ml-4 text-sm">{message}</span>}
    </div>
  );
}
