import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const createPaymentRecord = async (paymentData) => {
  try {
    const paymentRef = await addDoc(collection(db, 'payments'), {
      ...paymentData,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    return paymentRef.id;
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw error;
  }
};

export const updatePaymentStatus = async (paymentId, status, reference) => {
  try {
    await updateDoc(doc(db, 'payments', paymentId), {
      status,
      reference,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    throw error;
  }
};

export const verifyPayment = async (reference) => {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer sk_test_your_secret_key` // Replace with your secret key
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};