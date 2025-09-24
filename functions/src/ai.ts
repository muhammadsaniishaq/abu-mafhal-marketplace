import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
const db = admin.firestore();

export const buyerRecommendations = functions.https.onCall(async (data, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  const uid = ctx.auth.uid;

  const orders = await db.collection('orders').where('buyerId', '==', uid).limit(10).get();
  const purchased = orders.docs.flatMap(d => d.data().items?.map((i: any) => i.title) ?? []);
  const products = await db.collection('products').where('isPublished', '==', true).limit(100).get();
  const candidates = products.docs.map(d => ({ id: d.id, title: d.data().title, category: d.data().category }));

  const prompt = `Given user history: ${JSON.stringify(purchased)}, and candidates: ${JSON.stringify(candidates)}, recommend 4 product IDs as JSON array only.`;
  const res = await model.generateContent(prompt);
  const text = res.response.text().replace(/```json|```/g, '');
  return JSON.parse(text);
});

export const vendorCopywriter = functions.https.onCall(async (data, ctx) => {
  if (!ctx.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');
  if (ctx.auth.token.role !== 'vendor') throw new functions.https.HttpsError('permission-denied', 'Vendors only');
  const { title, bullets } = data;
  const res = await model.generateContent(`Write an SEO product description for ${title}. Points: ${bullets?.join(', ')}`);
  return { description: res.response.text() };
});
