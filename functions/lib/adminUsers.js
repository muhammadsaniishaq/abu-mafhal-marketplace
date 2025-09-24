"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserWithRole = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const auth = admin.auth();
const db = admin.firestore();
exports.createUserWithRole = functions.https.onCall(async (data, context) => {
    // ✅ Step 1: Check if caller is admin
    if (!context.auth?.token?.role ||
        !["admin", "superadmin"].includes(context.auth.token.role)) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can create users.");
    }
    const { email, password, name, role, status } = data;
    if (!email || !role) {
        throw new functions.https.HttpsError("invalid-argument", "Email and role are required.");
    }
    try {
        // ✅ Step 2: Create Firebase Auth user
        const userRecord = await auth.createUser({
            email,
            password: password || "TempPass123!", // fallback password
            displayName: name || email.split("@")[0],
        });
        // ✅ Step 3: Assign custom claims (role)
        await auth.setCustomUserClaims(userRecord.uid, { role });
        // ✅ Step 4: Save user profile in Firestore
        await db.collection("users").doc(userRecord.uid).set({
            uid: userRecord.uid,
            name: name || userRecord.displayName,
            email,
            role,
            status: status || "active",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, uid: userRecord.uid };
    }
    catch (error) {
        console.error("Error creating user:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to create user");
    }
});
