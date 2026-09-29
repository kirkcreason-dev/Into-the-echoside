# Release verification — September 29, 2026

This release corrects the earlier development build; it is not a claim of publisher certification or perfect rules fidelity.

## Automated checks

All 64 checks passed; both Pages and Worker builds completed.

- Base component counts; beginner exclusions; deterministic first-player rolls.
- Invalid actions leave the source state unchanged; choices replay deterministically.
- Room membership, host privileges, private hand/draft/deck views, stale revisions, four-seat teams and server-view validation.
- Guided tutorial progression, leaving guidance, and isolation from ordinary matches.
- Juggalo cycle limit; protected Flavor; copied Juggalo and Item effects; Soopa Soaka timing; counter-stomps; Fiend targets and lifetime; team gifts and enemy targeting.
- Epic-point scoring ties, printed Crew scoring, Fast purchase/Item interrupts, Mirror draw quantity, Jacob's Word Karma, Gallery replacement boundaries and multiple My Axe effects.
- All 40 Gambits: draft budgets, privacy, one-use removal, legal effect resolution, reaction limits, private final points and Ninja Speed.
- Host backups preserve pending drafts and deterministic continuation; imported card definitions are canonicalized; malformed backups are rejected.
- Clock expiry rejects early claims and advances a stalled match.
- Thirty complete base/Oracle games and six Gambit games across two, three and four seats check conservation and equal final turn counts.

## Browser verification

Two independent browser origins were used as host and guest. Verified room creation, invitation join, private sequential Gambit drafts, shared Tarot setup choices, one-use free recruitment, synchronized table state, turn handoff, host/guest reload recovery, recovery of the guest seat on a fresh browser origin, and narrow-screen card rendering. Browser console errors were checked.

## Limits

The original base manual was recovered. Oracle verification uses physical-card video and narrated rulebook examples; exact Epic setup and uncommon timings remain open. Clean Gambit artwork and six printed names remain unavailable at reliable quality. See README.md and SOURCES.md.

GitHub Pages rooms require an online host tab and a working direct WebRTC connection. Backups and recovery keys support manual recovery; there is no automatic host migration, dedicated relay, account system or always-on game server. Automated simulations do not prove every possible card interaction.

## Version 0.3.0 additions

- All four base variants: legal setup, Unity replacement, custom Epic supplies, Main-only ending, top-card privacy, shared Relic ownership/activation/cleanup and room projection.
- Shovel/Mirror, full discard shuffle/Flying Guillotine, copied Sideshow, and Ninja Speed setup ordering regressions.
- Eight reproducible practice scripts checked against explicit outcome assertions. Kit positions use physically available cards and deck order is printed top first.
- Large card inspection, required-choice inspection, contextual reactions, persistent sound, mobile controls and reduced motion.
- Browser checks cover variant creation, Relic activation, visible deck tops, enlarged printed cards, Oracle scenario resolution, and a 390-pixel mobile layout.

Human physical sessions remain outstanding. The comparison form downloads a replayable report locally and sends nothing automatically.

## Version 0.3.1 additions

- Juggalo Army setup checked at two, three and four seats: exactly three chosen Starters removed, one recruitment per seat in each of three rounds, no repeated physical card, correct remaining supply, separate draft/game rolls and hidden deck order.
- Wrong-seat and incomplete choices rejected. Each setup prompt survives host backup restoration and produces the same continuation as the live transaction.
- Three complete Army/Gambit/Relic games conserve all physical cards and finish with equal turn counts.
- Optional Gambits checked for solo, online, restored lobbies and older saved lobbies.
- Empty draw-discard, abolish-draw and Fiend mulligan effects do not offer false Mirror draw reactions.
- Oracle setup and reference-capture checklist added to the downloadable kit.

Browser v0.3.1 checks: Oracle Gambit switch, Juggalo Army starter selection, grouped Crew choices and remaining supplies, enlarged Crew card text, three recruitment rounds, reload during a pending draft, initial Tarot continuation, and the playable table at 390 px. No console errors were reported during that check.
