"use client";

import { useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Nav } from "./nav";
import { WinnerModal } from "./winner-modal";

interface Listing {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  ticketPriceSol: number;
  maxTickets: number;
  soldTickets: number;
  status: "open" | "closed";
  category: string;
  endsIn: string;
  owner: string;
  creator: string;
}

const LISTINGS: Listing[] = [
  {
    id: "1",
    title: "CryptoPunk #3841",
    description: "Rare alien CryptoPunk with 3 attributes. One of only 9 alien punks ever minted. Historic piece of NFT culture.",
    imageUrl: "https://substackcdn.com/image/fetch/$s_!l7dH!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F52c18f05-0251-463f-8128-8add0c4ee71c_600x600.png",
    ticketPriceSol: 0.5,
    maxTickets: 50,
    soldTickets: 32,
    status: "open",
    category: "Collectibles",
    endsIn: "2 days",
    owner: "BL3NK",
    creator: "SOL42",
  },
  {
    id: "2",
    title: "Bored Ape #7304 — Gold Fur",
    description: "BAYC gold fur ape with laser eyes and captain's hat. One of the rarest trait combos in the collection.",
    imageUrl: "https://backend.artreview.com/wp-content/uploads/2021/11/cryptopunks-1230x1230.jpg",
    ticketPriceSol: 0.1,
    maxTickets: 20,
    soldTickets: 14,
    status: "open",
    category: "Collectibles",
    endsIn: "5 days",
    owner: "5811EX",
    creator: "45TY87",
  },
  {
    id: "3",
    title: "Azuki #1199 — Red Bean",
    description: "Iconic Azuki Red Bean with samurai armor and cherry blossom background. Top 1% rarity score.",
    imageUrl: "https://dailycoin.com/wp-content/uploads/2024/04/Solana_NFTs_Gorilla_Ape_Question_Wireframe_Crypto_web.jpg",
    ticketPriceSol: 0.08,
    maxTickets: 200,
    soldTickets: 187,
    status: "open",
    category: "PFP",
    endsIn: "12 hours",
    owner: "23WCFV",
    creator: "ST5664",
  },
  {
    id: "4",
    title: "Fidenza #313 by Tyler Hobbs",
    description: "Generative art masterpiece from the Fidenza collection. Bold curves, warm palette. Museum-grade provenance.",
    imageUrl: "https://static01.nyt.com/images/2021/03/11/arts/11nft-explain-1/merlin_184196631_939fb22d-b909-4205-99d9-b464fb961d32-articleLarge.jpg?quality=75&auto=webp&disable=upscale",
    ticketPriceSol: 0.5,
    maxTickets: 30,
    soldTickets: 11,
    status: "open",
    category: "Gen Art",
    endsIn: "7 days",
    owner: "ASD452",
    creator: "WER266",
  },
  {
    id: "5",
    title: "Doodle #6914 — Rainbow",
    description: "Ultra-rare rainbow Doodle with cosmic background. One of the most sought-after traits in the entire collection.",
    imageUrl: "https://hips.hearstapps.com/hmg-prod/images/nft-1-1614978591.jpg?crop=0.5xw:1xh;center,top&resize=640:*",
    ticketPriceSol: 0.06,
    maxTickets: 75,
    soldTickets: 75,
    status: "closed",
    category: "Art",
    endsIn: "Ended",
    owner: "OPI908",
    creator: "34DR56",
  },
  {
    id: "6",
    title: "Pudgy Penguin #4028",
    description: "Chubby penguin with pirate hat and gold chain. Top 5% rarity. One of the most beloved NFT collections.",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTPNsXhWI5yCBUXDzuFM2QnLm3k25HuWiODjA&s",
    ticketPriceSol: 0.07,
    maxTickets: 150,
    soldTickets: 89,
    status: "open",
    category: "Collectibles",
    endsIn: "3 days",
    owner: "NFT7X",
    creator: "PG52K",
  },
  {
    id: "7",
    title: "DeGod #2271 — Y00t Trait",
    description: "DeGod with the ultra-rare Y00t trait. Legendary rarity tier. Staked and earning $DUST daily.",
    imageUrl: "https://futurism.com/wp-content/uploads/2022/01/artists-hate-nfts.jpg?quality=85&w=1152",
    ticketPriceSol: 0.09,
    maxTickets: 60,
    soldTickets: 38,
    status: "open",
    category: "PFP",
    endsIn: "4 days",
    owner: "DG11M",
    creator: "Y00T3",
  },
  {
    id: "8",
    title: "Ringers #109 by Dmitri Cherniak",
    description: "Art Blocks Curated Ringers — long string wrapping. One of the most iconic generative art pieces on-chain.",
    imageUrl: "https://www.journalofaccountancy.com/wp-content/uploads/sites/3/2022/10/nfts-640x388.jpg",
    ticketPriceSol: 0.12,
    maxTickets: 25,
    soldTickets: 7,
    status: "open",
    category: "Gen Art",
    endsIn: "10 days",
    owner: "RNG09",
    creator: "ART4B",
  },
];

