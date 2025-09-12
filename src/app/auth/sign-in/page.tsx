"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "@/lib/firebase";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email login
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google login
  const handleGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Facebook login
  const handleFacebook = async () => {
    try {
      await signInWithPopup(auth, facebookProvider);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!email) {
      alert("Please enter your email to reset password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent!");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSignIn} className="w-full max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">Sign In</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white w-full p-2 rounded"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <button
          type="button"
          onClick={handleGoogle}
          className="bg-red-600 text-white w-full p-2 rounded"
        >
          Continue with Google
        </button>

        <button
          type="button"
          onClick={handleFacebook}
          className="bg-blue-800 text-white w-full p-2 rounded"
        >
          Continue with Facebook
        </button>

        <button
          type="button"
          onClick={handleResetPassword}
          className="text-sm text-blue-600 underline mt-2"
        >
          Forgot Password?
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </main>
  );
}
