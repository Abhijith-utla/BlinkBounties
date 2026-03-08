"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useState } from "react";

import { fetchBountiesByCreator, type BountyAccount } from "@/lib/solana";

const statusClassName: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  submitted: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

export function MyBounties() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BountyAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!publicKey) {
        setItems([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const list = await fetchBountiesByCreator(connection, new PublicKey(publicKey.toBase58()));
        if (!cancelled) {
          setItems(list);
        }
      } catch (listError) {
        if (!cancelled) {
          setError(listError instanceof Error ? listError.message : "Failed to load bounties.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [connection, publicKey, reloadToken]);

  if (!publicKey) {
    return null;
  }

  return (
    <section className="mt-8 rounded-2xl border border-black/10 bg-white/75 p-5 shadow-lg backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Your Bounties</h2>
        <button
          type="button"
          className="text-xs font-semibold underline"
          onClick={() => setReloadToken((current) => current + 1)}
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-black/60">Loading...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-black/65">No bounties found for this wallet yet.</p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.address}
            href={`/bounty/${item.address}`}
            className="block rounded-xl border border-black/10 bg-white px-4 py-3 hover:bg-black/[0.02]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.amountSol.toFixed(3)} SOL</p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClassName[item.status]}`}>
                {item.status.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm text-black/70">{item.description}</p>
            <p className="mt-1 text-xs text-black/50">{item.address}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
