"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Nav() {
  const { connected, publicKey } = useWallet();

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">BB</span>
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">
            Blink<span className="text-violet-600">Bounties</span>
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search NFTs..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Right: wallet info + connect */}
        <div className="ml-auto flex items-center gap-3">
          {connected && publicKey && (
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600 font-mono">
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </span>
            </div>
          )}
          <WalletMultiButton className="!h-9 !rounded-xl !bg-violet-600 !text-white hover:!bg-violet-700 !text-sm !font-semibold" />
        </div>
      </div>
    </nav>
  );
}
