# Blink Bounties

Blink Bounties is a trustless escrow bounty marketplace for Solana Actions (Blinks).

## What is included

- Anchor program with escrow logic:
  - `create_bounty`
  - `submit_work`
  - `approve_bounty`
  - `cancel_bounty`
- Next.js app (App Router) with wallet-connected creator dashboard
- Blink endpoints:
  - `GET /actions.json`
  - `GET|POST /api/actions/bounty/[id]`
- Bounty detail page for sharing + creator approval/refund controls

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

3. Set `NEXT_PUBLIC_PROGRAM_ID` to your deployed Anchor program id.

4. Start app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Anchor program

Program source: `programs/blink_bounties/src/lib.rs`

If you have Anchor CLI installed:

```bash
anchor build
anchor deploy
```

Then copy deployed program id into:

- `Anchor.toml` `[programs.testnet].blink_bounties`
- `.env.local` `NEXT_PUBLIC_PROGRAM_ID`

## Blink mapping

`src/app/actions.json/route.ts` maps:

- `/bounty/*` -> `/api/actions/bounty/*`

All Action responses include `ACTIONS_CORS_HEADERS`.
