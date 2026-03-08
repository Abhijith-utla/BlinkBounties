import type { Idl } from "@coral-xyz/anchor";

export const BLINK_BOUNTIES_IDL = {
  address: "3MAR3HqMntaDfPE1Vmf1XGBeCEv2dykXUCjwsMB8gF1S",
  metadata: {
    name: "blink_bounties",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Trustless escrow bounties for Solana blinks",
  },
  instructions: [
    {
      name: "create_bounty",
      discriminator: [122, 90, 14, 143, 8, 125, 200, 2],
      accounts: [
        { name: "creator", writable: true, signer: true },
        { name: "bounty", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "bounty_id", type: "u64" },
        { name: "amount", type: "u64" },
        { name: "description", type: "string" },
      ],
    },
    {
      name: "submit_work",
      discriminator: [158, 80, 101, 51, 114, 130, 101, 253],
      accounts: [
        { name: "claimant", signer: true },
        { name: "bounty", writable: true },
      ],
      args: [{ name: "work_url", type: "string" }],
    },
    {
      name: "approve_bounty",
      discriminator: [159, 69, 100, 84, 88, 57, 93, 29],
      accounts: [
        { name: "creator", writable: true, signer: true },
        { name: "claimant", writable: true },
        { name: "bounty", writable: true },
      ],
      args: [],
    },
    {
      name: "cancel_bounty",
      discriminator: [79, 65, 107, 143, 128, 165, 135, 46],
      accounts: [
        { name: "creator", writable: true, signer: true },
        { name: "bounty", writable: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Bounty",
      discriminator: [237, 16, 105, 198, 19, 69, 242, 234],
    },
  ],
  types: [
    {
      name: "Bounty",
      type: {
        kind: "struct",
        fields: [
          { name: "creator", type: "pubkey" },
          { name: "bounty_id", type: "u64" },
          { name: "amount", type: "u64" },
          { name: "description", type: "string" },
          { name: "claimant", type: { option: "pubkey" } },
          { name: "work_url", type: { option: "string" } },
          { name: "status", type: { defined: { name: "BountyStatus" } } },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "BountyStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Open" },
          { name: "Submitted" },
          { name: "Completed" },
          { name: "Cancelled" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "InvalidAmount", msg: "Only positive amounts are allowed" },
    { code: 6001, name: "DescriptionTooLong", msg: "Bounty description exceeds max length" },
    { code: 6002, name: "WorkUrlTooLong", msg: "Work URL exceeds max length" },
    { code: 6003, name: "InvalidStatus", msg: "Invalid bounty status for this operation" },
    { code: 6004, name: "MissingClaimant", msg: "Claimant is required before approval" },
    { code: 6005, name: "Unauthorized", msg: "Unauthorized signer or account" },
    { code: 6006, name: "MathOverflow", msg: "Math overflow" },
  ],
} satisfies Idl;
