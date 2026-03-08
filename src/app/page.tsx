import Link from "next/link";

import { MarketplaceHub } from "@/components/marketplace-hub";
import { PROGRAM_ID, SOLANA_RPC_URL } from "@/lib/solana";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 md:py-14">
      <section className="mb-8 grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-black/60">
            Blink Raffle Market
          </p>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            List raffle items. Sell tickets. Settle instantly on Solana.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-black/75">
            Creators post products with ticket pricing, buyers enter raffles from shared links, and payouts happen on-chain.
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-xs shadow-lg backdrop-blur-sm">
          <p><span className="font-semibold">RPC:</span> {SOLANA_RPC_URL}</p>
          <p className="mt-2"><span className="font-semibold">Program:</span> {PROGRAM_ID.toBase58()}</p>
          <p className="mt-2 text-black/60">Set `NEXT_PUBLIC_PROGRAM_ID` after deploying your Anchor program.</p>
        </div>
      </section>

      <MarketplaceHub />

      <section className="mt-8 rounded-2xl border border-black/10 bg-white/75 p-5 text-sm shadow-lg backdrop-blur-sm">
        <h2 className="text-base font-semibold">Demo Flow</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-black/75">
          <li>Create bounty and copy generated URL.</li>
          <li>Paste link into GitHub issue, Discord, or X.</li>
          <li>Claimant submits work using the Blink input.</li>
          <li>Creator approves on bounty page to release escrow.</li>
        </ol>
        <p className="mt-3">
          Route spec is exposed at{" "}
          <Link className="font-semibold underline" href="/actions.json">
            /actions.json
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
