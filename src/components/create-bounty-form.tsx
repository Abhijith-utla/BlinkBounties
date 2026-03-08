"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { WalletError } from "@solana/wallet-adapter-base";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  BOUNTY_ACCOUNT_SPACE,
  PROGRAM_ID,
  buildCreateBountyInstruction,
  getBountyPda,
} from "@/lib/solana";

function toLamports(amountSol: number): bigint {
  return BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
}

export function CreateBountyForm() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [description, setDescription] = useState("");
  const [amountSol, setAmountSol] = useState("0.05");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const connected = wallet.connected && wallet.publicKey;

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onCreateBounty() {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect a wallet before creating a bounty.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const normalizedAmountSol = Number(amountSol);
      if (!Number.isFinite(normalizedAmountSol) || normalizedAmountSol <= 0) {
        throw new Error("Enter a valid SOL amount.");
      }

      if (!description.trim() || description.length > 280) {
        throw new Error("Description is required and must be <= 280 chars.");
      }

      const lamports = toLamports(normalizedAmountSol);
      const bountyId = BigInt(Date.now());
      const bountyPda = getBountyPda(wallet.publicKey, bountyId);
      const [programAccount, rentExemption, walletBalance] = await Promise.all([
        connection.getAccountInfo(PROGRAM_ID),
        connection.getMinimumBalanceForRentExemption(BOUNTY_ACCOUNT_SPACE),
        connection.getBalance(wallet.publicKey, "confirmed"),
      ]);

      if (!programAccount) {
        throw new Error(
          `Program ${PROGRAM_ID.toBase58()} is not deployed on Testnet yet. Run anchor deploy first.`,
        );
      }

      const requiredLamports = Number(lamports) + rentExemption + 10_000;
      if (walletBalance < requiredLamports) {
        const need = (requiredLamports / LAMPORTS_PER_SOL).toFixed(4);
        const has = (walletBalance / LAMPORTS_PER_SOL).toFixed(4);
        throw new Error(
          `Insufficient Testnet SOL. Need about ${need} SOL (including rent), wallet has ${has} SOL.`,
        );
      }

      const tx = new Transaction();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = blockhash;
      tx.add(
        buildCreateBountyInstruction({
          creator: wallet.publicKey,
          bounty: bountyPda,
          bountyId,
          amountLamports: lamports,
          description: description.trim(),
        }),
      );

      const signature = await wallet.sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
        maxRetries: 3,
      });

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      setCreatedUrl(`/bounty/${bountyPda.toBase58()}`);
    } catch (createError) {
      if (createError instanceof WalletError) {
        setError(
          `Wallet error: ${createError.message}. Check wallet network is Testnet and wallet has testnet SOL.`,
        );
      } else {
        setError(
          createError instanceof Error ? createError.message : "Failed to create bounty.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Create New Bounty</h2>
        {mounted ? (
          <WalletMultiButton className="!h-10 !rounded-xl !bg-black !text-white" />
        ) : (
          <button
            type="button"
            className="h-10 rounded-xl bg-black px-4 text-sm font-medium text-white opacity-80"
            disabled
          >
            Wallet
          </button>
        )}
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium">
          What needs to be built?
          <textarea
            className="mt-2 min-h-28 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-black"
            maxLength={280}
            placeholder="Fix docs bug in SPL guide with tested PR..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium">
          Payout (SOL)
          <input
            className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:border-black"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amountSol}
            onChange={(event) => setAmountSol(event.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={onCreateBounty}
          disabled={!connected || submitting}
          className="h-11 w-full rounded-xl bg-black text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Escrowed Bounty"}
        </button>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {createdUrl ? (
          <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            Bounty created. Open: <Link className="font-semibold underline" href={createdUrl}>{createdUrl}</Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
