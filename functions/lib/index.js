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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowpaymentsWebhook = exports.flutterwaveWebhook = exports.paystackWebhook = exports.stripeWebhook = exports.createStripeCheckout = exports.createUserWithRole = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const stripe_1 = __importDefault(require("stripe"));
const crypto_1 = __importDefault(require("crypto"));
const cors_1 = __importDefault(require("cors"));
var adminUsers_1 = require("./adminUsers");
Object.defineProperty(exports, "createUserWithRole", { enumerable: true, get: function () { return adminUsers_1.createUserWithRole; } });
/** ---------- INIT ---------- */
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const cors = (0, cors_1.default)({ origin: CORS_ORIGIN });
async function updateOrderStatus(paymentRef, paymentMethod, status, meta = {}) {
    const snap = await db
        .collection("orders")
        .where("paymentRef", "==", paymentRef)
        .where("paymentMethod", "==", paymentMethod)
        .limit(1)
        .get();
    if (snap.empty) {
        firebase_functions_1.logger.warn("Order not found for paymentRef", { paymentRef, paymentMethod, status });
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
    firebase_functions_1.logger.info("Order updated", { paymentRef, paymentMethod, status });
}
/** ---------- STRIPE ---------- */
const STRIPE_SECRET = process.env.STRIPE_SECRET || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const stripe = STRIPE_SECRET
    ? new stripe_1.default(STRIPE_SECRET, { apiVersion: "2025-08-27.basil" })
    : null;
/**
 * Create a Stripe Checkout Session
 * Body: { items: [{name?, price?, quantity?}], totalAmount (in major units, e.g. 1000 = ₦1000?), currency="usd" }
 * Returns: { id, url }
 */
exports.createStripeCheckout = (0, https_1.onRequest)(async (req, res) => {
    await new Promise((resolve) => cors(req, res, resolve));
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
        // Convert to **smallest unit** for Stripe (kobo/cent)
        // If your totalAmount is in NGN major units, multiply by 100.
        // Adjust for your currency as needed.
        const amountInMinor = Math.round(Number(totalAmount) * 100);
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: items.length > 0
                ? items.map((it) => ({
                    price_data: {
                        currency,
                        product_data: { name: it.name || "Item" },
                        unit_amount: Math.round(Number(it.price) * 100),
                    },
                    quantity: it.quantity || 1,
                }))
                : [
                    {
                        price_data: {
                            currency,
                            product_data: { name: "Order Total" },
                            unit_amount: amountInMinor,
                        },
                        quantity: 1,
                    },
                ],
            success_url: `${CORS_ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${CORS_ORIGIN}/checkout/cancel`,
        });
        res.status(200).json({ id: session.id, url: session.url });
    }
    catch (err) {
        firebase_functions_1.logger.error("createStripeCheckout failed", err);
        res.status(500).json({ error: err?.message || "Stripe error" });
    }
});
/**
 * Stripe Webhook
 * Handles: checkout.session.completed, charge.refunded, payment_intent.canceled
 */
exports.stripeWebhook = (0, https_1.onRequest)({ maxInstances: 1, cors: CORS_ORIGIN }, async (req, res) => {
    try {
        const sig = req.headers["stripe-signature"];
        if (!stripe || !STRIPE_WEBHOOK_SECRET) {
            res.status(500).send("Stripe not configured");
            return;
        }
        let event;
        try {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
        }
        catch (err) {
            firebase_functions_1.logger.error("Stripe signature verification failed", err);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                // Use session.id as our paymentRef
                await updateOrderStatus(session.id, "stripe", "paid", { providerEvent: event.type });
                break;
            }
            case "charge.refunded": {
                const charge = event.data.object;
                const paymentIntent = charge.payment_intent;
                await updateOrderStatus(paymentIntent, "stripe", "refunded", { providerEvent: event.type });
                break;
            }
            case "payment_intent.canceled": {
                const pi = event.data.object;
                await updateOrderStatus(pi.id, "stripe", "cancelled", { providerEvent: event.type });
                break;
            }
            default:
                firebase_functions_1.logger.info("Unhandled Stripe event", { type: event.type });
        }
        res.status(200).send("ok");
    }
    catch (err) {
        firebase_functions_1.logger.error("stripeWebhook error", err);
        res.status(500).send("internal error");
    }
});
/** ---------- PAYSTACK ---------- */
/**
 * Paystack sends SHA512 signature via `x-paystack-signature`
 * Validate using your PAYSTACK_SECRET_KEY
 * Paid:   event: "charge.success"
 * Refund: event: "refund.processed"
 * Failed: event: "charge.failed"
 */
