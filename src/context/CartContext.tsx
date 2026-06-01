/**
 * CartContext.tsx — Global cart state
 *
 * Wrap your app (or UserDashboardScreen) with <CartProvider>.
 * Use useCart() anywhere inside to read/mutate the cart.
 *
 * Rules:
 *  • Cart is single-restaurant — adding from a different restaurant prompts to clear first.
 *  • Persisted to AsyncStorage key "tp_cart_v1".
 */

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface SelectedAddon {
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  itemId: string;
  name: string;
  price: number;           // base + variant price (excl. addons)
  quantity: number;
  isVeg: boolean;
  category?: string;
  variantName?: string;
  addons?: SelectedAddon[]; // selected addons for this line item
  addonTotal?: number;      // sum of addon prices × qty
}

interface CartState {
  restaurantId: string | null;
  restaurantName: string;
  items: CartItem[];
}

interface CartContextValue {
  cart: CartState;
  itemCount: number;
  subtotal: number;
  /** Add or increment. Returns false if restaurant mismatch and user cancelled. */
  addItem: (restaurantId: string, restaurantName: string, item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  getQty: (itemId: string) => number;
}

// ── Storage helpers ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'tp_cart_v1';

async function loadCart(): Promise<CartState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { restaurantId: null, restaurantName: '', items: [] };
}

async function saveCart(state: CartState): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ── Context ────────────────────────────────────────────────────────────────────
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({ restaurantId: null, restaurantName: '', items: [] });
  const initialized = useRef(false);

  // Hydrate from storage on mount
  useEffect(() => {
    loadCart().then(saved => {
      setCart(saved);
      initialized.current = true;
    });
  }, []);

  // Persist on every change (after first hydration)
  useEffect(() => {
    if (initialized.current) saveCart(cart);
  }, [cart]);

  const addItem = useCallback((restaurantId: string, restaurantName: string, item: Omit<CartItem, 'quantity'>) => {
    setCart(prev => {
      // Different restaurant — ask user
      if (prev.restaurantId && prev.restaurantId !== restaurantId && prev.items.length > 0) {
        Alert.alert(
          'Start new cart?',
          `Your cart has items from ${prev.restaurantName}. Remove them to add from ${restaurantName}?`,
          [
            { text: 'Keep current', style: 'cancel' },
            {
              text: 'Start new', style: 'destructive', onPress: () => {
                setCart({ restaurantId, restaurantName, items: [{ ...item, quantity: 1 }] });
              },
            },
          ],
        );
        return prev; // optimistic: keep old state until user confirms
      }

      const existing = prev.items.find(i => i.itemId === item.itemId);
      if (existing) {
        return {
          ...prev,
          restaurantId, restaurantName,
          items: prev.items.map(i => i.itemId === item.itemId ? { ...i, quantity: i.quantity + 1 } : i),
        };
      }
      return { restaurantId, restaurantName, items: [...prev.items, { ...item, quantity: 1 }] };
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart(prev => {
      const items = prev.items
        .map(i => i.itemId === itemId ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      return { ...prev, items };
    });
  }, []);

  const setQty = useCallback((itemId: string, qty: number) => {
    setCart(prev => {
      if (qty <= 0) return { ...prev, items: prev.items.filter(i => i.itemId !== itemId) };
      return { ...prev, items: prev.items.map(i => i.itemId === itemId ? { ...i, quantity: qty } : i) };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({ restaurantId: null, restaurantName: '', items: [] });
  }, []);

  const getQty = useCallback((itemId: string) => {
    return cart.items.find(i => i.itemId === itemId)?.quantity ?? 0;
  }, [cart.items]);

  const itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal  = cart.items.reduce((s, i) => s + (i.price + (i.addonTotal ?? 0)) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, itemCount, subtotal, addItem, removeItem, setQty, clearCart, getQty }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
