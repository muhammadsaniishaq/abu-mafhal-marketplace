"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

// ✅ Extend the Window interface so TypeScript knows about recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export default function PhoneAuthPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Setup Recaptcha
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible", // use "normal" if you want visible captcha
        callback: (response: any) => {
          console.log("Recaptcha resolved:", response);
        },
      });
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    try {
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
      alert("OTP sent to your phone");
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;

    try {
      await confirmationResult.confirm(otp);
      alert("Phone number verified!");
    } catch (err: any) {
      console.error(err);
      alert("Invalid OTP");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">Phone Authentication</h1>

        <input
          type="text"
          placeholder="+234 8012345678"
          className="w-full border p-2 rounded"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {!confirmationResult ? (
          <button
            onClick={handleSendOtp}
            className="bg-blue-600 text-white w-full p-2 rounded"
          >
            Send OTP
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              className="w-full border p-2 rounded"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button
              onClick={handleVerifyOtp}
              className="bg-green-600 text-white w-full p-2 rounded"
            >
              Verify OTP
            </button>
          </>
        )}

        {/* 🔹 Recaptcha container */}
        <div id="recaptcha-container"></div>
      </form>
    </main>
  );
}
