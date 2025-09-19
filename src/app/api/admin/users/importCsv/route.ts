import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(",");

    const col = collection(db, "users");
    for (const line of lines) {
      const cells = line.split(",");
      const item:any = {};
      headers.forEach((h, i) => { item[h.trim()] = cells[i]?.trim(); });
      if (!item.email) continue;
      const ref = doc(col); // generate uid; or use provided uid column
      await setDoc(ref, {
        email: item.email,
        role: item.role || "customer",
        status: item.status || "active",
        createdAt: new Date(),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
