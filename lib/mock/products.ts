import { makeRng } from "./rng";
import { MarketplaceId } from "./marketplaces";

export interface ProductListing {
  marketplace: MarketplaceId;
  status: "live" | "pending" | "rejected" | "inactive";
  price: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  image: string; // gradient css
  price: number;
  cost: number;
  stock: number;
  reorderPoint: number;
  status: "active" | "draft" | "archived";
  rating: number;
  reviews: number;
  units30d: number;
  revenue30d: number;
  trend: number; // % change
  margin: number; // %
  listings: ProductListing[];
  createdAt: string;
  tags: string[];
}

export const CATEGORIES = [
  "Apparel", "Footwear", "Electronics", "Home & Kitchen", "Beauty",
  "Accessories", "Sports", "Toys", "Grocery", "Health",
];
const BRANDS = ["Aurelia", "Nordheim", "Vireo", "Lumen", "Kavi", "Terra", "Bolt", "Nova", "Meridian", "Wildr"];
const ADJ = ["Premium", "Classic", "Eco", "Pro", "Ultra", "Signature", "Everyday", "Studio", "Active", "Luxe"];
const NOUN: Record<string, string[]> = {
  Apparel: ["Cotton Tee", "Linen Shirt", "Hoodie", "Denim Jacket", "Joggers", "Kurta"],
  Footwear: ["Running Shoes", "Leather Loafers", "Sneakers", "Sandals", "Boots"],
  Electronics: ["Wireless Earbuds", "Smartwatch", "Power Bank", "USB-C Hub", "Bluetooth Speaker"],
  "Home & Kitchen": ["Ceramic Mug Set", "Cast Iron Pan", "Bedsheet Set", "LED Lamp", "Storage Box"],
  Beauty: ["Vitamin C Serum", "Matte Lipstick", "Face Wash", "Hair Oil", "Sunscreen SPF50"],
  Accessories: ["Leather Wallet", "Canvas Backpack", "Sunglasses", "Watch Strap", "Tote Bag"],
  Sports: ["Yoga Mat", "Dumbbell Set", "Resistance Bands", "Cricket Bat", "Football"],
  Toys: ["Building Blocks", "RC Car", "Plush Bear", "Puzzle 1000pc", "Board Game"],
  Grocery: ["Organic Honey", "Cold Brew Coffee", "Trail Mix", "Green Tea", "Olive Oil"],
  Health: ["Whey Protein", "Multivitamin", "Omega-3", "Electrolyte Mix", "Sleep Gummies"],
};
const GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#10b981,#22d3ee)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#14b8a6,#84cc16)",
  "linear-gradient(135deg,#f97316,#eab308)",
  "linear-gradient(135deg,#8b5cf6,#d946ef)",
];
const ALL_MARKETS: MarketplaceId[] = ["amazon", "flipkart", "shopify", "meesho", "myntra", "woocommerce", "ebay"];

function generateProducts(): Product[] {
  const rng = makeRng(77123);
  const products: Product[] = [];
  for (let i = 0; i < 64; i++) {
    const category = rng.pick(CATEGORIES);
    const noun = rng.pick(NOUN[category]);
    const brand = rng.pick(BRANDS);
    const name = `${brand} ${rng.pick(ADJ)} ${noun}`;
    const price = rng.int(8, 240) + 0.99;
    const cost = +(price * rng.float(0.35, 0.62)).toFixed(2);
    const stock = rng.bool(0.12) ? rng.int(0, 8) : rng.int(20, 620);
    const units30d = rng.int(20, 1400);
    const trend = +rng.float(-32, 48).toFixed(1);
    const numListings = rng.int(2, 6);
    const markets = rng.shuffle([...ALL_MARKETS]).slice(0, numListings);
    const listings: ProductListing[] = markets.map((m) => ({
      marketplace: m,
      status: rng.pick(["live", "live", "live", "pending", "inactive"] as const),
      price: +(price * rng.float(0.96, 1.08)).toFixed(2),
    }));
    const margin = +(((price - cost) / price) * 100).toFixed(1);
    products.push({
      id: `prod_${1000 + i}`,
      sku: `${category.slice(0, 3).toUpperCase()}-${brand.slice(0, 2).toUpperCase()}-${2200 + i}`,
      name,
      category,
      brand,
      image: GRADIENTS[i % GRADIENTS.length],
      price: +price.toFixed(2),
      cost,
      stock,
      reorderPoint: rng.int(15, 40),
      status: rng.pick(["active", "active", "active", "active", "draft", "archived"] as const),
      rating: +rng.float(3.5, 5).toFixed(1),
      reviews: rng.int(4, 3800),
      units30d,
      revenue30d: +(units30d * price).toFixed(0),
      trend,
      margin,
      listings,
      createdAt: new Date(2025, rng.int(0, 11), rng.int(1, 28)).toISOString(),
      tags: rng.shuffle(["bestseller", "new", "clearance", "seasonal", "featured"]).slice(0, rng.int(0, 2)),
    });
  }
  return products;
}

export const PRODUCTS: Product[] = generateProducts();

export const TOP_PRODUCTS = [...PRODUCTS]
  .sort((a, b) => b.revenue30d - a.revenue30d)
  .slice(0, 6);

export const LOW_STOCK = PRODUCTS.filter(
  (p) => p.stock <= p.reorderPoint && p.status === "active"
).slice(0, 6);

export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}
