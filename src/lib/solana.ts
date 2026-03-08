import { BN, BorshCoder, type Idl } from "@coral-xyz/anchor";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { z } from "zod";

import { BLINK_BOUNTIES_IDL } from "@/lib/idl/blink_bounties";

const DEFAULT_PROGRAM_ID = "3MAR3HqMntaDfPE1Vmf1XGBeCEv2dykXUCjwsMB8gF1S";

const envSchema = z.object({
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_PROGRAM_ID: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const env = envSchema.parse({
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  NEXT_PUBLIC_PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export const SOLANA_RPC_URL = env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("testnet");
export const PROGRAM_ID = new PublicKey(env.NEXT_PUBLIC_PROGRAM_ID ?? DEFAULT_PROGRAM_ID);
export const APP_URL = env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const BOUNTY_ACCOUNT_SPACE = 680;

export const connection = new Connection(SOLANA_RPC_URL, "confirmed");

const coder = new BorshCoder(BLINK_BOUNTIES_IDL as Idl);

export type BountyStatus = "open" | "submitted" | "completed" | "cancelled";

export interface BountyAccount {
  address: string;
  creator: string;
  bountyId: string;
  amountLamports: string;
  amountSol: number;
  description: string;
  claimant: string | null;
  workUrl: string | null;
  status: BountyStatus;
  bump: number;
}

interface DecodedBounty {
  creator: PublicKey;
  bounty_id: BN;
  amount: BN;
  description: string;
  claimant: PublicKey | null;
  work_url: string | null;
  status: Record<string, unknown>;
  bump: number;
}

function normalizeStatus(status: Record<string, unknown>): BountyStatus {
  const raw = Object.keys(status)[0];
  const key = raw?.toLowerCase() as BountyStatus | undefined;
  if (!key) return "open";
  return key;
}

export function getBountyPda(creator: PublicKey, bountyId: bigint): PublicKey {
  const bountyIdBuffer = new BN(bountyId.toString()).toArrayLike(Buffer, "le", 8);

  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bounty"), creator.toBuffer(), bountyIdBuffer],
    PROGRAM_ID,
  );

  return pda;
}

export async function fetchBountyByAddress(address: PublicKey): Promise<BountyAccount | null> {
  const accountInfo = await connection.getAccountInfo(address);
  if (!accountInfo) {
    return null;
  }

  const decoded = coder.accounts.decode("Bounty", accountInfo.data) as DecodedBounty;
  const amountLamports = decoded.amount.toString();

  return {
    address: address.toBase58(),
    creator: decoded.creator.toBase58(),
    bountyId: decoded.bounty_id.toString(),
    amountLamports,
    amountSol: Number(amountLamports) / LAMPORTS_PER_SOL,
    description: decoded.description,
    claimant: decoded.claimant ? decoded.claimant.toBase58() : null,
    workUrl: decoded.work_url,
    status: normalizeStatus(decoded.status),
    bump: decoded.bump,
  };
}

export async function fetchBountiesByCreator(
  rpcConnection: Connection,
  creator: PublicKey,
): Promise<BountyAccount[]> {
  const creatorOffset = 8; // account discriminator
  const accounts = await rpcConnection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: creatorOffset, bytes: creator.toBase58() } }],
  });

  const parsed = accounts.map((account) => {
    const decoded = coder.accounts.decode("Bounty", account.account.data) as DecodedBounty;
    const amountLamports = decoded.amount.toString();
    return {
      address: account.pubkey.toBase58(),
      creator: decoded.creator.toBase58(),
      bountyId: decoded.bounty_id.toString(),
      amountLamports,
      amountSol: Number(amountLamports) / LAMPORTS_PER_SOL,
      description: decoded.description,
      claimant: decoded.claimant ? decoded.claimant.toBase58() : null,
      workUrl: decoded.work_url,
      status: normalizeStatus(decoded.status),
      bump: decoded.bump,
    } satisfies BountyAccount;
  });

  return parsed.sort((a, b) => Number(b.bountyId) - Number(a.bountyId));
}

export function buildCreateBountyInstruction(args: {
  creator: PublicKey;
  bounty: PublicKey;
  bountyId: bigint;
  amountLamports: bigint;
  description: string;
}): TransactionInstruction {
  const data = coder.instruction.encode("create_bounty", {
    bounty_id: new BN(args.bountyId.toString()),
    amount: new BN(args.amountLamports.toString()),
    description: args.description,
  });

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.creator, isSigner: true, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildSubmitWorkInstruction(args: {
  claimant: PublicKey;
  bounty: PublicKey;
  workUrl: string;
}): TransactionInstruction {
  const data = coder.instruction.encode("submit_work", {
    work_url: args.workUrl,
  });

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.claimant, isSigner: true, isWritable: false },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function buildApproveBountyInstruction(args: {
  creator: PublicKey;
  claimant: PublicKey;
  bounty: PublicKey;
}): TransactionInstruction {
  const data = coder.instruction.encode("approve_bounty", {});

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.creator, isSigner: true, isWritable: true },
      { pubkey: args.claimant, isSigner: false, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function buildCancelBountyInstruction(args: {
  creator: PublicKey;
  bounty: PublicKey;
}): TransactionInstruction {
  const data = coder.instruction.encode("cancel_bounty", {});

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: args.creator, isSigner: true, isWritable: true },
      { pubkey: args.bounty, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export async function buildSubmitWorkTransaction(args: {
  user: PublicKey;
  bounty: PublicKey;
  workUrl: string;
}) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: args.user,
    blockhash,
    lastValidBlockHeight,
  });

  tx.add(
    buildSubmitWorkInstruction({
      claimant: args.user,
      bounty: args.bounty,
      workUrl: args.workUrl,
    }),
  );

  return tx;
}
