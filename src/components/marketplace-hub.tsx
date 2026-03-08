"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
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

const statusClassName: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  closed: "bg-zinc-200 text-zinc-700",
};

function RaffleCard({ item }: { item: RaffleAccount }) {
  return (
    <Link
      href={`/raffle/${item.address}`}
      className="block rounded-xl border border-black/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-44 w-full rounded-lg object-cover"
        />
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-base font-semibold">{item.title}</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClassName[item.status]}`}>
          {item.status.toUpperCase()}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-black/70">{item.description}</p>
      <div className="mt-3 flex items-center justify-between text-sm">
        <p className="font-semibold">{item.ticketPriceSol.toFixed(4)} SOL / ticket</p>
        <p className="text-black/60">{item.soldTickets}/{item.maxTickets}</p>
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
    return () => {
      cancelled = true;
    };
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

      const simulation = await connection.simulateTransaction(tx, undefined, true);
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
      <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/60">Raffle Market</p>
            <h2 className="mt-1 text-2xl font-bold">Artists list items, fans buy tickets, winners get access</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-xs">
              <p className="text-black/60">Live Balance</p>
              <p className="font-semibold">{balance === null ? "Connect wallet" : `${balance.toFixed(4)} SOL`}</p>
            </div>
            <WalletMultiButton className="!h-10 !rounded-xl !bg-black !text-white" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRole("worker")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${role === "worker" ? "bg-black text-white" : "bg-black/10 text-black"}`}
          >
            User / Buyer
          </button>
          <button
            type="button"
            onClick={() => setRole("poster")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${role === "poster" ? "bg-black text-white" : "bg-black/10 text-black"}`}
          >
            Poster / Seller
          </button>
          <button
            type="button"
            onClick={() => setReloadToken((curr) => curr + 1)}
            className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900"
          >
            Refresh
          </button>
        </div>
      </section>

      {loading ? <p className="text-sm text-black/65">Loading marketplace...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {role === "poster" ? (
        <>
          <section className="rounded-2xl border border-black/10 bg-white/80 p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Create New Raffle Listing</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item title"
                className="h-11 rounded-xl border border-black/15 px-3 text-sm" />
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL"
                className="h-11 rounded-xl border border-black/15 px-3 text-sm" />
              <input value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} placeholder="Ticket price (SOL)"
                className="h-11 rounded-xl border border-black/15 px-3 text-sm" />
              <input value={maxTickets} onChange={(e) => setMaxTickets(e.target.value)} placeholder="Max tickets"
                className="h-11 rounded-xl border border-black/15 px-3 text-sm" />
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the item and raffle rules"
              className="mt-3 min-h-24 w-full rounded-xl border border-black/15 px-3 py-2 text-sm" />
            <button onClick={createListing} disabled={creating}
              className="mt-3 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {creating ? "Creating..." : "Create Raffle Card"}
            </button>
            {createError ? <p className="mt-2 text-sm text-red-600">{createError}</p> : null}
          </section>

          <section className="rounded-2xl border border-black/10 bg-white/75 p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Manage Your Listings</h3>
            <p className="mt-1 text-sm text-black/65">Open a card to review buyers and manage payout.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {posterRaffles.map((item) => (
                <RaffleCard key={item.address} item={item} />
              ))}
            </div>
            {posterRaffles.length === 0 ? <p className="mt-4 text-sm text-black/65">No listings yet.</p> : null}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-black/10 bg-white/75 p-5 shadow-lg">
            <div className="flex flex-wrap gap-2">
              <input
                placeholder="Search listings..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 min-w-52 flex-1 rounded-lg border border-black/15 px-3 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-10 rounded-lg border border-black/15 px-3 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filtered.map((item) => (
                <RaffleCard key={item.address} item={item} />
              ))}
            </div>
            {filtered.length === 0 ? <p className="mt-4 text-sm text-black/65">No listings matched filter.</p> : null}
          </section>

          <section className="rounded-2xl border border-black/10 bg-white/75 p-5 shadow-lg">
            <h3 className="text-lg font-semibold">My Ticket Dashboard</h3>
            <p className="mt-1 text-sm text-black/65">Track all raffles where you bought tickets.</p>
            <div className="mt-3 space-y-2">
              {myTickets.map((position) => (
                <div key={position.address} className="rounded-xl border border-black/10 bg-white p-3 text-sm">
                  <p className="font-semibold">Raffle: {position.raffle}</p>
                  <p>Tickets: {position.tickets}</p>
                  <p>Spent: {position.spentSol.toFixed(4)} SOL</p>
                  <Link href={`/raffle/${position.raffle}`} className="text-sm font-semibold underline">
                    Open listing
                  </Link>
                </div>
              ))}
            </div>
            {myTickets.length === 0 ? <p className="mt-4 text-sm text-black/65">No tickets purchased yet.</p> : null}
          </section>
        </>
      )}
    </div>
  );
}
