import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Every day at 6am Africa/Lagos create a revenue report and email it (pseudo)
export const dailyReport = functions.pubsub.schedule("0 6 * * *").timeZone("Africa/Lagos").onRun(async () => {
  const since = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24*60*60*1000));
  const snap = await db.collection("orders").where("createdAt", ">", since).get();
  let revenue = 0;
  snap.forEach(d => revenue += (d.data().total || 0));
  await db.collection("reports").add({ type: "daily_revenue", revenue, at: admin.firestore.FieldValue.serverTimestamp() });
  // TODO: email via SendGrid/MailerSend
});
