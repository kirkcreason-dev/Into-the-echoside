# Echoside physical-versus-digital test kit

Version 0.3.1 · Prepared September 29, 2026

This kit is ready for your group to run. No physical playtest results are claimed. The digital scripts are deterministic and checked automatically, but those checks are not independent proof that every printed interaction is correct.

## What you need

- The base game and Oracle of the Three Rings for the four Oracle scenarios.
- Two people familiar with the printed rules, ideally a third person recording results.
- A browser with the [practice table](https://kirkcreason-dev.github.io/Into-the-echoside/public/playtest/).
- About 45–60 minutes for the eight focused scenarios. Run a second session with testers switching roles.

The practice page also serves as the expansion tutorial: choose Mirror, Fast, Tarot, and Gambits in that order, inspect the physical card faces, and resolve each described step.

## Run an identical position

1. Open a scenario and click **Reset this position**. Print it if useful. These are deliberately small midgame positions, not normal starting deals.
2. Lay out only the listed cards and zones. Leave all unlisted cards outside the test. Deck lists read **top first**; Gallery and Epic slots read left to right. Empty slots must stay in the same position. Set Karma, active player, used Items, crew assignments and variants exactly as shown.
3. Read the next action together. The physical player performs it and records the result before seeing the digital outcome. Make the stated choices; do not introduce extra actions.
4. Click **Resolve first/next step**. Compare hand contents, played cards, deck order, discard, Abyss, shared supplies, Karma, used activations, active player and final-round status.
5. Select Match, Mismatch, or Rule needs clarification. Record the first differing step and the relevant card wording or rulebook page. Download the comparison report. It includes the complete replayable position and actions, without live room credentials.
6. Stop the scenario at the first mismatch. Reset and repeat to rule out a setup error. Keep both observations when players disagree about a rule.

The kit’s scripted actions avoid random shuffle decisions. If you expand a scenario and reach a shuffle or die roll, agree on a recorded order/roll before comparing; do not compare independent random outcomes as a rules mismatch.

## Oracle setup checks

Use [setup-checks.md](setup-checks.md) for Juggalo Army, optional Gambits, reload/backup recovery during setup and a precise list of missing source evidence. These checks supplement the eight fixed positions.

## Acceptance checklist

- Every scenario has a physical result and a rule citation or a clearly identified uncertainty.
- Two testers independently reproduce each mismatch.
- Resolved fixes are rerun from the original position; attach a new report rather than overwriting the first one.
- Repeat at two, three and four seats for timing and target-order changes before calling the expansion faithful.
- Complete at least one full base and one full Oracle game per player count. Compare every turn, including end-game triggers and scoring. These full-game sessions are still outstanding.

## Coverage and limits

Eight included scenarios cover Unity replacement; Epic exhaustion with Main-only ending; visible deck tops; shared Relic activations; Mirror versus multiple draws; Fast nullification during Item activation; Tarot during Gallery refill; and single-use Gambits with saved GP.

Not settled by this kit: Oracle’s printed Epic setup count, complete three-/four-player Gambit setup, starting Tarot handling, and unusual simultaneous reaction priority. Six Gambit names still use descriptive labels. Clean Gambit scans are unavailable. Record source evidence for these separately instead of treating current defaults as verified rules.

For follow-up interaction sessions, combine: copied Items plus cleanup, stacked My Axe triggers, Fiend declaration plus counter-stomp, team gifts plus delivery effects, shield-piercing stomps, optional draw with an empty deck, and all variants together. The automated suite covers several of these; physical verification remains necessary.

## Files

- `setup-checks.md`: Oracle setup checklist and the specific missing rules/card references.
- `positions.md`: exact physical layouts and steps for all eight scenarios.
- `scenarios.json`: complete reproducible starting states and action scripts.
- `mismatch-template.csv`: a spreadsheet-friendly recording form.
- `card-audit.csv`: every card definition, its source, and the limits of its current evidence.

The interactive page can download a report for each step. Reports stay on your device. Share them with the project owner when you are ready; this tool does not contact anyone.
