# High-Concurrency Product Management Platform

> **Submission for Full-Stack Product Management Assessment**  
> Engineered with **NestJS**, **Next.js 15**, **MySQL 8.0 (InnoDB)**, **Redis 7.0**, **OpenTelemetry Collector Sidecar**, and orchestrated with **Docker Compose**.  
> Features strict database-level atomic concurrency, role-based access control (RBAC), dual-frontend separation, OpenTelemetry distributed observability, and OWASP Top 10 API hardening.

---

## 🏛️ Comprehensive Architecture & Technical Specifications

> [!IMPORTANT]
> The full database schema, Entity Relationship Diagram (ERD), mathematical CAS concurrency proofs, 4-way concurrency trade-offs analysis, two-phase payment coordination patterns, REST API endpoint contracts, OWASP Top 10 threat modeling, and OpenTelemetry sidecar pipeline are thoroughly documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 📋 Executive Overview & Assessment Requirements

| Requirement | Implementation | Location |
| :--- | :--- | :--- |
| **Backend REST API** | NestJS 11 + TypeORM + multi-cluster connection pooling, JWT authentication, and Zod runtime schema validation. | [`apps/backend`](apps/backend) |
| **Admin Inventory Dashboard** | Next.js 15 application for catalog CRUD, stock replenishment adjustments, live orders feed, and double-entry audit ledger. | [`apps/admin`](apps/admin) |
| **User-Facing Storefront** | Next.js 15 customer application featuring live stock badges, responsive catalog, shopping cart, and interactive concurrency simulator. | [`apps/storefront`](apps/storefront) |
| **Role-Based CRUD Endpoints** | Strictly guarded by NestJS `RolesGuard` (`@Roles('ADMIN')`) with bcrypt password hashing and stateless JWT verification. | [`apps/backend/src/modules`](apps/backend/src/modules) |
| **Anti-Overselling Concurrency** | Database-level **Atomic Conditional Update** (`UPDATE ... WHERE stock >= :qty`) within InnoDB row transactions. | Verified via 100-user stress test: **0 oversold**. |
| **Architecture & Trade-offs** | Exhaustive technical deep-dive into schema, concurrency, trade-offs, and observability. | **[ARCHITECTURE.md](ARCHITECTURE.md)** |

---

## 🚀 Live Service Access Points

