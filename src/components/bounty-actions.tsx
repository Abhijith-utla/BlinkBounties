"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useMemo, useState } from "react";

import {
  APP_URL,
  buildApproveBountyInstruction,
  buildCancelBountyInstruction,
  type BountyAccount,
} from "@/lib/solana";

interface Props {
  bounty: BountyAccount;
}

export function BountyActions({ bounty }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCreator = useMemo(
    () => !!wallet.publicKey && wallet.publicKey.toBase58() === bounty.creator,
    [wallet.publicKey, bounty.creator],
  );

  const blinkUrl = `${APP_URL}/bounty/${bounty.address}`;

  async function sendCreatorTransaction(mode: "approve" | "cancel") {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect a creator wallet first.");
      return;
    }

    if (!isCreator) {
      setError("Only the creator can run this transaction.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatusText(null);

    try {
      const tx = new Transaction();
      const bountyPubkey = new PublicKey(bounty.address);

      if (mode === "approve") {
        if (!bounty.claimant) {
          throw new Error("No claimant set yet.");
        }

        tx.add(
          buildApproveBountyInstruction({
            creator: wallet.publicKey,
            claimant: new PublicKey(bounty.claimant),
            bounty: bountyPubkey,
          }),
        );
      } else {
        tx.add(
          buildCancelBountyInstruction({
            creator: wallet.publicKey,
            bounty: bountyPubkey,
          }),
        );
      }

      const signature = await wallet.sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");
      setStatusText(`Transaction sent: ${signature}`);
    } catch (txError) {
      setError(txError instanceof Error ? txError.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 shadow-lg">
      <h3 className="text-lg font-semibold">Bounty Controls</h3>

      <p className="text-sm text-black/70">Share this Blink URL:</p>
      <code className="block overflow-x-auto rounded-lg bg-black px-3 py-2 text-xs text-emerald-300">{blinkUrl}</code>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!isCreator || bounty.status !== "submitted" || busy}
          onClick={() => sendCreatorTransaction("approve")}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Approve + Release Funds
        </button>
        <button
          type="button"
          disabled={!isCreator || bounty.status !== "open" || busy}
          onClick={() => sendCreatorTransaction("cancel")}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel + Refund
        </button>
      </div>

      {statusText ? <p className="text-xs text-emerald-700">{statusText}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
