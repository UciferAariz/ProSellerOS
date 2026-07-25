"use client";

import * as React from "react";
import { PRODUCTS, Product } from "./products";
import { ORDERS, Order } from "./orders";
import {
  PURCHASE_ORDERS,
  PurchaseOrder,
  STOCK_MOVEMENTS,
  StockMovement,
} from "./inventory";
import { PAYOUTS, Payout } from "./finance";
import { CAMPAIGNS, Campaign } from "./marketing";
import { RULES, Rule, RULE_RUNS, RuleRun } from "./automation";

/**
 * Lightweight observable store for mock CRUD. The demo has no backend for the
 * catalog/orders surface, so mutations (add/edit/delete/fulfill) live in memory
 * and are shared across the list and detail routes via a module-level singleton
 * + `useSyncExternalStore`. Seeded from the deterministic mock arrays, so the
 * first server and client renders match (hydration-safe).
 */
export interface EntityStore<T extends { id: string }> {
  getAll: () => T[];
  get: (id: string) => T | undefined;
  set: (next: T[]) => void;
  add: (item: T) => void;
  update: (id: string, patch: Partial<T> | ((prev: T) => T)) => void;
  remove: (ids: string[]) => void;
  subscribe: (listener: () => void) => () => void;
}

function createEntityStore<T extends { id: string }>(
  initial: T[]
): EntityStore<T> {
  let data = initial;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    getAll: () => data,
    get: (id) => data.find((d) => d.id === id),
    set: (next) => {
      data = next;
      emit();
    },
    add: (item) => {
      data = [item, ...data];
      emit();
    },
    update: (id, patch) => {
      data = data.map((d) =>
        d.id === id
          ? typeof patch === "function"
            ? (patch as (prev: T) => T)(d)
            : { ...d, ...patch }
          : d
      );
      emit();
    },
    remove: (ids) => {
      const drop = new Set(ids);
      data = data.filter((d) => !drop.has(d.id));
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const productStore = createEntityStore<Product>(PRODUCTS);
export const orderStore = createEntityStore<Order>(ORDERS);

// Module stores. Inventory positions and the customer book are *derived* from
// products/orders rather than stored, so they stay correct when those change;
// only entities the operator edits directly get a store of their own.
export const purchaseOrderStore = createEntityStore<PurchaseOrder>(PURCHASE_ORDERS);
export const movementStore = createEntityStore<StockMovement>(STOCK_MOVEMENTS);
export const payoutStore = createEntityStore<Payout>(PAYOUTS);
export const campaignStore = createEntityStore<Campaign>(CAMPAIGNS);
export const ruleStore = createEntityStore<Rule>(RULES);
export const ruleRunStore = createEntityStore<RuleRun>(RULE_RUNS);

/** Subscribe to the full list of an entity store (re-renders on any mutation). */
export function useEntityList<T extends { id: string }>(
  store: EntityStore<T>
): T[] {
  return React.useSyncExternalStore(
    store.subscribe,
    store.getAll,
    store.getAll
  );
}

/** Subscribe to a single record by id. */
export function useEntity<T extends { id: string }>(
  store: EntityStore<T>,
  id: string
): T | undefined {
  const list = useEntityList(store);
  return React.useMemo(() => list.find((d) => d.id === id), [list, id]);
}
