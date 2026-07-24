import Link from "next/link";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <BrandLogo />
      <div className="space-y-2">
        <p className="text-6xl font-semibold tracking-tight">404</p>
        <p className="text-muted-foreground">
          We couldn&apos;t find the page you were looking for.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
