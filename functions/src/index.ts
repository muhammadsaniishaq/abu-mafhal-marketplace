import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Stripe from "stripe";
import crypto from "crypto";
import corsLib from "cors";

// This assumes you have a file named 'adminUsers.ts' in the same directory
// If not, you can remove this line for now.
export { createUserWithRole } from "./adminUsers";

/** ---------- INIT ---------- */
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const logger = functions.logger;

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000"; // Default to localhost for development
const cors = corsLib({ origin: CORS_ORIGIN });

/** ---------- AI RECOMMENDATIONS ---------- */
// Get your Gemini API key from the environment variables
const API_KEY = functions.config().gemini.key;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export const getProductRecommendations = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
    }
    const userId = context.auth.uid;
    try {
        const ordersQuery = db.collection("orders").where("buyerId", "==", userId).limit(5);
        const wishlistQuery = db.collection("users").doc(userId).collection("wishlist").limit(10);
        
        const [ordersSnapshot, wishlistSnapshot] = await Promise.all([ordersQuery.get(), wishlistQuery.get()]);
        
        const userPurchasedItems = ordersSnapshot.docs.flatMap(doc => doc.data().items.map((item: { productName: string; }) => item.productName));
        const userWishlistItems = wishlistSnapshot.docs.map(doc => doc.data().productName);
        const userHistory = [...new Set([...userPurchasedItems, ...userWishlistItems])];

        const productsQuery = db.collection("products").where("isPublished", "==", true).limit(100);
        const productsSnapshot = await productsQuery.get();
        const availableProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, category: doc.data().category }));

        const prompt = `
            You are an expert e-commerce recommendation engine for an online marketplace called Abu Mafhal.
            A user has the following items in their purchase history and wishlist: ${JSON.stringify(userHistory)}.
            From the following list of available products: ${JSON.stringify(availableProducts)},
            recommend 4 products that they would be most interested in.
            - Do NOT recommend products that are already in the user's history.
            - Prioritize products from similar or complementary categories.
            Return ONLY a JSON array of the recommended product IDs. Do not include any other text, explanation, or markdown.
            Example format: ["prod_abc123", "prod_def456", "prod_ghi789"]
        `;
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        const jsonResponse = response.text().replace("```json", "").replace("```", "");
        const recommendedIds = JSON.parse(jsonResponse);
        
        return { productIds: recommendedIds };
    } catch (error) {
        logger.error("Error getting recommendations:", error);
        throw new functions.https.HttpsError("internal", "An error occurred while generating recommendations.");
    }
});


/** ---------- PAYMENT UTILS ---------- */
type OrderStatus = "pending" | "paid" | "refunded" | "cancelled";

async function updateOrderStatus(
  paymentRef: string,
  paymentMethod: "stripe" | "paystack" | "flutterwave" | "crypto",
  status: OrderStatus,
  meta: Record<string, unknown> = {}
) {
  const snap = await db
    .collection("orders")
    .where("paymentRef", "==", paymentRef)
    .where("paymentMethod", "==", paymentMethod)
    .limit(1)
    .get();

  if (snap.empty) {
    logger.warn("Order not found for paymentRef", { paymentRef, paymentMethod, status });
    return;
  }

  const docRef = snap.docs[0].ref;
  await docRef.update({
    paymentStatus: status,
    ...(Object.keys(meta).length ? { paymentMeta: admin.firestore.FieldValue.arrayUnion(meta) } : {}),
    timeline: admin.firestore.FieldValue.arrayUnion({
      status,
      at: new Date().toISOString(),
      via: paymentMethod,
      ...(meta || {}),
    }),
    updatedAt: new Date(),
  });

  logger.info("Order updated", { paymentRef, paymentMethod, status });
}

/** ---------- STRIPE ---------- */
const STRIPE_SECRET = functions.config().stripe.secret;
const STRIPE_WEBHOOK_SECRET = functions.config().stripe.webhook_secret;

const stripe = STRIPE_SECRET
  ? new Stripe(STRIPE_SECRET, { apiVersion: "2024-04-10" }) // NOTE: Updated API version
  : (null as unknown as Stripe);

export const createStripeCheckout = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      if (!stripe) {
        res.status(500).json({ error: "Stripe not configured" });
        return;
      }

      const { items = [], totalAmount, currency = "usd" } = req.body || {};
      if (!totalAmount) {
        res.status(400).json({ error: "totalAmount required" });
        return;
      }
      const amountInMinor = Math.round(Number(totalAmount) * 100);

      const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
            price_data: {
              currency,
              product_data: { name: "Order Total" },
              unit_amount: amountInMinor,
            },
            quantity: 1,
        }],
        success_url: `${CORS_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CORS_ORIGIN}/checkout/cancel`,
      });

      res.status(200).json({ id: session.id, url: session.url });
    } catch (err: any) {
      logger.error("createStripeCheckout failed", err);
      res.status(500).json({ error: err?.message || "Stripe error" });
    }
  });
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    // ... (Your Stripe webhook logic here, unchanged)
});


/** ---------- PAYSTACK ---------- */
export const paystackWebhook = functions.https.onRequest(async (req, res) => {
    // ... (Your Paystack webhook logic here, unchanged)
});


/** ---------- FLUTTERWAVE ---------- */
export const flutterwaveWebhook = functions.https.onRequest(async (req, res) => {
    // ... (Your Flutterwave webhook logic here, unchanged)
});


/** ---------- NOWPAYMENTS (Crypto) ---------- */
export const nowpaymentsWebhook = functions.https.onRequest(async (req, res) => {
    // ... (Your NowPayments webhook logic here, unchanged)
});

