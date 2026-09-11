# StellarSplit Monorepo

**Split bills instantly with crypto. No awkward conversations.**

StellarSplit is a mobile-friendly web app that makes splitting bills with friends effortless. Snap a photo of your receipt, let AI do the math, and settle up instantly using Stellar's lightning-fast payments in XLM or USDC.

## 📁 Repository Structure

This repository is organized as a **monorepo** with multiple distinct services:

| Package                         | Purpose                                                             | Tech Stack                                   |
| ------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| **[/frontend](./frontend)**     | React web dashboard for users to create, track, and settle splits   | React 19, TypeScript, TailwindCSS v4, Vitest |
| **[/backend](./backend)**       | NestJS REST API that manages split data, payments, and integrations | NestJS, TypeORM, PostgreSQL                  |
| **[/contracts](./contracts)**   | Soroban smart contracts for on-chain escrow and payouts             | Rust / Soroban                               |
| **[/ml-service](./ml-service)** | Python ML service for receipt OCR and item extraction               | Python, TensorFlow                           |
| **[/docs](./docs)**             | Comprehensive architecture, API, and deployment documentation       | Markdown                                     |

For a detailed breakdown, see **[docs/repository-map.md](./docs/repository-map.md)**.

## 📚 Documentation

- **[Repository Map](./docs/repository-map.md)**: Detailed guide to every package and directory
- **[API Reference](./docs/API.md)**: Complete API endpoint documentation with validated payloads
- **[Authentication Guide](./docs/AUTHENTICATION.md)**: JWT and development bypass headers
- **[Component Catalog](./docs/COMPONENTS.md)**: Reusable frontend components and hooks
- **[Receipt Flow](./docs/RECEIPT_FLOW.md)**: End-to-end OCR and receipt processing guide
- **[Data Provenance](./docs/data-provenance.md)**: Status of live vs. mock data across the app
- **[Stellar Integration](./docs/STELLAR_INTEGRATION.md)**: Soroban contract usage and wallet connection
- **[Deployment Guide](./docs/DEPLOYMENT.md)**: Production deployment and environment setup

## 🚀 Quick Start

Each package has its own development setup. Navigate to the package directory and run the local dev command:

### Frontend (React Dashboard)

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:5173** by default.

### Backend (NestJS API)

```bash
cd backend
npm install
npm run start:dev
```

Runs at **http://localhost:3001** by default.

### Soroban Contracts

```bash
cd contracts
cargo build --release
```

### ML Service (Receipt OCR)

```bash
cd ml-service
pip install -r requirements.txt
python -m app
```

## 🐳 Docker

A `docker-compose.yml` is included for spinning up PostgreSQL and other shared services:

```bash
docker-compose up
```

## 🛠 Prerequisites

- **Node.js** 18+
- **npm** 9+
- **PostgreSQL** 14+ (or use docker-compose)
- **Rust** 1.75+ (for contract work)
- **Python** 3.9+ (for ML service)

## 🌍 Environment

Development environment files use `.env.local` (git-ignored) for secrets. See individual package READMEs for required environment variables.

## 📦 Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS v4, Vitest, i18next
- **Backend**: NestJS, TypeORM, PostgreSQL, Bull (queues), pino (logging)
- **Smart Contracts**: Soroban, Rust
- **ML**: TensorFlow, Python
- **Blockchain**: Stellar Network (XLM, USDC)

---

Built for the Stellar Drips Wave Program.

For contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).
