# TMS API Starter (Fastify + Prisma + TypeScript)

This is a minimal API to get you running fast.

## Requirements
- Node.js 20+
- Postgres (Neon or local)
- (Optional) pnpm

## Quick Start
1) Copy `.env.example` to `.env` and set `DATABASE_URL`.
2) Install deps: `npm i` (or `pnpm i`)
3) Push schema: `npm run db:push`
4) Start dev server: `npm run dev`
   - Health: http://localhost:4000/api/health
   - Shipments: `GET /api/shipments`

## Deploy (Render)
- Build: `npm run build`
- Start: `npm start`
- Set env `DATABASE_URL` and (optional) `PORT`
