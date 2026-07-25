"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  CircleDollarSign,
  Layers,
  ShoppingCart,
  Sparkles,
  Store,
  Workflow,
  Zap,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_LIST } from "@/lib/mock/marketplaces";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const FEATURES = [
  { icon: BarChart3, title: "Unified analytics", desc: "Every channel's revenue, orders, and profit in one real-time dashboard with drill-downs and comparisons." },
  { icon: ShoppingCart, title: "One order inbox", desc: "Fulfill, track, and reconcile orders from Amazon, Flipkart, Shopify and more — without tab-switching." },
  { icon: Boxes, title: "Central inventory", desc: "Sync stock across marketplaces instantly. Never oversell. Forecast demand before you run out." },
  { icon: Layers, title: "Master catalog", desc: "Manage listings, variants, and pricing once, publish everywhere with per-marketplace mapping." },
  { icon: Workflow, title: "Automation engine", desc: "Build no-code workflows: auto-reprice, route orders, notify your warehouse, update your CRM." },
  { icon: Sparkles, title: "AI copilot", desc: "Ask in plain English. Get pricing opportunities, demand forecasts, and generated listings instantly." },
];

const STATS = [
  { value: "17+", label: "Marketplaces" },
  { value: "$1.5B+", label: "GMV processed" },
  { value: "99.98%", label: "Sync uptime" },
  { value: "4.9/5", label: "Seller rating" },
];

