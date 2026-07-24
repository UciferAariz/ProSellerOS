import Link from "next/link";
import { BrandLogo } from "@/components/brand";

const COLUMNS = [
  {
    title: "Product",
    links: ["Dashboard", "Orders", "Inventory", "Analytics", "Automation", "AI Assistant"],
  },
  {
    title: "Marketplaces",
    links: ["Amazon", "Flipkart", "Shopify", "Meesho", "Myntra", "eBay"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Blog", "Customers", "Contact"],
  },
  {
    title: "Resources",
    links: ["Docs", "API Reference", "Status", "Security", "Changelog"],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <BrandLogo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The commerce operating system for omnichannel brands. One platform,
              every marketplace.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-sm font-medium">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © 2026 ProSellerOS, Inc. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
