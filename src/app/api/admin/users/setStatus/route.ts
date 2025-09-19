import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

// NOTE: In real prod, verify caller is admin using a header token or cookies + Admin SDK.
export async function POST(req: NextRequest) {
  try {
    const { uid, status } = await req.json();
    if (!uid || !status) return NextResponse.json({ error: "uid/status required" }, { status: 400 });

    await updateDoc(doc(db, "users", uid), { status });
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
