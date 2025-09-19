import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

export const createUserWithRole = onCall(async (request) => {
  const context = request.auth; // ✅ this is how v2 works
  const data = request.data as {
    email: string;
    password?: string;
    name?: string;
    role: "admin" | "superadmin" | "vendor" | "buyer";
    status?: "active" | "suspended";
  };

  if (!context?.token?.role || !["admin", "superadmin"].includes(context.token.role)) {
    throw new HttpsError("permission-denied", "Only admins can create users.");
  }

  try {
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password || "TempPass123!",
      displayName: data.name,
    });

    await auth.setCustomUserClaims(userRecord.uid, { role: data.role });

    await db.collection("users").doc(userRecord.uid).set({
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status || "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new HttpsError("internal", "Failed to create user");
  }
});
