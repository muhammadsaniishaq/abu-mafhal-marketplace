 "use client";
import { db } from "./firebase";
import {
  collection, doc, query, where,
  getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  orderBy, limit, serverTimestamp
} from "firebase/firestore";

export const fx = {
  serverTimestamp,
  col: collection,
  doc,
  q: query,
  where,
  getDoc, getDocs,
  addDoc, setDoc, updateDoc, deleteDoc,
  orderBy, limit,
  db
};
