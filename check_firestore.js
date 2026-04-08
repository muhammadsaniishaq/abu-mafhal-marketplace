const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBmNWlzQjWrYWe7kftqEB3qdkXcXTGw4A",
  authDomain: "abu-mafhal-marketplace.firebaseapp.com",
  projectId: "abu-mafhal-marketplace",
  storageBucket: "abu-mafhal-marketplace.appspot.com",
  messagingSenderId: "3834...",
  appId: "1:3834..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
  try {
    const q = query(collection(db, "orders"), limit(5));
    const snapshot = await getDocs(q);
    console.log('--- FIRESTORE ORDERS ---');
    console.log('Count:', snapshot.size);
    snapshot.forEach(doc => {
      console.log('Order ID:', doc.id, 'Data:', JSON.stringify(doc.data()).slice(0, 100));
    });
  } catch (error) {
    console.error('Firestore Error:', error);
  }
  process.exit(0);
}

checkOrders();
