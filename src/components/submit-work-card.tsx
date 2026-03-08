"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";

import { buildSubmitWorkInstruction, type BountyAccount } from "@/lib/solana";

interface Props {
  bounty: BountyAccount;
}

export function SubmitWorkCard({ bounty }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [mounted, setMounted] = useState(false);
  const [workUrl, setWorkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isCreator = useMemo(
    () => !!wallet.publicKey && wallet.publicKey.toBase58() === bounty.creator,
    [wallet.publicKey, bounty.creator],
  );

  const canSubmit = bounty.status === "open" && !isCreator;

  async function onSubmit() {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect your wallet before submitting work.");
      return;
    }

    if (!/^https?:\/\//i.test(workUrl.trim())) {
      setError("Enter a valid http(s) proof URL.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const bountyPubkey = new PublicKey(bounty.address);
      const tx = new Transaction();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = blockhash;
      tx.add(
        buildSubmitWorkInstruction({
          claimant: wallet.publicKey,
          bounty: bountyPubkey,
          workUrl: workUrl.trim(),
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
        throw new Error(JSON.stringify(confirmation.value.err));
      }

      setStatus(`Submitted successfully: ${signature}`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Submit Your Work</h3>
        {mounted ? (
          <WalletMultiButton className="!h-10 !rounded-xl !bg-black !text-white" />
        ) : (
          <button
            type="button"
            disabled
            className="h-10 rounded-xl bg-black px-4 text-sm text-white opacity-80"
          >
            Wallet
          </button>
        )}
      </div>

      <div className="rounded-xl border border-black/10 bg-black/[0.03] p-4 text-sm text-black/75">
        <p className="font-semibold text-black">Task Instructions</p>
        <p className="mt-2">{bounty.description}</p>
        <p className="mt-2 text-xs text-black/60">
          Submit a GitHub PR, commit, demo video, or any proof URL. The creator reviews and
          approves payout from escrow.
        </p>
      </div>

      {bounty.status === "submitted" ? (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
          Submission received. Waiting for creator review.
        </p>
      ) : null}
      {bounty.status === "completed" ? (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
          Bounty already completed and paid.
        </p>
      ) : null}
      {bounty.status === "cancelled" ? (
        <p className="rounded-lg bg-zinc-200 px-3 py-2 text-sm text-zinc-800">
          Bounty was cancelled by creator.
        </p>
      ) : null}

      {canSubmit ? (
        <>
          <label className="block text-sm font-medium">
            Proof URL
            <input
              className="mt-2 h-11 w-full rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:border-black"
              placeholder="https://github.com/your/repo/pull/123"
              value={workUrl}
              onChange={(event) => setWorkUrl(event.target.value)}
            />
          </label>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
        </>
      ) : null}

      {isCreator && bounty.status === "open" ? (
        <p className="text-xs text-black/60">Creator cannot submit work for own bounty.</p>
      ) : null}

      {status ? <p className="text-xs text-emerald-700">{status}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </section>
  );
}
