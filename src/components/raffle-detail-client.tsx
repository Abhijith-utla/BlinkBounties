"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useMemo, useState } from "react";

import { WinnerModal } from "@/components/winner-modal";
import {
  APP_URL,
  buildBuyTicketsInstruction,
  buildClaimProceedsInstruction,
  buildCloseRaffleInstruction,
  getBuyerPositionPda,
  type BuyerPositionAccount,
  type RaffleAccount,
} from "@/lib/solana";

interface Props {
  raffle: RaffleAccount;
  buyers: BuyerPositionAccount[];
}

export function RaffleDetailClient({ raffle, buyers }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showWinner, setShowWinner] = useState(false);

  const isSeller = useMemo(
    () => !!wallet.publicKey && wallet.publicKey.toBase58() === raffle.seller,
    [wallet.publicKey, raffle.seller],
  );

  async function sendTx(mode: "buy" | "close" | "claim") {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect wallet first.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    try {
      const rafflePubkey = new PublicKey(raffle.address);
      const tx = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = blockhash;

      if (mode === "buy") {
        const qty = Math.max(1, Math.min(3, quantity));
        tx.add(
          buildBuyTicketsInstruction({
            buyer: wallet.publicKey,
            raffle: rafflePubkey,
            buyerPosition: getBuyerPositionPda(rafflePubkey, wallet.publicKey),
            quantity: qty,
          }),
        );
      }

      if (mode === "close") {
        tx.add(buildCloseRaffleInstruction({ seller: wallet.publicKey, raffle: rafflePubkey }));
      }

      if (mode === "claim") {
        tx.add(buildClaimProceedsInstruction({ seller: wallet.publicKey, raffle: rafflePubkey }));
      }

      const sig = await wallet.sendTransaction(tx, connection, { preflightCommitment: "confirmed" });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      setStatus(`Transaction success: ${sig}`);
      if (mode === "claim") {
        setShowWinner(true);
      } else {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (txError) {
      setError(txError instanceof Error ? txError.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Buy Tickets</h3>
          <WalletMultiButton className="!h-10 !rounded-xl !bg-black !text-white" />
        </div>
        <p className="mt-2 text-sm text-black/70">Choose 1, 2, or 3 tickets and confirm in Phantom.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3].map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => setQuantity(qty)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${quantity === qty ? "bg-black text-white" : "bg-black/10"}`}
            >
              {qty} Ticket{qty > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm font-semibold">
          Total: {(raffle.ticketPriceSol * quantity).toFixed(4)} SOL
        </p>
        <button
          type="button"
          disabled={busy || raffle.status !== "open" || isSeller}
          onClick={() => sendTx("buy")}
          className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Buy Tickets
        </button>

        {isSeller ? (
          <p className="mt-2 text-xs text-black/60">Seller cannot buy tickets in own raffle.</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-lg">
        <h3 className="text-lg font-semibold">Seller Review Panel</h3>
        <p className="mt-1 text-sm text-black/70">Review buyers and manage listing payout.</p>
        <div className="mt-3 space-y-2">
          {buyers.map((buyer) => (
            <div key={buyer.address} className="rounded-lg border border-black/10 bg-black/[0.03] p-3 text-sm">
              <p className="font-semibold">{buyer.buyer}</p>
              <p>Tickets: {buyer.tickets}</p>
              <p>Spent: {buyer.spentSol.toFixed(4)} SOL</p>
            </div>
          ))}
          {buyers.length === 0 ? <p className="text-sm text-black/60">No buyers yet.</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => sendTx("close")}
            disabled={!isSeller || busy || raffle.status !== "open"}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close Listing
          </button>
          <button
            type="button"
            onClick={() => sendTx("claim")}
            disabled={!isSeller || busy}
            className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Claim Proceeds
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-lg">
        <h3 className="text-lg font-semibold">Blink Share URL</h3>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-black px-3 py-2 text-xs text-emerald-300">
          {`${APP_URL}/raffle/${raffle.address}`}
        </code>
      </section>

      {status ? <p className="text-xs text-emerald-700">{status}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      {showWinner && (
        <WinnerModal
          nftTitle={raffle.title}
          nftImage={raffle.imageUrl}
          onClose={() => { setShowWinner(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
