"use client";
import { useState } from "react";
import { emailSignIn, googleSignIn } from "@/services/auth";

export default function Login() {
  const [email,setEmail] = useState(""); const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    await emailSignIn(email, password).catch(console.error);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Sign in</h2>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-black text-white py-2 rounded" disabled={loading}>{loading?"Signing in…":"Sign in"}</button>
      </form>
      <button onClick={googleSignIn} className="w-full border mt-3 py-2 rounded">Continue with Google</button>
    </div>
  );
}