const PRICING = [
  {
    name: "Pay as you go",
    price: "$0.01",
    period: "/order",
    desc: "2 months free, then just pay per order. No subscription, ever.",
    features: [
      "2 months free trial",
      "Unlimited marketplaces",
      "Unified dashboard",
      "Inventory sync",
      "$0.01 per order after trial",
      "Email support",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Premium",
    price: "$0.03",
    period: "/order",
    desc: "Everything in Pay as you go, plus advanced tools & AI.",
    inheritsFrom: "Pay as you go",
    features: [
      "Automation engine",
      "AI copilot",
      "Advanced analytics & reports",
      "Automatic repricing",
      "Demand forecasting",
      "Bulk listing & variant mapping",
      "Priority support",
      "$0.03 per order — no subscription",
    ],
    cta: "Upgrade to Premium",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "A dedicated agent runs your operation at very large volume.",
    inheritsFrom: "Premium",
    features: [
      "Dedicated managed agent",
      "Very large volume operations",
      "Premium ROI analysis & optimization",
      "Guaranteed ROI increment",
      "Custom automation workflows",
      "White-label & API access",
      "Dedicated CSM & onboarding",
      "99.9% uptime SLA",
      "SSO, roles & audit logs",
    ],
    cta: "Contact for pricing",
    highlight: false,
  },
];

export default function LandingPage() {
  const logos = [...MARKETPLACE_LIST, ...MARKETPLACE_LIST];
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle,#6366f1,transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.08 }}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.a
              variants={fadeUp}
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium shadow-sm"
            >
              <span className="flex size-1.5 rounded-full bg-success pulse-dot" />
              Now with AI-powered pricing & forecasting
              <ArrowRight className="size-3" />
            </motion.a>
            <motion.h1
              variants={fadeUp}
              className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl"
            >
              One Platform.
              <br />
              <span className="bg-gradient-to-r from-primary via-chart-6 to-chart-4 bg-clip-text text-transparent">
                Every Marketplace.
              </span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
            >
              ProSellerOS is the commerce operating system that unifies every
              marketplace and your own storefronts into one intelligent dashboard —
              so you can sell everywhere and manage it from one place.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button size="lg" asChild>
                <Link href="/login">
                  Start for free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/dashboard">Live demo</Link>
              </Button>
            </motion.div>
            <motion.p variants={fadeUp} className="mt-3 text-xs text-muted-foreground">
              No credit card required · 2 months free · No subscription
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mx-auto mt-14 max-w-5xl"
          >
            <HeroPreview />
          </motion.div>
        </div>
      </section>

      {/* Logo marquee */}
      <section id="marketplaces" className="border-y border-border bg-muted/20 py-10">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sell everywhere your customers are
        </p>
        <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max animate-marquee gap-10 px-5">
            {logos.map((m, i) => (
              <div key={`${m.id}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
                <MarketplaceLogo id={m.id} size={26} />
                <span className="text-sm font-medium text-muted-foreground">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-semibold tracking-tight sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-primary">Everything in one place</span>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            The operating system for omnichannel commerce
          </h2>
          <p className="mt-4 text-muted-foreground">
            Stop stitching together seller panels and spreadsheets. ProSellerOS
            replaces a dozen tools with one platform built for scale.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: (i % 3) * 0.05 }}
              className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30"
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Split highlight */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-8 lg:grid-cols-2 sm:p-12">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Zap className="size-3.5" /> Real-time sync
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Change once. Update everywhere.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Adjust a price, edit a listing, or fulfill an order and ProSellerOS
              propagates it across every connected channel in seconds. No more
              stock discrepancies, no more overselling.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Two-way sync with 17+ marketplaces",
                "Automatic repricing & inventory buffers",
                "Webhook-driven, sub-minute updates",
                "Full audit trail on every change",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Store, label: "Channels live", value: "7 / 12" },
              { icon: CircleDollarSign, label: "Settlements tracked", value: "$1.55M" },
              { icon: Boxes, label: "SKUs in sync", value: "5,830" },
              { icon: Workflow, label: "Automations run", value: "48.2K" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-background p-5">
                <c.icon className="size-5 text-primary" />
                <p className="mt-3 text-2xl font-semibold tabular-nums">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section id="customers" className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <div className="flex justify-center gap-1 text-warning">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i}>★</span>
          ))}
        </div>
        <blockquote className="mt-6 text-2xl font-medium tracking-tight sm:text-3xl">
          “We consolidated six tools into ProSellerOS and cut our ops time by 70%.
          It’s the first platform that actually feels built for multi-marketplace
          sellers.”
        </blockquote>
        <div className="mt-6 flex items-center justify-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-6 text-sm font-semibold text-white">
            RK
          </span>
          <div className="text-left">
            <p className="text-sm font-medium">Riya Kapoor</p>
            <p className="text-xs text-muted-foreground">COO, Aurelia Brands</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-primary">Pricing</span>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple, scalable pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            2 months free, then pay as you go. No subscriptions — only pay per order.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 items-center gap-6 lg:grid-cols-3">
          {PRICING.map((tier) => (
            <div
              key={tier.name}
              className={
                "relative flex flex-col rounded-2xl border p-7 transition-transform " +
                (tier.highlight
                  ? "z-10 border-primary/60 text-white shadow-2xl shadow-primary/30 ring-1 ring-primary/40 lg:scale-[1.06]"
                  : "border-border bg-card")
              }
              style={
                tier.highlight
                  ? { background: "linear-gradient(160deg,#4f46e5,#7c3aed 55%,#a855f7)" }
                  : undefined
              }
            >
              {tier.highlight && (
                <>
                  <div className="pointer-events-none absolute inset-0 grid-bg rounded-2xl opacity-20" />
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-md">
                    ★ Most popular
                  </span>
                </>
              )}
              <div className="relative flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{tier.name}</h3>
                  {tier.highlight && (
                    <Sparkles className="size-5 text-white/90" />
                  )}
                </div>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                  {tier.price !== "Custom" && (
                    <span
                      className={
                        "mb-1 text-sm " +
                        (tier.highlight ? "text-white/70" : "text-muted-foreground")
                      }
                    >
                      {tier.period}
                    </span>
                  )}
                </div>
                <p
                  className={
                    "mt-2 text-sm " +
                    (tier.highlight ? "text-white/80" : "text-muted-foreground")
                  }
                >
                  {tier.desc}
                </p>
                {tier.inheritsFrom && (
                  <p
                    className={
                      "mt-6 text-xs font-medium uppercase tracking-wide " +
                      (tier.highlight ? "text-white/70" : "text-muted-foreground")
                    }
                  >
                    Everything in {tier.inheritsFrom}, plus:
                  </p>
                )}
                <ul className={(tier.inheritsFrom ? "mt-3" : "mt-6") + " flex-1 space-y-3"}>
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check
                        className={
                          "size-4 shrink-0 " +
                          (tier.highlight ? "text-white" : "text-primary")
                        }
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={
                    "mt-7 " +
                    (tier.highlight
                      ? "bg-white text-primary hover:bg-white/90"
                      : "")
                  }
                  variant={tier.highlight ? "default" : "secondary"}
                  asChild
                >
                  <Link href="/login">{tier.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div
          className="relative overflow-hidden rounded-2xl px-8 py-16 text-center sm:px-16"
          style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed 55%,#a855f7)" }}
        >
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to run your entire business from one place?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/80">
              Join thousands of sellers scaling across every marketplace with
              ProSellerOS.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/login">
                  Get started free <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="bg-white/15 text-white hover:bg-white/25"
              >
                <Link href="/dashboard">Explore the demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
