# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

稻穀烘乾機遠端監控系統 (Rice Dryer Remote Monitoring System) for 大橋米/壽米屋.
Monitors ~10 三久 (Sanjiu) grain dryers + CS-R moisture meters via Modbus RTU over Moxa NPort 5150 serial-to-Ethernet converters.

## Architecture

```
三久乾燥機/水分計 → RS-485 Modbus RTU → Moxa NPort 5150 (TCP Server)
    ↑ Vercel Cron (1min) polls via TCP → parses Modbus RTU frames
    → writes to Supabase (PostgreSQL + Realtime)
    → Next.js PWA dashboard (mobile-first)
    → LINE Messaging API alerts on errors/completion
```

No on-site collector. Vercel API Route connects directly to NPort's public IP via TCP socket, sends raw Modbus RTU frames (with CRC), parses responses.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS + PWA
- **Backend**: Vercel serverless API Routes
- **Database**: Supabase (PostgreSQL + Realtime subscriptions)
- **Protocol**: Modbus RTU over TCP (not Modbus TCP — raw RTU frames through NPort transparent mode)
- **Notifications**: LINE Messaging API (Official Account push/broadcast)

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

## Key Files

- `src/lib/modbus/client.ts` — Raw TCP socket → Modbus RTU frame builder + CRC16 + response parser
- `src/lib/modbus/parser.ts` — Converts raw register values to structured DryerData / MoistureData
- `src/lib/modbus/constants.ts` — Dryer model codes, status codes, error codes, grain types (all from 三久 spec)
- `src/app/api/cron/poll-modbus/route.ts` — Vercel Cron endpoint: polls all devices, upserts status, inserts readings, triggers LINE alerts
- `src/components/dashboard.tsx` — Main PWA dashboard with Supabase Realtime subscriptions
- `supabase/migrations/001_initial_schema.sql` — Full database schema
- `docs/大橋米MODBUS(R2).docx` — Original Modbus register specification from 三久

## Modbus Protocol Details

Two independent communication boards on the same RS-485 bus (daisy-chained), each with its own Modbus slave ID:

| Board | Purpose | Slave ID | Address Pattern | Addr Shift |
|-------|---------|----------|-----------------|------------|
| Board 1 | Dryer status | **0x01** | `00x0H`-`00x4H` (x=device 0-F) | x << 4 |
| Board 2 | CS-R moisture meter | **0x02** | `0x00H`-`0x0FH` (x=device 0-F) | x << 8 |

- NPort 5150A: 1 serial port → both boards share TCP port 4001
- Serial: **9600, 8-N-2** (confirmed by field testing 2026-06-17)
- Only Function 03H (read) and 06H (write) supported
- Max 12 words per read request
- CRC byte order: little-endian (standard Modbus RTU)
- Exception codes: 02H (illegal address), 03H (illegal value), 09H (CRC error)
- RS-485 signal quality ~50-60% CRC pass rate → retry mechanism required

## Environment Variables

See `.env.example`. Critical ones:
- `NPORT_HOST` — Factory's static public IP
- `NPORT_DRYER_PORT` / `NPORT_MOISTURE_PORT` — NPort TCP Server ports (both 4001 for NPort 5150A single-port)
- `MODBUS_DRYER_SLAVE_ID` / `MODBUS_MOISTURE_SLAVE_ID` — Modbus slave addresses (0x01 dryer / 0x02 moisture, set on board DIP switches)
- `CRON_SECRET` — Vercel Cron authentication token
- `LINE_CHANNEL_ACCESS_TOKEN` — LINE Official Account Channel Access Token
- `LINE_CHANNEL_SECRET` — LINE Channel Secret
- `LINE_PUSH_TARGET_ID` — (optional) push target user/group ID; omit to broadcast
