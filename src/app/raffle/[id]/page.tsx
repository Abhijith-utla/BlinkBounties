import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RaffleDetailClient } from "@/components/raffle-detail-client";
import { APP_URL, connection, fetchPositionsByRaffle, fetchRaffleByAddress } from "@/lib/solana";

interface Props {
  params: Promise<{ id: string }>;
}

const statusClassName: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  closed: "bg-zinc-200 text-zinc-700",
};

export default async function RafflePage({ params }: Props) {
  const { id } = await params;

  let raffleAddress: PublicKey;
  try {
    raffleAddress = new PublicKey(id);
  } catch {
    notFound();
  }

  const raffle = await fetchRaffleByAddress(raffleAddress);
  if (!raffle) {
    notFound();
  }

  const buyers = await fetchPositionsByRaffle(connection, raffleAddress);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <section className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-black/50">Raffle Listing</p>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <img
            src={raffle.imageUrl || "/next.svg"}
            alt={raffle.title}
            className="h-64 w-full rounded-xl object-cover"
          />
          <div>
            <h1 className="text-3xl font-bold">{raffle.title}</h1>
            <p className="mt-2 text-black/75">{raffle.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-3 py-1 font-semibold ${statusClassName[raffle.status]}`}>
                {raffle.status.toUpperCase()}
              </span>
              <span className="rounded-full bg-black/5 px-3 py-1">
                {raffle.ticketPriceSol.toFixed(4)} SOL / ticket
              </span>
              <span className="rounded-full bg-black/5 px-3 py-1">
                Sold {raffle.soldTickets}/{raffle.maxTickets}
              </span>
              <span className="rounded-full bg-black/5 px-3 py-1">Seller: {raffle.seller}</span>
            </div>

            <div className="mt-4 rounded-xl border border-black/10 bg-black/95 p-4 text-xs text-white">
              <p className="font-semibold text-emerald-300">Action Endpoint</p>
              <code className="mt-2 block overflow-x-auto">{`${APP_URL}/api/actions/raffle/${raffle.address}`}</code>
            </div>
          </div>
        </div>
      </section>

      <RaffleDetailClient raffle={raffle} buyers={buyers} />

      <Link href="/" className="text-sm font-semibold underline">
        Back to marketplace
      </Link>
    </main>
  );
}
