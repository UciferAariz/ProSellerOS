"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import { MARKETPLACE_LIST } from "@/lib/mock/marketplaces";
import { DEMO_USER } from "@/lib/mock/user";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(DEMO_USER.email);
  const [password, setPassword] = useState("demo1234");

  function signIn(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("pso_authed", "1");
    }
    setTimeout(() => router.push("/dashboard"), 700);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="inline-flex">
          <BrandLogo />
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm"
          >
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your ProSellerOS workspace.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => signIn()}>
                <GoogleIcon /> Google
              </Button>
              <Button variant="secondary" onClick={() => signIn()}>
                <GithubIcon /> GitHub
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with email
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={signIn} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Password</label>
                  <Link href="#" className="text-xs text-primary hover:underline">
                    Forgot?
                  </Link>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Demo mode:</span> click
              any button above to explore the full product with sample data.
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to ProSellerOS?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(150deg,#4f46e5,#7c3aed 50%,#a855f7)" }}
        />
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight">
            One platform to run every marketplace and storefront.
          </h2>
          <ul className="mt-8 space-y-3">
            {[
              "Unified dashboard across 17+ channels",
              "Real-time inventory & order sync",
              "AI-powered pricing and forecasting",
              "Automations that eliminate busywork",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/90">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                  <Check className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            {MARKETPLACE_LIST.slice(0, 8).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur"
              >
                <MarketplaceLogo id={m.id} size={18} />
                <span className="text-xs font-medium">{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.9 2.2 2.7 6.4 2.7 11.5S6.9 20.8 12 20.8c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.5H12z"/>
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.48v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.36 9.36 0 015 0c1.9-1.33 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.8-4.58 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.48A10.02 10.02 0 0022 12.26C22 6.58 17.52 2 12 2z"/>
    </svg>
  );
}
