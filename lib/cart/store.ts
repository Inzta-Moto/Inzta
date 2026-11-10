'use client';

import { useSyncExternalStore } from 'react';
import { emptyCart, parseCart, serializeCart } from '@/lib/cart/cart-core';
import { CART_STORAGE_KEY, type CartState } from '@/lib/cart/types';

// F-030 client store over localStorage. The server snapshot is always the empty cart, so the server HTML is the same
// for everyone (ISR) and hydration matches; the stored cart appears right after hydration. Storage that throws
// (private mode, blocked site data, quota) leaves the cart working in memory for this page view.

const SERVER: CartState = emptyCart();
let state: CartState = SERVER;
let loaded = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    state = parseCart(storage()?.getItem(CART_STORAGE_KEY));
  } catch {
    state = emptyCart();
  }
}

function emit() {
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  // Another tab changed the cart (E8); a cleared storage (key null) empties it too.
  if (e.key !== CART_STORAGE_KEY && e.key !== null) return;
  state = parseCart(e.newValue);
  emit();
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): CartState {
  load();
  return state;
}

const getServerSnapshot = () => SERVER;

export function readCart(): CartState {
  return getSnapshot();
}

// Applies a pure update from cart-core; identical state means nothing to write or announce.
export function updateCart(fn: (s: CartState) => CartState): CartState {
  load();
  const next = fn(state);
  if (next === state) return state;
  state = next;
  try {
    storage()?.setItem(CART_STORAGE_KEY, serializeCart(next));
  } catch {
    // Quota or blocked storage: keep the in-memory cart for this page view.
  }
  emit();
  return next;
}

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// False during the server render and hydration, true after; lets the UI show a skeleton instead of "empty" before the
// stored cart is read.
const noop = () => () => {};
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
