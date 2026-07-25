"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/mock/products";

export interface ProductFormValues {
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
}

const EMPTY: ProductFormValues = {
  name: "",
  sku: "",
  category: CATEGORIES[0],
  price: 0,
  stock: 0,
};

/**
 * Shared create/edit product dialog. Mock-only: on submit it fires `onSubmit`
 * (so a parent can optimistically update local state) and a success toast.
 * Reused by the Dashboard "Add product" action and the Products page.
 */
export function ProductFormDialog({
  open,
  onOpenChange,
  mode = "create",
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  initial?: Partial<ProductFormValues>;
  onSubmit?: (values: ProductFormValues) => void;
}) {
  const [values, setValues] = React.useState<ProductFormValues>({
    ...EMPTY,
    ...initial,
  });

  // Reset the form whenever the dialog is (re)opened for a given record.
  React.useEffect(() => {
    if (open) setValues({ ...EMPTY, ...initial });
  }, [open, initial]);

  const set = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const valid = values.name.trim().length > 1 && values.price > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit?.(values);
    toast.success(
      mode === "create"
        ? `Product "${values.name}" created`
        : `Product "${values.name}" updated`,
      {
        description: `${values.category} · $${values.price.toFixed(2)} · ${values.stock} in stock`,
      }
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add product" : "Edit product"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new product to add to your catalog across connected channels."
              : "Update this product's details."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="pf-name" className="text-sm font-medium">
              Product name
            </label>
            <Input
              id="pf-name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Nova Ultra Wireless Earbuds"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="pf-sku" className="text-sm font-medium">
                SKU
              </label>
              <Input
                id="pf-sku"
                value={values.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="ELE-NO-2261"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pf-cat" className="text-sm font-medium">
                Category
              </label>
              <Select
                id="pf-cat"
                value={values.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="pf-price" className="text-sm font-medium">
                Price (USD)
              </label>
              <Input
                id="pf-price"
                type="number"
                min={0}
                step="0.01"
                value={values.price || ""}
                onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pf-stock" className="text-sm font-medium">
                Initial stock
              </label>
              <Input
                id="pf-stock"
                type="number"
                min={0}
                step="1"
                value={values.stock || ""}
                onChange={(e) => set("stock", parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              {mode === "create" ? "Create product" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
