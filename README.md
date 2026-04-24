# Solana Top Token Holders & Whales API

This repository fetches top token holders and whale wallets for Solana SPL and Token-2022 assets. It includes a production-ready Node.js backend and browser app for holder concentration analysis and whale monitoring workflows.

![Solana Top Token Holders & Whales API](screenshots/solana-top-token-holders-and-whales-api.png)

<p align="center">
  <img src="screenshots/top-token-holders-solana-api.png" alt="Top token holders" width="260" style="min-width:260px;max-width:260px;margin-right:10px;" />
  <img src="screenshots/top-whale-wallets-solana-api.png" alt="Top whale wallets" width="224" style="min-width:224px;max-width:224px;margin-right:10px;" />
  <img src="screenshots/token-holder-distribution-solana-api.png" alt="Token holder distribution" width="260" style="min-width:260px;max-width:260px;" />
</p>

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10

## Quick Start

```bash
git clone https://github.com/<your-org>/solana-top-token-holders-and-whales-api.git
cd solana-top-token-holders-and-whales-api
npm install
cp .env.example .env
# Set VYBE_API_KEY in .env
npm start
```

Then open `http://localhost:3000`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VYBE_API_KEY` | Yes | API key for Vybe requests |
| `SOLANA_RPC_URL` | No | RPC for symbol fallback |
| `PORT` | No | Server port (default `3000`) |
| `TUNNEL` | No | Set `1` to run with Cloudflare Tunnel |

## What This Repo Focuses On

- Top holders via `GET /v4/tokens/{mintAddress}/top-holders`
- Whale concentration tracking (rank, owner, balance, USD value, supply share)
- Token stats and metadata context for holder interpretation
- Trade/program/market summaries to validate holder behavior context

## Main Endpoints Used

- `GET /v4/tokens/{mintAddress}/top-holders`
- `GET /v4/tokens/{mintAddress}`
- `GET /v4/trades`
- `GET /v4/programs/labeled-program-accounts`
- `GET /v4/wallets/top-traders` (secondary context only)

## Project Structure

```text
solana-top-token-holders-and-whales-api/
├── README.md
├── package.json
├── public/
│   ├── index.html
│   ├── app.css
│   └── app.js
└── src/
    ├── server.ts
    ├── api/
    ├── frontend/
    └── types/
```

## Notes

- Keep screenshot files in `screenshots/` with the placeholder names above.
- Replace GitHub clone URL with your final org/user path.
- Get a key at [vybenetwork.com/pricing](https://vybenetwork.com/pricing).

