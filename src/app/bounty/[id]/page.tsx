import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BountyActions } from "@/components/bounty-actions";
import { APP_URL, fetchBountyByAddress } from "@/lib/solana";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

const statusClassName: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  submitted: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

export default async function BountyPage({ params }: Props) {
  const { id } = await params;

  let bountyAddress: PublicKey;
  try {
    bountyAddress = new PublicKey(id);
  } catch {
    notFound();
  }

  const bounty = await fetchBountyByAddress(bountyAddress);
  if (!bounty) {
    notFound();
  }

  const actionEndpoint = `${APP_URL}/api/actions/bounty/${bounty.address}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <section className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-black/50">Bounty Detail</p>
        <h1 className="mt-2 text-3xl font-bold">{bounty.amountSol.toFixed(3)} SOL</h1>
        <p className="mt-4 text-black/80">{bounty.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <span className={`rounded-full px-3 py-1 font-semibold ${statusClassName[bounty.status]}`}>
            {bounty.status.toUpperCase()}
          </span>
          <span className="rounded-full bg-black/5 px-3 py-1">Creator: {bounty.creator}</span>
          {bounty.claimant ? <span className="rounded-full bg-black/5 px-3 py-1">Claimant: {bounty.claimant}</span> : null}
        </div>

        {bounty.workUrl ? (
          <p className="mt-4 text-sm">
            Work URL: <a className="font-semibold underline" href={bounty.workUrl}>{bounty.workUrl}</a>
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-black/10 bg-black/95 p-4 text-xs text-white">
          <p className="font-semibold text-emerald-300">Action Endpoint</p>
          <code className="mt-2 block overflow-x-auto">{actionEndpoint}</code>
        </div>
      </section>

      <BountyActions bounty={bounty} />

      <Link href="/" className="text-sm font-semibold underline">
        Back to dashboard
      </Link>
    </main>
  );
}
