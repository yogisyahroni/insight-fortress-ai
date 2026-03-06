# DataLens - Enterprise AI Analytics Platform

DataLens is a full-stack, enterprise-grade Data Analytics and Business Intelligence (BI) platform. It empowers un-technical users to translate raw database records into strategic insights using advanced Artificial Intelligence (Natural Language to SQL).

Engineered for performance and scalability, the application leverages a high-performance **Golang** backend and a reactive **React/TypeScript** frontend. It is specifically designed to handle complex data workflows, ranging from raw data ingestion and ETL processing to automated AI-driven reporting.

---

## 🌟 Key Capabilities

### 1. AI-Powered Data Analyst (NL2SQL)

DataLens natively integrates with Large Language Models (LLMs) to construct a localized, intelligent data analyst.

- **System Prompt Engineering**: The AI operates using combined personas (`Data Engineer` for precise SQL translation & `Data Scientist` for anti-hallucination analysis).
- **Context Grounding**: The AI is injected with real database schemas and sample data rows, ensuring the generated SQL queries are syntax-perfect and immune to hallucinations.
- **Server-Sent Events (SSE)**: Delivers a ChatGPT-like streaming experience directly to the frontend for real-time reporting without blocking the main HTTP thread.

### 2. Multi-Tier Database & Hybrid Architecture

The backend is configured to support dual relational environments concurrently:

- **Primary Database**: Local PostgreSQL for core transactional metadata (Users, KPIs, Dashboard layouts).
- **Data Warehouse**: Remote Supabase PostgreSQL (via IPv4 Connection Pooler) for storing massive user datasets.
- **Caching & Sessions**: Utilizing **Redis** for blazingly fast JWT refresh-token storage and API rate-limiting.

### 3. Visual ETL Pipeline Builder

DataLens abstracts complex SQL transformations through a node-based visual pipeline. Users can ingest data from external connections or CSV/JSON uploads (stored in **MinIO / S3-compatible storage**) and route them to multiple transformation nodes before mapping them into the final structured warehouse table.

### 4. Advanced Security Model

- **AES-256-GCM Encryption**: User's OpenAI API Keys are stored completely encrypted at rest within the database. The plain key never leaves the backend server; all LLM network calls are proxied securely.
- **Stateless & Stateful Auth**: Employs short-lived JWTs (Access Tokens) alongside Redis-backed HTTP-Only cookies (Refresh Tokens) to thwart XSS and CSRF attacks.
- **Role-Based Access Control (RBAC)**: Enforces precise API security depending on user roles (Admin vs. Standard User).

---

## 🏗️ Technical Architecture

### Backend (Golang)

The core REST API and AI orchestrator.

- **Framework**: [Fiber](https://gofiber.io/) v2 (Built on top of Fasthttp, the fastest HTTP engine for Go)
- **Database ORM**: [GORM](https://gorm.io/)
- **Authentication**: `golang-jwt` + `bcrypt`
- **Cache**: `go-redis/v9`

### Frontend (React & TypeScript)

A highly polished, responsive, and optimistic user interface built meticulously with accessibility in mind.

- **Build Tool**: Vite
- **UI Components**: Shadcn UI + Tailwind CSS (Generous white-spacing, Inter typography, glass-morphism effects)
- **State Management**: TanStack Query (React Query) for server-state caching + Zustand for client-state handling.
- **Charts & Visualization**: Recharts tailored with customized tooltips and responsive containers.
- **Routing**: React Router DOM (v6)

---

## 🚀 Deployment & Testing

This project incorporates a robust CI/CD pipeline validated through GitHub Actions.

- **Frontend**: Successfully deployed globally via **Vercel** Edge Network.
- **Backend API**: Deployed on **Render.com** utilizing native Docker builds.
- **Quality Assurance**:
  - 70% Unit Coverage on critical business logic (Auth Handler, Validation, Password Hashing).
  - 100% Go Build & NPM Build pass rates.
  - Smoke tests connected to temporary PostgreSQL services within the pipeline.

## 🛠️ Local Setup Guide

If you wish to spin up DataLens on your local workstation, ensure you have **Go 1.23+**, **Node.js 18+**, and **PostgreSQL/Redis**.

### 1. Backend Initialization

```bash
# Navigate to the API directory
cd datalens-backend

# Duplicate the env template and fill your credentials
cp .env.example .env

# Install Go dependency graphs
go mod tidy

# Run the development server
go run cmd/server/main.go
```

*API will run on `http://localhost:8080/api/v1`*

### 2. Frontend Initialization

```bash
# Return to the repo root
cd ..

# Install accurate dependency trees
npm install

# Start the Vite HMR Server
npm run dev
```

*Application will be accessible via `http://localhost:5173`*
