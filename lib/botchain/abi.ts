/**
 * Pulse contract ABI, hand-written as const.
 */
export const pulseAbi = [
  {
    type: "function",
    name: "DAY",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "checkIn",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "checkInsOn",
    inputs: [{ name: "day", type: "uint64", internalType: "uint64" }],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "participants",
    inputs: [],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "statusOf",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct Pulse.Status",
        components: [
          { name: "current", type: "uint32", internalType: "uint32" },
          { name: "lastStreak", type: "uint32", internalType: "uint32" },
          { name: "best", type: "uint32", internalType: "uint32" },
          { name: "total", type: "uint32", internalType: "uint32" },
          { name: "lastDay", type: "uint64", internalType: "uint64" },
          { name: "nextCheckInAt", type: "uint64", internalType: "uint64" },
          { name: "checkedInToday", type: "bool", internalType: "bool" },
          { name: "streakAlive", type: "bool", internalType: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "today",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalCheckIns",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totals",
    inputs: [],
    outputs: [
      { name: "checkIns", type: "uint64", internalType: "uint64" },
      { name: "wallets", type: "uint32", internalType: "uint32" },
      { name: "todayCount", type: "uint32", internalType: "uint32" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "CheckedIn",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "day", type: "uint64", indexed: true, internalType: "uint64" },
      { name: "streak", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "best", type: "uint32", indexed: false, internalType: "uint32" },
      { name: "brokenFrom", type: "uint32", indexed: false, internalType: "uint32" },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AlreadyCheckedIn",
    inputs: [
      { name: "day", type: "uint64", internalType: "uint64" },
      { name: "nextAt", type: "uint64", internalType: "uint64" },
    ],
  },
] as const;

export const contractAbi = pulseAbi;
