"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      description="An unexpected error occurred while loading this view. You can try again."
      action={
        <Button size="sm" onClick={reset}>
          Try again
        </Button>
      }
      className="mt-10"
    />
  );
}
