# User Flow Analytics

A real-time, privacy-first web analytics and security telemetry workspace built with **React + TypeScript + Vite + Tailwind CSS** on the frontend and **Node.js + Express + Server-Sent Events (SSE) + SQLite (`node:sqlite`)** on the backend.

## Features

- **7 Dedicated Pages**:
  - **Dashboard** (`/dashboard`): Traffic & session KPIs, visitor/page-view trends, popular pages, website health, and recent security alerts.
  - **Live Visitor Journey** (`/live`): Left site-page tree, 5 KPI cards, interactive isometric Website Activity Topology (with animated anonymous visitor markers, highlighted selected visitor route, central Database node with separate dashed teal metadata lines, zoom/pan/reset/filter controls, and full legend), right Selected Visitor timeline panel, and bottom searchable/filterable Live Event Flow with Pause/Resume, Step, Reset, and Speed controls.
  - **Visitors** (`/visitors`): Searchable, filterable anonymous session directory with split-pane timeline inspector.
  - **Security Events** (`/security`): Severity summaries, automated anomaly detection (repeated failed logins, unusual request rates, invalid integration keys, disallowed origin domains), and acknowledge/resolve workflow.
  - **Analytics** (`/analytics`): Date-range filtered charts, popular pages, entry/exit pages, and common multi-step page paths.
  - **Site Pages** (`/pages`): Dynamically discovered route registry with inline rename, grouping, visibility toggle, and live route-discovery tester.
  - **Settings** (`/settings`): Multi-site management with strict data isolation, SDK snippet, allowed domains allowlist, masked integration key (reveal/copy/rotate), privacy & retention controls, team access, pause collection, demo stream toggle, and disconnect/reconnect controls.

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start both the backend API/SSE server (port 4000) and Vite dev server (port 5173)
pnpm run dev
```

Open `http://localhost:5173` in your browser.

For a production build:

```bash
pnpm run build
pnpm run start
```

## Connecting a Website

1. Open **Settings** (`/settings`) and select your site (or click **Connect New Site** to create an isolated site workspace).
2. Add your website's domain(s) under **Allowed Domains** (wildcards such as `*.example-site.com` are supported).
3. Copy the lightweight `<script>` snippet and place it in your site's `<head>`:

```html
<script
  src="http://localhost:4000/sdk/ufa.js"
  data-site-id="YOUR_SITE_ID"
  data-key="YOUR_INTEGRATION_KEY"
  defer
></script>
```

4. You can also click **Open Live SDK Sandbox** in Settings (`/demo-site?siteId=...`) to test real browser page loads, SPA navigation (`history.pushState`), dynamic route discovery, and privacy-safe redacted auth metadata immediately.

## How Dynamic Page Discovery Works

- Pages are **never hard-coded**. Whenever a connected website emits a `Page View`, `Session Start`, or `SPA Navigation` event, the backend normalizes the URL path by stripping query strings (`?utm_source=...`) and URL fragments (`#section`), collapsing slashes, and lowercasing the canonical route.
- If the normalized path has not been seen before for that `site_id`, it is automatically inserted into `site_pages`, appears immediately in the **Site Pages** tree and **Topology Canvas**, and increments its view count on every subsequent visit.
- Site owners can rename page labels, organize routes into custom groups, or hide routes from the topology view without altering incoming normalization.
- The SDK detects both traditional page loads (`load`) and single-page-application transitions (`history.pushState`, `history.replaceState`, and `popstate`), connecting events into journeys via anonymous first-party `sessionStorage` IDs (`v_xxxxxxxx`).

## Privacy & Security Architecture

- **Strict Multi-Site Isolation**: Every database table and SSE broadcast channel is partitioned by `site_id`.
- **Ingestion Validation**: `POST /api/v1/collect` verifies `siteId`, compares `integrationKey` in constant time (`crypto.timingSafeEqual`), and checks `Origin`/`Referer` against `allowedDomains`.
- **Zero-PII Collection**: Only safe navigation metadata is accepted and stored. Passwords, form values, payment data, message contents, and keystrokes are never read or persisted.
- **IP Masking**: Visitor IP addresses are masked before storage (`***.***.113.**`) and mapped only to coarse approximate regions.
- **Demo vs. Live Transparency**: Seeded sample records and demo stream events are explicitly labeled **Demo** across the UI so they are never confused with live SDK traffic.
