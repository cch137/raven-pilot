# Raven Pilot

A lightweight coding agent playground: `backend` provides a Hono + LangChain API, and `frontend` provides a SvelteKit interface.

## Requirements

- Node.js + npm
- Configure at least one model API key in `backend/.env`
  - Default model: `ANTHROPIC_API_KEY`
  - Also supported: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`
- Optional: `PORT` or `PORTS` (`3600` by default for the backend)

## Installation

Run this in the project root:

```bash
npm install
```

## Development Startup

Open two terminals and run the following commands separately from the project root:

### 1) Start the backend

```bash
npm run dev:backend
```

- Default address: `http://localhost:3600`
- Provides the REST API, SSE, and agent runtime

### 2) Start the frontend

```bash
npm run dev:frontend
```

- Default address: `http://localhost:5173`
- `/api` is proxied to `http://localhost:3600`

## Other Common Commands

```bash
npm run start:backend
npm run build:frontend
npm run preview --workspace=frontend
```

## Project Structure

- `backend/`: TypeScript + Hono + LangChain
- `frontend/`: SvelteKit + Vite + Tailwind CSS
