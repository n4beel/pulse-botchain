import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import PulseFooter from "@/components/pulse/PulseFooter";

export default function NotFound() {
  return (
    <PageShell>
      <div className="max-w-md mx-auto py-16 space-y-6">
        <Panel className="text-center py-12 space-y-4">
          <div className="text-4xl">404</div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
            Page not found
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            The page you are looking for does not exist on Pulse.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 text-xs font-bold font-mono rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent)]/90 transition-colors"
            >
              ← Back to your streak
            </Link>
          </div>
        </Panel>
        <PulseFooter />
      </div>
    </PageShell>
  );
}
