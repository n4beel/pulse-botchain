"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import type { Address, Hex } from "viem";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import TxStatus, { type TxStage } from "@/components/ui/TxStatus";
import { useToast } from "@/components/ui/Toast";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import ConnectButton from "@/components/ui/ConnectButton";
import { pulseAbi } from "@/lib/botchain/abi";
import { isBotChainId } from "@/lib/botchain/chain";
import { getDeployment, isDeployed } from "@/lib/botchain/deployment";
import { describeError } from "@/lib/errors";
import { getLogsChunked } from "@/lib/logs";
import {
  buildHeatmap,
  deriveView,
  formatAddress,
  formatCountdown,
  leaderboard,
  nextMidnight,
  utcDay,
  type PulseLog,
  type PulseStatus,
} from "@/lib/pulse";

interface BentoDashboardProps {
  viewAddress?: Address;
}

export default function BentoDashboard({ viewAddress }: BentoDashboardProps) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address: connectedAddress, isConnected } = useAccount();
  const { toast } = useToast();

  const isContractReady = isBotChainId(chainId) && isDeployed(chainId);
  const deployment = isContractReady ? getDeployment(chainId) : undefined;
  const contractAddress = deployment?.address;
  const deployBlock = deployment ? BigInt(deployment.deployBlock) : 1n;

  // Target wallet: if viewAddress is supplied, inspect that; otherwise connected wallet
  const targetAddress = viewAddress || connectedAddress;
  const isReadOnly = Boolean(viewAddress);

  // Live timer ticking every second
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Contract Reads
  const {
    data: rawStatus,
    refetch: refetchStatus,
  } = useReadContract({
    address: contractAddress,
    abi: pulseAbi,
    functionName: "statusOf",
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: Boolean(contractAddress && targetAddress),
    },
  });

  const {
    data: totalsData,
    refetch: refetchTotals,
  } = useReadContract({
    address: contractAddress,
    abi: pulseAbi,
    functionName: "totals",
    query: {
      enabled: Boolean(contractAddress),
      refetchInterval: 15_000,
    },
  });

  // Convert rawStatus tuple to typed PulseStatus
  const status: PulseStatus = useMemo(() => {
    if (!rawStatus) {
      return {
        current: 0,
        lastStreak: 0,
        best: 0,
        total: 0,
        lastDay: 0n,
        nextCheckInAt: 0n,
        checkedInToday: false,
        streakAlive: false,
      };
    }
    return {
      current: Number(rawStatus.current),
      lastStreak: Number(rawStatus.lastStreak),
      best: Number(rawStatus.best),
      total: Number(rawStatus.total),
      lastDay: BigInt(rawStatus.lastDay),
      nextCheckInAt: BigInt(rawStatus.nextCheckInAt),
      checkedInToday: Boolean(rawStatus.checkedInToday),
      streakAlive: Boolean(rawStatus.streakAlive),
    };
  }, [rawStatus]);

  // Logs for heatmap and leaderboard
  const [allLogs, setAllLogs] = useState<PulseLog[]>([]);
  const [logsComplete, setLogsComplete] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const clientRef = useRef(publicClient);
  clientRef.current = publicClient;

  // Fetch initial logs
  useEffect(() => {
    const targetContract = contractAddress;
    const client = clientRef.current;
    if (!client || !targetContract) return;
    let active = true;

    async function loadLogs() {
      const activeClient = clientRef.current;
      if (!activeClient || !targetContract) return;
      setLogsLoading(true);
      try {
        const checkedInEvent = pulseAbi.find(
          (item) => item.type === "event" && item.name === "CheckedIn",
        );
        if (!checkedInEvent) return;

        const res = await getLogsChunked({
          client: activeClient as any,
          address: targetContract,
          event: checkedInEvent as any,
          fromBlock: deployBlock,
          chunk: 20_000n,
          maxChunks: 100,
        });

        if (!active) return;
        const parsed: PulseLog[] = res.logs.map((l: any) => ({
          user: l.args.user as Address,
          day: BigInt(l.args.day),
          streak: Number(l.args.streak),
          best: Number(l.args.best),
          brokenFrom: Number(l.args.brokenFrom),
          blockNumber: l.blockNumber,
        }));

        setAllLogs(parsed);
        setLogsComplete(res.complete);
      } catch (err) {
        console.warn("Could not scan logs:", err);
      } finally {
        if (active) setLogsLoading(false);
      }
    }

    loadLogs();
    return () => {
      active = false;
    };
  }, [contractAddress, deployBlock]);

  // Transaction execution
  const { writeContractAsync, isPending: isSigning } = useWriteContract();
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [stage, setStage] = useState<TxStage>("idle");
  const [ticking, setTicking] = useState(false);

  const receipt = useWaitForTransactionReceipt({ hash: txHash || undefined });
  const settledRef = useRef<Hex | null>(null);

  useEffect(() => {
    if (!txHash || settledRef.current === txHash) return;

    if (receipt.isSuccess) {
      settledRef.current = txHash;
      setStage("confirmed");
      setTicking(true);
      setTimeout(() => setTicking(false), 300);

      refetchStatus();
      refetchTotals();
      toast("success", "Checked in for today!");

      // Append log to in-memory logs list
      if (connectedAddress) {
        const currentDay = utcDay(nowSec);
        setAllLogs((prev) => [
          ...prev,
          {
            user: connectedAddress,
            day: currentDay,
            streak: status.current + 1,
            best: Math.max(status.best, status.current + 1),
            brokenFrom: status.streakAlive ? 0 : status.lastStreak,
          },
        ]);
      }
    } else if (receipt.isError) {
      settledRef.current = txHash;
      setStage("failed");
      toast("error", "Check-in failed on chain.");
    }
  }, [
    txHash,
    receipt.isSuccess,
    receipt.isError,
    connectedAddress,
    nowSec,
    status.current,
    status.best,
    status.streakAlive,
    status.lastStreak,
    refetchStatus,
    refetchTotals,
    toast,
  ]);

  const handleCheckIn = useCallback(async () => {
    if (!contractAddress) return;
    try {
      setStage("signing");
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: pulseAbi,
        functionName: "checkIn",
      });
      setTxHash(hash);
      setStage("pending");
    } catch (err: unknown) {
      setStage("idle");
      const message = describeError(err);
      if (message !== "Cancelled.") {
        toast("error", message);
      }
    }
  }, [contractAddress, writeContractAsync, toast]);

  // Derived UI phase & countdown
  const derivation = useMemo(() => {
    return deriveView(status, nowSec);
  }, [status, nowSec]);

  // Filter logs for viewed user's heatmap
  const userLogs = useMemo(() => {
    if (!targetAddress) return [];
    return allLogs.filter((l) => l.user.toLowerCase() === targetAddress.toLowerCase());
  }, [allLogs, targetAddress]);

  const currentUtcDay = useMemo(() => utcDay(nowSec), [nowSec]);
  const heatmapCells = useMemo(() => {
    return buildHeatmap(userLogs, currentUtcDay);
  }, [userLogs, currentUtcDay]);

  const leaderboardRows = useMemo(() => {
    return leaderboard(allLogs, currentUtcDay);
  }, [allLogs, currentUtcDay]);

  // Live countdown string until next check-in
  const countdownStr = useMemo(() => {
    if (status.nextCheckInAt === 0n) return "";
    const remaining = Math.max(0, Number(status.nextCheckInAt) - nowSec);
    return formatCountdown(remaining);
  }, [status.nextCheckInAt, nowSec]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
      {/* 1. Hero Check-in Tile (Span 7 x 2 rows on desktop) */}
      <Panel
        variant="inverted"
        className="md:col-span-7 md:row-span-2 flex flex-col justify-between min-h-[380px] md:min-h-[460px]"
      >
        {!isContractReady ? (
          <div className="flex flex-col justify-center items-center h-full text-center py-12">
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">Network Not Supported</h2>
            <p className="text-[var(--accent-ink)]/80 text-sm max-w-sm">
              Pulse is not deployed on this network. Please switch to Bohr Testnet or BOT Chain.
            </p>
          </div>
        ) : isReadOnly ? (
          // Read-only public dashboard for another address
          <div className="flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tracking-wider uppercase font-bold text-[var(--accent-ink)]/70">
                Public Streak View
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  status.streakAlive
                    ? "bg-[var(--accent-ink)] text-[var(--accent)]"
                    : "bg-black/20 text-[var(--accent-ink)]"
                }`}
              >
                {status.streakAlive ? "Streak Active" : "Streak Ended"}
              </span>
            </div>

            <div className="my-auto py-6">
              <h1 className="text-xl md:text-2xl font-extrabold mb-2 break-all text-[var(--accent-ink)]">
                {formatAddress(targetAddress || "")}&apos;s streak
              </h1>
              <div
                className={`text-7xl md:text-9xl font-black tracking-tighter leading-none mono ${
                  ticking ? "animate-tick" : ""
                }`}
              >
                {status.current}
              </div>
              <div className="text-xl md:text-2xl font-bold mt-1 text-[var(--accent-ink)]/90">
                day streak
              </div>
            </div>

            <div className="text-xs font-mono text-[var(--accent-ink)]/80">
              Total check-ins: {status.total} · Best: {status.best}
            </div>
          </div>
        ) : !isConnected ? (
          // Wallet not connected
          <div className="flex flex-col justify-between h-full">
            <div className="text-xs font-mono tracking-wider uppercase font-bold text-[var(--accent-ink)]/70">
              Daily habit marker
            </div>
            <div className="my-auto py-8 text-center">
              <div className="text-8xl md:text-9xl font-black tracking-tighter leading-none mono text-[var(--accent-ink)]">
                0
              </div>
              <div className="text-2xl font-bold text-[var(--accent-ink)] mt-2">day streak</div>
              <p className="text-sm text-[var(--accent-ink)]/80 mt-2 max-w-xs mx-auto">
                Connect your wallet to check in and start your daily streak.
              </p>
            </div>
            <div>
              <ConnectButton />
            </div>
          </div>
        ) : (
          // Connected wallet check-in hero
          <div className="flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tracking-wider uppercase font-bold text-[var(--accent-ink)]/80">
                Your daily streak
              </span>
              {derivation.phase === "atRisk" && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-black flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                  {derivation.hoursLeft}h left today
                </span>
              )}
            </div>

            {/* Huge numeral hero */}
            <div className="my-auto py-4">
              <div
                className={`text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter leading-none mono text-[var(--accent-ink)] ${
                  ticking ? "animate-tick" : ""
                }`}
                style={{ fontSize: "clamp(80px, 14vw, 180px)" }}
              >
                {status.current}
              </div>
              <div className="text-xl md:text-2xl font-extrabold text-[var(--accent-ink)]/90">
                day streak
              </div>
              {derivation.phase === "ended" && (
                <p className="text-xs font-medium text-[var(--accent-ink)]/80 mt-1">
                  {derivation.label}
                </p>
              )}
            </div>

            {/* Check-in button and status */}
            <div className="space-y-3 pt-2">
              {derivation.phase === "done" ? (
                <div className="space-y-2">
                  <Button
                    variant="hero"
                    disabled
                    aria-label="Checked in for today"
                    className="opacity-70 cursor-not-allowed"
                  >
                    Done for today.
                  </Button>
                  <p className="text-xs font-mono text-center text-[var(--accent-ink)]/80">
                    Next check-in window opens in {countdownStr}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant="hero"
                    onClick={handleCheckIn}
                    loading={isSigning || stage === "pending"}
                    disabled={isSigning || stage === "pending"}
                  >
                    Check in — day {derivation.nextDayNumber}
                  </Button>
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--accent-ink)]/80 px-1">
                    <span>Gas: ≈ 0.0015 BOT</span>
                    <span>1 check-in / UTC day</span>
                  </div>
                </div>
              )}

              {/* Transaction feedback */}
              {stage !== "idle" && (
                <div className="pt-1">
                  <TxStatus stage={stage} hash={txHash} />
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* 2. Best Streak Tile (Span 5) */}
      <Panel className="md:col-span-5 flex flex-col justify-between min-h-[180px] md:min-h-[220px]">
        <div className="text-xs font-mono tracking-wider uppercase text-[var(--text-muted)] font-semibold">
          Personal record
        </div>
        <div>
          <div className="text-5xl md:text-6xl font-black tracking-tight leading-none mono text-[var(--accent)]">
            {status.best}
          </div>
          <div className="text-lg md:text-xl font-bold mt-1 text-[var(--text-primary)]">
            best ever
          </div>
        </div>
        <div className="text-xs text-[var(--text-muted)] font-mono">
          {status.best > 0 ? "All-time longest streak" : "No streak recorded yet"}
        </div>
      </Panel>

      {/* 3. Total Check-ins Tile (Span 5) */}
      <Panel className="md:col-span-5 flex flex-col justify-between min-h-[180px] md:min-h-[220px]">
        <div className="text-xs font-mono tracking-wider uppercase text-[var(--text-muted)] font-semibold">
          Commitment
        </div>
        <div>
          <div className="text-5xl md:text-6xl font-black tracking-tight leading-none mono text-[var(--text-primary)]">
            {status.total}
          </div>
          <div className="text-lg md:text-xl font-bold mt-1 text-[var(--text-primary)]">
            check-ins
          </div>
        </div>
        <div className="text-xs text-[var(--text-muted)] font-mono">
          Lifetime wallet check-in count
        </div>
      </Panel>

      {/* 4. Calendar Heatmap Tile (Span 8) */}
      <Panel className="md:col-span-8 flex flex-col justify-between min-h-[260px]">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Streak history</h2>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Last 15 weeks (105 days) · UTC calendar
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)]" /> Checked in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] border border-[var(--border-subtle)] bg-transparent" /> Missed
            </span>
          </div>
        </div>

        {/* 15 x 7 calendar grid */}
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 min-w-[420px] max-w-full">
            {heatmapCells.map((cell) => (
              <div
                key={cell.day.toString()}
                title={`${cell.date}: ${cell.checkedIn ? `Checked in (streak ${cell.streak})` : "Missed"}`}
                aria-label={`${cell.date}: ${cell.checkedIn ? `Checked in` : "Missed"}`}
                className={`w-3.5 h-3.5 rounded-[3px] transition-all relative ${
                  cell.checkedIn
                    ? "bg-[var(--accent)]"
                    : "bg-white/[0.04] border border-[var(--border-subtle)]"
                } ${
                  cell.isToday
                    ? "ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-surface)] scale-110 z-10"
                    : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className="text-xs font-mono text-[var(--text-muted)] mt-2">
          {userLogs.length > 0
            ? `${userLogs.length} check-in log(s) recorded in scan range`
            : "No check-ins in the last 15 weeks for this wallet"}
        </div>
      </Panel>

      {/* 5. Today Global Activity Tile (Span 4) */}
      <Panel className="md:col-span-4 flex flex-col justify-between min-h-[260px]">
        <div className="text-xs font-mono tracking-wider uppercase text-[var(--text-muted)] font-semibold">
          Network pulse
        </div>
        <div>
          <div className="text-5xl md:text-6xl font-black tracking-tight leading-none mono text-[var(--accent)]">
            {totalsData ? Number(totalsData[2]) : 0}
          </div>
          <div className="text-base md:text-lg font-bold mt-1 text-[var(--text-primary)]">
            wallets checked in today
          </div>
        </div>
        <div className="space-y-2">
          {/* Live pulsing bar */}
          <div className="h-2 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(10, (totalsData ? Number(totalsData[2]) : 1) * 8))}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono text-[var(--text-muted)]">
            <span>Total: {totalsData ? Number(totalsData[0]) : 0}</span>
            <span>Wallets: {totalsData ? Number(totalsData[1]) : 0}</span>
          </div>
        </div>
      </Panel>

      {/* 6. Leaderboard Tile (Span 7) */}
      <Panel className="md:col-span-7 flex flex-col justify-between min-h-[340px]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Leaderboard</h2>
            <p className="text-xs text-[var(--text-muted)] font-mono">
              Top 10 streaks by all-time best
            </p>
          </div>
          {logsLoading && (
            <span className="text-xs font-mono text-[var(--text-muted)] animate-pulse">
              Scanning…
            </span>
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--border-subtle)] text-xs font-mono">
          {leaderboardRows.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              Nobody yet. First check-in takes the top.
            </div>
          ) : (
            leaderboardRows.map((row) => (
              <div
                key={row.user}
                className="py-2 flex items-center justify-between gap-3 hover:bg-white/[0.02] px-1 rounded transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center font-bold text-[var(--text-muted)]">
                    #{row.rank}
                  </span>
                  <Link
                    href={`/u/${row.user}`}
                    className="text-[var(--text-primary)] hover:text-[var(--accent)] underline decoration-[var(--border-subtle)] transition-colors"
                  >
                    {formatAddress(row.user)}
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[var(--accent)]">{row.best} best</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                      row.streakAlive
                        ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                        : "bg-white/5 text-[var(--text-muted)] border border-white/10"
                    }`}
                  >
                    {row.streakAlive ? "Alive" : "Ended"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)] pt-3">
          {logsComplete
            ? "Complete scan from genesis."
            : "Scanned the last 100 log chunks of check-ins."}
        </div>
      </Panel>

      {/* 7. How it works / Limits Tile (Span 5) */}
      <Panel className="md:col-span-5 flex flex-col justify-between min-h-[340px]">
        <div>
          <div className="text-xs font-mono tracking-wider uppercase text-[var(--accent)] font-semibold mb-2">
            Protocol rules
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">What this is not</h2>
          <div className="space-y-3 text-sm text-[var(--text-primary)]/90 leading-relaxed">
            <p className="flex items-start gap-2">
              <span className="text-[var(--accent)] font-bold">1.</span>
              <span>One check-in per UTC day. No exceptions, for anyone.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[var(--accent)] font-bold">2.</span>
              <span>A streak proves a wallet showed up — not a person.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[var(--accent)] font-bold">3.</span>
              <span>Miss a day and it starts over. We can&apos;t fix that.</span>
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-mono">
          Stores counts and dates only. No names, no fees, no admin.
        </div>
      </Panel>

      {/* 8. Colophon / Footer Tile (Span 12, thin) */}
      <Panel
        variant="subtle"
        className="md:col-span-12 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] font-mono"
      >
        <div>Pulse · On-chain daily habit marker</div>
        <div>
          <BuiltOnBotChain className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline" />
        </div>
      </Panel>
    </div>
  );
}
