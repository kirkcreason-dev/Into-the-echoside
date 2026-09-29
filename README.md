# Into the Echoside — Digital Game Table

Play at [the GitHub Pages table](https://kirkcreason-dev.github.io/Into-the-echoside/).

A community digital adaptation with the base game, Oracle cards, all 40 Gambit effects, a guided tutorial, solo practice, 2–4 player online rooms, and four-player team games. Original game by Jumpsteady and Louis Simpson; original artwork by Tom Wood. This is not an official publisher release or a certified exact replica.

## Play

Start with **Learn to play · guided game**, play against the Void, or create an online room and share its invitation. Choose the beginner base game, advanced base game, or base plus Oracle. In team games, seats 1 + 3 face seats 2 + 4.

Oracle tables deal ten private Gambit choices to each player with a three-point selection budget. Selected Gambits remain separate from the deck. Use each once at its stated time; reaction Gambits appear automatically at eligible windows. Unreadable printed names use identified descriptive labels. Their effects and draft costs were checked against visible physical cards.

## Online rooms and recovery

GitHub Pages uses PeerJS/WebRTC connections. The host validates moves and stores the full match in IndexedDB; other players receive only their permitted view. Keep the host's tab open. The host can see full underlying state, so use a trusted host. Some restrictive networks block direct connections; no dedicated TURN relay is configured.

Rooms offer a two-, three-, or five-minute action clock, or no clock. When a clock expires, the game passes the turn or makes a required minimum choice. Each unfinished choice is saved and resumes after a reload.

The **Table menu** provides:

- A private seat recovery key for rejoining from another device while the host is online.
- A downloadable host backup containing the entire table, including pending choices.
- Backup restoration on another device. Close the old host tab before restoring an online table.
- Public player areas, Items, Fiends, played cards and discard piles.

Keep recovery keys and backups private. Each room uses its own seat credential. The same browser can reconnect automatically. There are no accounts, public matchmaking, chat, or unattended cloud-hosted rooms in the GitHub edition.

## Rules and reference status

The archived original base-game manual was recovered and used to correct first-player rolls, beginner components, turn cleanup, Juggalo cycling, Flavor protection, Fiend declarations, stomp counters, copying Items/Juggalos, team targeting/gifts, final rounds and scoring ties. See [SOURCES.md](SOURCES.md).

The content library has 196 original scanned definitions plus 40 Gambits. Five promo definitions remain library-only. The advanced base Main Deck contains 107 cards; the beginner Main Deck contains 83.

Remaining fidelity limits are explicit:

- No complete readable Oracle manual was located. The current Epic setup uses 11/13/15 cards for 2/3/4 players; that expansion count is not independently verified.
- Ten Gambit choices and a three-point budget are demonstrated for two players. Applying the same deal to three and four players is an implementation assumption.
- Fast/Mirror behavior follows visible card text and narrated book examples. Uncommon priority interactions and starting-Tarot details still need the full manual.
- Four Gambit names are legible; the remaining 36 use descriptive names and text-based card faces.
- Optional base variants other than team play (Abolish Made Easy, A Matter of Time, House of Mirrors and Relic of Power) are not included.

No publishing license or publisher endorsement is asserted.

## Develop and publish

Use Node.js 22 or newer.

```sh
npm install
npm test
npm run build:pages
```

Serve the repository root with any static HTTP server. Root `index.html`, `.nojekyll`, and `public/pages-bundle.js` support the repository's **main / (root)** GitHub Pages setting. Commit the generated bundle with source changes. `pages-dist/` is an ignored standalone static export.

The optional Worker/D1 transport uses the same room rules as Pages. Run `npx wrangler d1 migrations apply echoside-matches --local`, then `npm run dev`. `npm run build` generates its output. It needs D1 binding `DB` and assets binding `ASSETS`. The separately hosted private version is not the public GitHub edition.

## Verification

The automated suite covers permissions, hidden views, deterministic pending-choice replay, invalid/stale actions, tutorial progression, printed rule regressions, all implemented card effects, Gambit costs/drafts/timing/scoring, backups and clocks. It runs 30 complete base/Oracle games plus six complete Gambit games across 2–4 seats, checking card conservation and equal final turn counts.

Browser checks cover private online drafts, synchronized recruitment and turn handoff, reconnecting after reload, the repaired Gambit controls, and narrow-screen rendering. See [VALIDATION.md](VALIDATION.md) for release checks and practical limits.
