import Link from "next/link";
import { Compass } from "lucide-react";
export default function NotFound() {
  return (
    <main className="recovery-page">
      <Compass size={40} />
      <h1>A little off course.</h1>
      <p>
        This page isn’t part of your workspace. The address may have changed.
      </p>
      <div className="button-row">
        <Link href="/dashboard" className="primary">
          Open workspace
        </Link>
        <Link href="/help" className="secondary">
          Employee guide
        </Link>
      </div>
      <small>ELMS · IMS Learning Resources</small>
    </main>
  );
}
