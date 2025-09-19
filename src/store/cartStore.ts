"use client";
import { create } from "zustand";
import type { CartItem } from "@/lib/types";

type CartState = {
  items: CartItem[];
  add: (it: CartItem) => void;
  remove: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clear: () => void;
  total: () => number;
};

export const useCart = create<CartState>((set, get) => ({
  items: [],
  add: (it) => set((s) => {
    const found = s.items.find((x) => x.productId === it.productId);
    if (found) return { items: s.items.map((x) => x.productId === it.productId ? { ...x, qty: x.qty + it.qty } : x) };
    return { items: [...s.items, it] };
  }),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.productId !== id) })),
  updateQty: (id, qty) => set((s) => ({ items: s.items.map((x) => x.productId === id ? { ...x, qty } : x) })),
  clear: () => set({ items: [] }),
  total: () => get().items.reduce((sum, it) => sum + it.price * it.qty, 0),
}));