const CATEGORIES = ["All", "Collectibles", "PFP", "Gen Art", "Art"];

const AVATAR_COLORS = [
  "from-violet-400 to-blue-500",
  "from-orange-400 to-pink-500",
  "from-green-400 to-teal-500",
  "from-yellow-400 to-orange-500",
  "from-pink-400 to-rose-500",
  "from-cyan-400 to-blue-500",
];

function avatarColor(seed: string) {
  const idx = seed.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function ListingCard({ listing, onCardClick }: { listing: Listing; onCardClick: () => void }) {
  const progressPct = Math.min(100, (listing.soldTickets / listing.maxTickets) * 100);

  return (
    <button
      onClick={onCardClick}
      className="group block w-full overflow-hidden rounded-2xl bg-white text-left shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 focus:outline-none"
    >
      {/* Owner / Creator row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${avatarColor(listing.owner)} flex items-center justify-center shrink-0`}>
            <span className="text-white text-xs font-bold">{listing.owner[0]}</span>
          </div>
          <div>
            <p className="text-xs text-gray-400 leading-none">Owned by</p>
            <p className="text-xs font-bold text-gray-900 leading-tight">{listing.owner}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-gray-400 leading-none">Created by</p>
            <p className="text-xs font-bold text-gray-900 leading-tight">{listing.creator}</p>
          </div>
          <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${avatarColor(listing.creator)} flex items-center justify-center shrink-0`}>
            <span className="text-white text-xs font-bold">{listing.creator[0]}</span>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm">
            {listing.category}
          </span>
        </div>
        {listing.status === "closed" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rotate-[-25deg] rounded border-4 border-red-500 px-4 py-1 text-3xl font-black uppercase tracking-widest text-red-500 opacity-90 shadow-lg">
              SOLD
            </span>
          </div>
        ) : (
          <div className="absolute top-2 right-2">
            <span className="rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* Title + price */}
      <div className="px-4 pt-3 pb-2">
        <p className="font-bold text-gray-900 text-sm truncate">{listing.title}</p>
        <div className="mt-1.5 mb-2">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{listing.soldTickets} sold</span>
            <span>{listing.maxTickets} max</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xs text-gray-400">Price:</span>
          <span className="text-sm font-bold text-gray-900">SOL {listing.ticketPriceSol}</span>
          <span className="text-xs text-gray-400">× 1</span>
          <span className="ml-auto text-xs text-gray-500">{listing.endsIn}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 px-4 pb-4">
        <button className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          View history
        </button>
        {listing.status === "open" ? (
          <button className="flex-1 rounded-xl bg-gray-900 py-2 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
            Buy Ticket
          </button>
        ) : (
          <button className="flex-1 rounded-xl bg-gray-200 py-2 text-xs font-semibold text-gray-400 cursor-default">
            Sold Out
          </button>
        )}
      </div>
    </button>
  );
}

export function LandingPage() {
  const { setVisible } = useWalletModal();
  const [winnerListing, setWinnerListing] = useState<Listing | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  function handleCardClick(listing: Listing) {
    if (listing.status === "closed") {
      setWinnerListing(listing);
    } else {
      setVisible(true);
    }
  }

  const filtered = activeCategory === "All"
    ? LISTINGS
    : LISTINGS.filter((l) => l.category === activeCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      {/* Page header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">NFT Marketplace</h1>
              <p className="text-sm text-gray-500 mt-0.5">Enter raffles. Win exclusive NFTs on Solana.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-700">Live</span>
            </div>
          </div>

          {/* Category pills */}
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  activeCategory === cat
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listings grid */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onCardClick={() => handleCardClick(listing)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-gray-400">No listings in this category yet.</p>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-6 mt-4">
        <div className="mx-auto max-w-7xl flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">BB</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              Blink<span className="text-violet-600">Bounties</span>
            </span>
          </div>
          <p className="text-xs text-gray-400">© 2026 BlinkBounties. Trustless NFT raffles on Solana.</p>
        </div>
      </footer>

      {winnerListing && (
        <WinnerModal
          nftTitle={winnerListing.title}
          nftImage={winnerListing.imageUrl}
          onClose={() => setWinnerListing(null)}
        />
      )}
    </div>
  );
}
