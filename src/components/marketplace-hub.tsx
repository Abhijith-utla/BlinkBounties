"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildCreateRaffleInstruction,
  fetchAllRaffles,
  fetchPositionsByBuyer,
  fetchRafflesBySeller,
  getRafflePda,
  type BuyerPositionAccount,
  type RaffleAccount,
} from "@/lib/solana";

type RoleTab = "poster" | "worker";
type StatusFilter = "all" | "open" | "closed";

function RaffleCard({ item }: { item: RaffleAccount }) {
  const progressPct = Math.min(100, (item.soldTickets / item.maxTickets) * 100);
  const sellerShort = item.seller.slice(0, 6);

  return (
    <Link
      href={`/raffle/${item.address}`}
      className="group block w-full overflow-hidden rounded-2xl bg-white text-left shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
    >
      {/* Owner row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{sellerShort[0]}</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none">Listed by</p>
            <p className="text-xs font-bold text-gray-900 leading-tight font-mono">{sellerShort}...</p>
          </div>
        </div>
        {item.status === "open" ? (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">LIVE</span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">CLOSED</span>
        )}
      </div>

      {/* Image or placeholder */}
      {item.imageUrl ? (
        <div className="relative h-48 w-full overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {item.status === "closed" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rotate-[-25deg] rounded border-4 border-red-500 px-4 py-1 text-3xl font-black uppercase tracking-widest text-red-500 opacity-90">SOLD</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
          <p className="text-4xl font-black text-violet-300">#</p>
        </div>
      )}

      {/* Details */}
      <div className="px-4 pt-3 pb-2">
        <p className="font-bold text-gray-900 text-sm truncate">{item.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{item.description}</p>
        <div className="mt-2 mb-1">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{item.soldTickets} sold</span>
            <span>{item.maxTickets} max</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xs text-gray-400">Price:</span>
          <span className="text-sm font-bold text-gray-900">SOL {item.ticketPriceSol.toFixed(4)}</span>
          <span className="ml-auto text-xs text-gray-400">{item.maxTickets - item.soldTickets} left</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 px-4 pb-4">
        <span className="flex-1 rounded-xl border border-gray-200 py-2 text-center text-xs font-semibold text-gray-500">
          View raffle
        </span>
        <span className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold text-white ${item.status === "open" ? "bg-gray-900" : "bg-gray-300"}`}>
          {item.status === "open" ? "Buy Ticket" : "Sold Out"}
        </span>
      </div>
    </Link>
  );
}

export function MarketplaceHub() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [role, setRole] = useState<RoleTab>("worker");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [allRaffles, setAllRaffles] = useState<RaffleAccount[]>([]);
  const [posterRaffles, setPosterRaffles] = useState<RaffleAccount[]>([]);
  const [myTickets, setMyTickets] = useState<BuyerPositionAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ticketPrice, setTicketPrice] = useState("0.01");
  const [maxTickets, setMaxTickets] = useState("100");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const marketPromise = fetchAllRaffles(connection);
        const balancePromise = wallet.publicKey
          ? connection.getBalance(wallet.publicKey, "confirmed")
          : Promise.resolve(null);
        const sellerPromise = wallet.publicKey
          ? fetchRafflesBySeller(connection, wallet.publicKey)
          : Promise.resolve([] as RaffleAccount[]);
        const ticketsPromise = wallet.publicKey
          ? fetchPositionsByBuyer(connection, wallet.publicKey)
          : Promise.resolve([] as BuyerPositionAccount[]);

        const [market, walletBalance, sellerItems, ticketItems] = await Promise.all([
          marketPromise,
          balancePromise,
          sellerPromise,
          ticketsPromise,
        ]);

        if (!cancelled) {
          setAllRaffles(market);
          setPosterRaffles(sellerItems);
          setMyTickets(ticketItems);
          setBalance(walletBalance === null ? null : walletBalance / LAMPORTS_PER_SOL);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load marketplace.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [connection, wallet.publicKey, reloadToken]);

  const filtered = useMemo(() => {
    return allRaffles.filter((item) => {
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const queryOk =
        !query.trim() ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase());
      return statusOk && queryOk;
    });
  }, [allRaffles, query, statusFilter]);

  async function createListing() {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setCreateError("Connect wallet first.");
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      const priceSol = Number(ticketPrice);
      const max = Number(maxTickets);
      if (!title.trim() || !description.trim()) throw new Error("Title and description are required.");
      if (!Number.isFinite(priceSol) || priceSol <= 0) throw new Error("Invalid ticket price.");
      if (!Number.isFinite(max) || max <= 0) throw new Error("Invalid max tickets.");
      if (!/^https?:\/\//i.test(imageUrl.trim())) {
        throw new Error("Image URL must be a public http(s) link. Do not paste base64 data URLs.");
      }
      if (imageUrl.trim().length > 300) {
        throw new Error("Image URL is too long. Use a shorter hosted image link.");
      }

      const raffleId = BigInt(Date.now());
      const rafflePda = getRafflePda(wallet.publicKey, raffleId);
      const priceLamports = BigInt(Math.round(priceSol * LAMPORTS_PER_SOL));

      const tx = new Transaction();
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = blockhash;
      tx.add(
        buildCreateRaffleInstruction({
          seller: wallet.publicKey,
          raffle: rafflePda,
          raffleId,
          ticketPriceLamports: priceLamports,
          maxTickets: max,
          title: title.trim(),
          description: description.trim(),
          imageUrl: imageUrl.trim(),
        }),
      );

      const simulation = await connection.simulateTransaction(tx);
      if (simulation.value.err) {
        const simulationDetails = simulation.value.logs?.slice(-6).join(" | ");
        throw new Error(
          `Preflight failed: ${JSON.stringify(simulation.value.err)}${simulationDetails ? ` (${simulationDetails})` : ""}`,
        );
      }

      const signature = await wallet.sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
      });
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

      setTitle("");
      setDescription("");
      setImageUrl("");
      setReloadToken((curr) => curr + 1);
    } catch (createListingError) {
      setCreateError(
        createListingError instanceof Error ? createListingError.message : "Failed to create listing.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 font-mono">On-chain Raffle Market</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">Browse &amp; enter live raffles</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <p className="text-gray-400">Wallet</p>
              <p className="font-semibold text-gray-900 font-mono">
                {balance === null ? "Not connected" : `${balance.toFixed(4)} SOL`}
              </p>
            </div>
            <WalletMultiButton className="!h-10 !rounded-xl !bg-violet-600 !text-white hover:!bg-violet-700" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-500">Role:</span>
          <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setRole("worker")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                role === "worker" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              Buyer
            </button>
            <button
              type="button"
              onClick={() => setRole("poster")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                role === "poster" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              Seller
            </button>
          </div>
          <button
            type="button"
            onClick={() => setReloadToken((curr) => curr + 1)}
            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
          >
            Refresh
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          Loading marketplace...
        </div>
      ) : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}

      {role === "poster" ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Create New Raffle Listing</h3>
            <p className="mt-1 text-sm text-gray-500">List an NFT and sell raffle tickets on-chain.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title"
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors" />
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (https://...)"
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors" />
              <input value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} placeholder="Ticket price (SOL)"
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors" />
              <input value={maxTickets} onChange={(e) => setMaxTickets(e.target.value)} placeholder="Max tickets"
                className="h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors" />
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the item and raffle rules"
              className="mt-3 min-h-24 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors" />
            <button onClick={createListing} disabled={creating}
              className="mt-3 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {creating ? "Creating..." : "Create Raffle"}
            </button>
            {createError ? <p className="mt-2 text-sm text-red-600">{createError}</p> : null}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">Your Listings</h3>
            <p className="mt-1 text-sm text-gray-500">Click a card to review buyers and manage payout.</p>
            {posterRaffles.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {posterRaffles.map((item) => (
                  <RaffleCard key={item.address} item={item} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-400">No listings yet.</p>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <input
                placeholder="Search listings..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 min-w-52 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 focus:border-violet-400 focus:outline-none transition-colors"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {filtered.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <RaffleCard key={item.address} item={item} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-400">No listings matched your filter.</p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">My Ticket Dashboard</h3>
            <p className="mt-1 text-sm text-gray-500">All raffles where you hold tickets.</p>
            {myTickets.length > 0 ? (
              <div className="mt-3 space-y-2">
                {myTickets.map((position) => (
                  <div key={position.address} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div>
                      <p className="font-semibold text-gray-900 font-mono text-xs truncate max-w-48">{position.raffle}</p>
                      <p className="text-gray-500">{position.tickets} ticket{position.tickets !== 1 ? "s" : ""} · {position.spentSol.toFixed(4)} SOL spent</p>
                    </div>
                    <Link href={`/raffle/${position.raffle}`} className="shrink-0 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-600 border border-violet-200 hover:bg-violet-100 transition-colors">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-400">No tickets purchased yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
