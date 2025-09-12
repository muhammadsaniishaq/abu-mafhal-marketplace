"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

export default function PhoneSignInPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [message, setMessage] = useState("");

  // Setup Recaptcha
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible", // can also be "normal" for visible captcha
        callback: (response: any) => {
          console.log("Recaptcha verified");
        },
      });
    }
  };

  // Send OTP
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setupRecaptcha();
    try {
      const appVerifier = window.recaptchaVerifier;
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
      setMessage("OTP sent! Check your phone.");
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  // Verify OTP
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await confirmationResult.confirm(otp);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setMessage("Invalid OTP. Please try again.");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold mb-4">Sign In with Phone</h1>

      {!confirmationResult ? (
        <form onSubmit={sendOtp} className="space-y-3 w-full max-w-sm">
          <input
            type="tel"
            placeholder="+2348100000000"
            className="w-full border p-2 rounded"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button type="submit" className="bg-green-600 text-white w-full p-2 rounded">
            Send OTP
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-3 w-full max-w-sm">
          <input
            type="text"
            placeholder="Enter OTP"
            className="w-full border p-2 rounded"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <button type="submit" className="bg-blue-600 text-white w-full p-2 rounded">
            Verify OTP
          </button>
        </form>
      )}

      <div id="recaptcha-container"></div>
      {message && <p className="text-sm mt-3">{message}</p>}
    </main>
  );
}
