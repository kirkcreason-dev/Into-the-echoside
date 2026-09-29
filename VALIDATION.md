# Release verification — September 29, 2026

This release corrects the earlier development build; it is not a claim of publisher certification or perfect rules fidelity.

## Automated checks

All 48 checks passed; both Pages and Worker builds completed.

- Base component counts; beginner exclusions; deterministic first-player rolls.
- Invalid actions leave the source state unchanged; choices replay deterministically.
- Room membership, host privileges, private hand/draft/deck views, stale revisions, four-seat teams and server-view validation.
- Guided tutorial progression, leaving guidance, and isolation from ordinary matches.
- Juggalo cycle limit; protected Flavor; copied Juggalo and Item effects; Soopa Soaka timing; counter-stomps; Fiend targets and lifetime; team gifts and enemy targeting.
- Epic-point scoring ties, printed Crew scoring, Fast purchase/Item interrupts, Mirror draw quantity, Jacob's Word Karma, Gallery replacement boundaries and multiple My Axe effects.
- All 40 Gambits: draft budgets, privacy, one-use removal, legal effect resolution, reaction limits, private final points and Initial Speed.
- Host backups preserve pending drafts and deterministic continuation; imported card definitions are canonicalized; malformed backups are rejected.
- Clock expiry rejects early claims and advances a stalled match.
- Thirty complete base/Oracle games and six Gambit games across two, three and four seats check conservation and equal final turn counts.

## Browser verification

Two independent browser origins were used as host and guest. Verified room creation, invitation join, private sequential Gambit drafts, shared Tarot setup choices, one-use free recruitment, synchronized table state, turn handoff, host/guest reload recovery, recovery of the guest seat on a fresh browser origin, and narrow-screen card rendering. Browser console errors were checked.

## Limits

The original base manual was recovered. Oracle verification uses physical-card video and narrated rulebook examples; exact Epic setup and uncommon timings remain open. Gambit artwork and 36 printed names are unavailable at reliable quality. See README.md and SOURCES.md.

GitHub Pages rooms require an online host tab and a working direct WebRTC connection. Backups and recovery keys support manual recovery; there is no automatic host migration, dedicated relay, account system or always-on game server. Automated simulations do not prove every possible card interaction.
