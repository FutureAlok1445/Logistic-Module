"use client";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="recovery-page">
      <RefreshCw size={36} />
      <h1>Let’s get you back.</h1>
      <p>This view could not load. Retry, or return to your workspace.</p>
      <div className="button-row">
        <button className="primary" onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className="secondary">
          Open workspace
        </Link>
      </div>
    </main>
  );
}
