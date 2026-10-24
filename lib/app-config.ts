/**
 * The per-project identity. This and `lib/botchain/abi.ts` are the only two template files each of
 * the fifteen projects is expected to rewrite.
 */
export const app = {
  /** Product name, as shown to a user. */
  name: "Pulse",
  /** One line, used as the meta description and under the page title. */
  tagline: "Check in once a day. Keep the streak.",
  /** Production URL. Used for wallet-connect metadata and Open Graph. */
  url: "https://pulse.botchain-apps.dev",
  /**
   * Accent colour. Written into `--accent` at the document root, so every component that reads
   * `var(--accent)` picks it up without edits.
   */
  accent: "#D7FF3F",
  /**
   * The single transaction this app exists to make, in the user's words.
   */
  theTx: "Check in for today",
} as const;
