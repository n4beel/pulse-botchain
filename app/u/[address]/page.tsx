import Link from "next/link";
import { isAddress, type Address } from "viem";
import PageShell from "@/components/layout/PageShell";
import BentoDashboard from "@/components/pulse/BentoDashboard";
import Panel from "@/components/ui/Panel";

import PulseFooter from "@/components/pulse/PulseFooter";

interface UserProfileProps {
  params: Promise<{
    address: string;
  }>;
}

export default async function UserProfilePage({ params }: UserProfileProps) {
  const { address } = await params;

  if (!address || !isAddress(address, { strict: false })) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-16 space-y-6">
          <Panel className="text-center py-12 space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">
              That isn&apos;t an address.
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              The address &quot;{address}&quot; is not a valid 20-byte account address.
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

  return (
    <PageShell>
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--text-on-ground)] hover:text-white transition-colors"
        >
          <span>← Back to your streak</span>
        </Link>
      </div>
      <BentoDashboard viewAddress={address as Address} />
    </PageShell>
  );
}
