import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import Panel from "@/components/ui/Panel";
import { footerLinks } from "@/lib/botchain/chain";

export default function PulseFooter() {
  const links = footerLinks();
  return (
    <Panel
      variant="subtle"
      className="md:col-span-12 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-mono"
    >
      <div>Pulse · On-chain daily habit marker</div>
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-mono">
        <BuiltOnBotChain className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline" />
        <span className="text-[var(--border-subtle)]" aria-hidden="true">
          ·
        </span>
        <a
          href={links.site}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline"
        >
          botchain.ai
        </a>
        <span className="text-[var(--border-subtle)]" aria-hidden="true">
          ·
        </span>
        <a
          href={links.explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline"
        >
          Explorer
        </a>
      </div>
    </Panel>
  );
}