| Service | Port | Access URL | Role & Features |
| :--- | :---: | :--- | :--- |
| **Customer Storefront** | `3000` | [http://localhost:3000](http://localhost:3000) | Public catalog, stock badges, 1-click checkout, customer order receipts |
| **Flash Sale Concurrency Lab** | `3000` | [http://localhost:3000/simulator](http://localhost:3000/simulator) | Interactive in-browser multi-user flash sale stress test simulator |
| **Admin Inventory Dashboard** | `3001` | [http://localhost:3001](http://localhost:3001) | Dedicated back-office console, product CRUD, restock modal, audit log inspector |
| **NestJS Backend REST API** | `4000` | [http://localhost:4000](http://localhost:4000) | Core business engine, order execution, auth, and audit ledger |
| **Swagger / OpenAPI Documentation** | `4000` | [http://localhost:4000/api/docs](http://localhost:4000/api/docs) | Complete interactive API explorer with JWT Bearer authorization sandbox |
| **OpenTelemetry Sidecar Collector** | `4318` | `http://localhost:4318` | Official OTel sidecar; inspect live telemetry via `docker logs mandai_otel_collector -f` |

---

## 👥 Pre-Seeded Test Accounts

The database automatically seeds these accounts on initial container startup via [`scripts/init-db.sql`](scripts/init-db.sql):

| Role | Email | Password | Permissions & Scope |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@example.com` | `AdminPass123!` | Full catalog CRUD, stock adjustment with audit logs, orders feed. |
| **CUSTOMER** | `customer@example.com` | `CustomerPass123!` | Public catalog browsing, order purchase (`/orders/buy`), order receipts. |

> [!TIP]
> Both frontend applications (`apps/storefront` and `apps/admin`) feature a **1-Click Quick Demo Login** button in the navigation header, allowing instant testing without typing credentials.

---

## ⚡ Quickstart (One-Command Setup via Docker Compose)

To build and spin up the complete containerized stack (MySQL, Redis, Backend, Storefront, Admin, and OpenTelemetry Sidecar):

```bash
docker compose up --build
```

### Validating Container Health
```bash
docker compose ps
```
All 6 containers should report `Up` or `Up (healthy)`.

---

## 💻 Local Standalone Development (Without Docker)

If you prefer to run services natively on your local machine:

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **MySQL**: `8.0` running locally on port `3306` (Database: `product_db`)
- **Redis**: `7.x` running locally on port `6379`

### 2. Installation
From the root repository directory:
```bash
npm install
npm run install:all
```

### 3. Database Initialization
Execute [`scripts/init-db.sql`](scripts/init-db.sql) against your local MySQL instance:
```bash
mysql -u root -p product_db < scripts/init-db.sql
```

### 4. Running the Applications
Start each application in separate terminal windows:
```bash
# 1. Start NestJS Backend (Port 4000)
npm run start:dev --prefix apps/backend

# 2. Start Customer Storefront (Port 3000)
npm run dev --prefix apps/storefront

# 3. Start Admin Dashboard (Port 3001)
npm run dev --prefix apps/admin
```

---

## 📁 Monorepo Project Structure

```text
mandai_assessment/
├── apps/
│   ├── backend/               # NestJS 11 REST API
│   │   ├── src/
│   │   │   ├── common/        # LoggerService, RedisService, BaseRepository, ALS Context
│   │   │   ├── config/        # Environment, Database, Redis configurations
│   │   │   ├── core/          # OTel setup, Filters, Interceptors, DatabaseClusters
│   │   │   └── modules/       # Auth, Products, Orders, Inventory modules
│   │   ├── test/              # Unit, E2E, and OWASP Security test suites
│   │   └── Dockerfile
│   ├── storefront/            # Next.js 15 Customer Application (Port 3000)
│   │   ├── src/app/           # Catalog, Cart, Checkout, Simulator pages
│   │   └── Dockerfile
│   └── admin/                 # Next.js 15 Back-Office Console (Port 3001)
│       ├── src/app/           # Products CRUD, Restock Modal, Audit Logs, Orders
│       └── Dockerfile
├── docker/
│   └── otel-collector-config.yaml # OpenTelemetry Collector sidecar pipeline config
├── scripts/
│   ├── init-db.sql            # Seed data & engine-level CHECK constraints
│   └── stress-test.js         # 100-user automated parallel concurrency benchmark
├── ARCHITECTURE.md            # Comprehensive Master Technical Architecture Specification
├── docker-compose.yml         # 6-container production orchestration
└── package.json               # Monorepo scripts, Husky, Lint-Staged
```

---

## 🧪 Comprehensive Automated Test Suites

The platform includes **11 test suites with 72 automated tests (100% PASS rate)**:

```bash
# Run all unit and integration tests across the backend
npm run test:all --prefix apps/backend

# Run unit tests only (Services, DatabaseManager, LoggerService)
npm run test:unit --prefix apps/backend

# Run End-to-End integration tests (Auth, Products, Orders)
npm run test:e2e --prefix apps/backend

# Run OWASP Security & Concurrency validation suites
npm run test:security --prefix apps/backend
```

### Executing the 100-User Parallel Stress Test Benchmark
To verify that the database-level **Atomic Conditional Update** strictly prevents overselling under heavy parallel load (100 simultaneous requests competing for 10 units of stock):

```bash
npm run test:concurrency
```
*(Or directly: `node scripts/stress-test.js`)*

#### Benchmark Result:
- **100 Concurrent Requests** dispatched at the exact same millisecond.
- **Total Batch Execution Time**: **452 ms**.
- **Successful Purchases**: Exactly **10** (`HTTP 201 Created`).
- **Blocked Over-Requests**: Exactly **90** (`HTTP 409 Conflict - Out of Stock`).
- **Final Database Stock**: Exactly **0** (never negative).
- **Audit Trail**: Every purchase atomically recorded in `inventory_logs`.

---

## 🛡️ DevSecOps & Code Quality Toolchain

- **ESLint**: Zero lint errors enforced across all apps (`npm run lint`).
- **Prettier**: Consistent formatting across all TypeScript, TSX, JSON, and Markdown files (`npm run format`).
- **Husky & Lint-Staged**: Git hooks automatically format and lint staged files on every `git commit`.
- **Zod Runtime Validation**: Payload integrity enforced at runtime using `nestjs-zod` `.strict()` DTOs.
