import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

// In production, you’d ALSO call a secured Cloud Function to set custom claims in Auth.
export async function POST(req: NextRequest) {
  try {
    const { uid, role } = await req.json();
    if (!uid || !role) return NextResponse.json({ error: "uid/role required" }, { status: 400 });

    await updateDoc(doc(db, "users", uid), { role });
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
