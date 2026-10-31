# Cufflink

Camera-first personal style check. Point it at a garment, a screenshot or a product link and it answers: is this mine, what does it go with, what does it unlock, what's missing.

Next.js 16 (PWA) · Supabase · Anthropic API. Built from `wardrobe-app-spec` v0.1.

## How it decides

- **Rules live in code, parameters live in the profile.** `src/lib/style/profile.ts` reads `style-profile.md` (palette, avoid list, budget ceiling, priority gaps, well-stocked list, exits, rejected combinations) into a versioned config stored in `style_rules`. Re-import from **Style guide → Update from file**.
- **Deterministic first.** `src/lib/style/rules.ts` runs the hard/soft/bonus rules (§4) and decides the verdict. `src/lib/style/outfits.ts` enumerates outfits in code (§7). The model can't overrule either.
- **Model second.** One extraction call (image → attributes) and one judgement call (reasoning, pairings, outfit names), both schema-validated with a retry. The judgement must cite rule ids, confirmed item ids and enumerated outfit keys, or it falls back to the rules' own text.
- **Nothing is owned until confirmed.** The seeded inventory and folder imports arrive unconfirmed and are invisible to verdicts and outfits until ticked.

The §14 acceptance cases are in `tests/acceptance.test.ts` (`npm test`).

## Setup

Node 22+ (`nvm use` reads `.nvmrc`); the Supabase client needs Node's built-in WebSocket.

The Supabase project is **Cufflink** (`hlnpdgqafcellsydspqw`, Singapore, JL Builds' projects org). It's linked in `supabase/`. The migration is applied, and public sign-ups are disabled in `supabase/config.toml`.

1. **Supabase**: create a project (separate from Groove), then run `supabase/migrations/0001_initial_schema.sql` in the SQL editor. That creates the tables, RLS and the private `wardrobe` bucket. Create your user under Authentication → Users (email + password; there's no public sign-up).
2. **Env**: `cp .env.example .env.local` and fill it in. `ANTHROPIC_MODEL` defaults to `claude-opus-5`.
3. **Seed** the rules and inventory (all unconfirmed) from the Wardrobe folder:
   ```bash
   npm run seed -- --email you@example.com --profile ~/Downloads/Wardrobe/style-profile.md
   ```
4. `npm run dev`, sign in, then **Wardrobe → To confirm**: tick what you actually own.
5. **Optional folder import** (phase 2): extracts every photo in `Tops/ Bottoms/ Dresses/ Shoes/ Accessories/ Sets/ New/` into the review queue (Home → Folder import). There you say which item each photo is, add it as new, or mark it as reference only.
   ```bash
   npm run import-folder -- --email you@example.com --dir ~/Downloads/Wardrobe
   ```
   After confirming items, analyse `Inspiration/` onto the board with `--inspo`.
6. **Deploy**: Vercel, with the same env vars except `SUPABASE_SERVICE_ROLE_KEY` (scripts only).

## Reused from Groove

- Supabase SSR clients and session proxy: `src/lib/supabase/*`, `src/proxy.ts`.
- Private-bucket upload with per-user folder RLS, and signed URLs: `uploadImage` / `signPaths` in `src/lib/data.ts`. This is the `meal-photos` flow pointed at `wardrobe`.
- The read step: lazy Anthropic client and image blocks in `src/lib/ai/client.ts`. Its regex JSON parsing is replaced by structured outputs + zod. User notes are passed **verbatim** (Groove's meal read normalised away qualifiers).

## Phase status

- **Phase 1 (done):** auth, rule config from the profile, Check (photo/screenshot), confirm-attributes, verdict card with Buy/Wishlist/Pass and anchor/climate overrides, manual Add with restrictions, outfit unlock and net-new counts.
- **Phase 2 (done):** folder import with item-by-item confirmation, Inspo analysis and board, Gaps screen with unlock-if-filled counts.
- **Phase 3 (partial):** product links work through a plain fetch with UAE-store resolution and a screenshot fallback. Inditex prices load with JavaScript, so they usually need the screenshot path until headless fetching is added. "I'd wear this / Not for me" already feeds ranking, and the Outfits occasion filter covers a basic "what do I wear". Still to do: headless fetch, Web Share Target, a dedicated Flow D.