exports.paystackWebhook = (0, https_1.onRequest)({ maxInstances: 1, cors: CORS_ORIGIN }, async (req, res) => {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY || "";
        if (!secret) {
            res.status(500).send("Paystack not configured");
            return;
        }
        const signature = req.headers["x-paystack-signature"];
        const hash = crypto_1.default.createHmac("sha512", secret).update(req.rawBody).digest("hex");
        if (hash !== signature) {
            firebase_functions_1.logger.warn("Invalid Paystack signature");
            res.status(401).send("invalid signature");
            return;
        }
        const body = req.body;
        const event = body?.event;
        const ref = body?.data?.reference || body?.data?.ref || "";
        if (!ref) {
            firebase_functions_1.logger.warn("Paystack missing reference");
            res.status(200).send("ok");
            return;
        }
        if (event === "charge.success") {
            await updateOrderStatus(ref, "paystack", "paid", { providerEvent: event });
        }
        else if (event === "refund.processed") {
            await updateOrderStatus(ref, "paystack", "refunded", { providerEvent: event });
        }
        else if (event === "charge.failed") {
            await updateOrderStatus(ref, "paystack", "cancelled", { providerEvent: event });
        }
        else {
            firebase_functions_1.logger.info("Unhandled Paystack event", { event });
        }
        res.status(200).send("ok");
    }
    catch (err) {
        firebase_functions_1.logger.error("paystackWebhook error", err);
        res.status(500).send("internal error");
    }
});
/** ---------- FLUTTERWAVE ---------- */
/**
 * Flutterwave sends `verif-hash` header you configure in dashboard.
 * Success charge: event="charge.completed" and data.status="successful"
 * Refund: event="refund.completed"
 * Failed: event="charge.failed"
 */
exports.flutterwaveWebhook = (0, https_1.onRequest)({ maxInstances: 1, cors: CORS_ORIGIN }, async (req, res) => {
    try {
        const flwHash = process.env.FLW_SECRET_HASH || "";
        const signature = req.headers["verif-hash"] || req.headers["verif_hash"];
        if (!flwHash || !signature || signature !== flwHash) {
            firebase_functions_1.logger.warn("Invalid Flutterwave signature/hash");
            res.status(401).send("invalid signature");
            return;
        }
        const { event, data } = req.body || {};
        const txRef = data?.tx_ref || data?.txRef || "";
        if (!txRef) {
            firebase_functions_1.logger.warn("Flutterwave missing tx_ref");
            res.status(200).send("ok");
            return;
        }
        if (event === "charge.completed" && data?.status === "successful") {
            await updateOrderStatus(txRef, "flutterwave", "paid", { providerEvent: event });
        }
        else if (event === "refund.completed") {
            await updateOrderStatus(txRef, "flutterwave", "refunded", { providerEvent: event });
        }
        else if (event === "charge.failed") {
            await updateOrderStatus(txRef, "flutterwave", "cancelled", { providerEvent: event });
        }
        else {
            firebase_functions_1.logger.info("Unhandled Flutterwave event", { event, status: data?.status });
        }
        res.status(200).send("ok");
    }
    catch (err) {
        firebase_functions_1.logger.error("flutterwaveWebhook error", err);
        res.status(500).send("internal error");
    }
});
/** ---------- NOWPAYMENTS (Crypto) ---------- */
/**
 * NOWPayments IPN signs body with HMAC SHA-512 in header `x-nowpayments-sig`
 * Paid:     payment_status === "finished"
 * Refunded: payment_status === "refunded"
 * Failed:   payment_status === "failed" | "expired"
 */
exports.nowpaymentsWebhook = (0, https_1.onRequest)({ maxInstances: 1, cors: CORS_ORIGIN }, async (req, res) => {
    try {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET || "";
        if (!secret) {
            res.status(500).send("NOWPayments not configured");
            return;
        }
        const signature = req.headers["x-nowpayments-sig"];
        const expected = crypto_1.default.createHmac("sha512", secret).update(req.rawBody).digest("hex");
        if (!signature || expected !== signature) {
            firebase_functions_1.logger.warn("Invalid NOWPayments signature");
            res.status(401).send("invalid signature");
            return;
        }
        const { payment_status, payment_id } = req.body || {};
        if (!payment_id) {
            firebase_functions_1.logger.warn("NOWPayments missing payment_id");
            res.status(200).send("ok");
            return;
        }
        if (payment_status === "finished") {
            await updateOrderStatus(payment_id, "crypto", "paid", { providerEvent: payment_status });
        }
        else if (payment_status === "refunded") {
            await updateOrderStatus(payment_id, "crypto", "refunded", { providerEvent: payment_status });
        }
        else if (payment_status === "failed" || payment_status === "expired") {
            await updateOrderStatus(payment_id, "crypto", "cancelled", { providerEvent: payment_status });
        }
        else {
            firebase_functions_1.logger.info("Unhandled NOWPayments status", { payment_status });
        }
        res.status(200).send("ok");
    }
    catch (err) {
        firebase_functions_1.logger.error("nowpaymentsWebhook error", err);
        res.status(500).send("internal error");
    }
});
