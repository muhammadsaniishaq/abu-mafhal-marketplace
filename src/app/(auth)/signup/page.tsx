"use client";
import { useState } from "react";
import { signUpWithEmail, googleSignIn } from "@/services/auth";
import type { UserRole } from "@/types";

export default function SignUp() {
  const [email,setEmail] = useState(""); const [password,setPassword]=useState("");
  const [role,setRole] = useState<UserRole>("buyer"); const [loading,setLoading]=useState(false);

  const submit = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    await signUpWithEmail(email, password, role).catch(console.error);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Create account</h2>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full border px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <select className="w-full border px-3 py-2" value={role} onChange={e=>setRole(e.target.value as UserRole)}>
          <option value="buyer">Buyer</option>
          <option value="vendor">Vendor</option>
        </select>
        <button className="w-full bg-black text-white py-2 rounded" disabled={loading}>{loading?"Creating…":"Sign up"}</button>
      </form>
      <button onClick={googleSignIn} className="w-full border mt-3 py-2 rounded">Continue with Google</button>
    </div>
  );
}
