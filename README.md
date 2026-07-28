# Into the Echoside — Official Digital Edition (pre-release build)

The official mobile digital edition of the Psychopathic Records deckbuilding
game, playable right now in any browser and structured to be wrapped as an
iOS/Android app with Capacitor. The home screen carries a "Coming Soon" teaser
for the new official characters, art, and cards in the pipeline — see
"Adding the new official content" below for how they drop in.

## What's inside

- **Full game engine** — the complete 2016 base-game rules reconstructed from the
  official how-to-play video: Karma economy, the Gallery, Epic Tier, Juggalo deck,
  Flavor deck, the Abyss, stomps & shields, abolish, Unity Benefits, Wheel of Fate,
  Gathering Point scoring with equal-turns endgame and the official tiebreaker.
- **Playable vs AI** (Basic or Advanced rules), with stomp reaction prompts.
- **Interactive tutorial** — a coach-guided first game with a rigged deck and
  Gallery: play cards, bank Karma, buy from the Gallery, deploy a Fiend, stomp
  the AI's card live, then lessons on Unity, Epics and abolishing. Step-gated
  (wrong actions are blocked with hints), highlights the relevant UI zone at
  each step, replayable from the home screen, and graduates into a real match
  plus a "Carnival Graduate" achievement.
- **82 cards** — every card publicly attested for the base set. Cards are tagged
  in-app: ✓ official text · ◐ partially confirmed · ⚠ reconstructed placeholder.
- **Online multiplayer lobby** (quick match, private rooms with codes) behind an
  **Echoside Premium paywall** ($4.99/mo or $39.99 lifetime). Both are fully wired
  demo flows — no real payments, no live server yet (see Roadmap).
- Collection browser, rules reference, achievements, stats, settings, sound,
  haptics, dark-carnival theme.

## Run it now

Open `index.html` in a browser, or serve the folder:

    npx serve .

## Drop in the official card art

No art files are bundled yet. Each card auto-loads `assets/cards/<id>.jpg`
(portrait, ~590×740px works well) and falls back to a styled placeholder if the
file is missing. Card IDs are listed at the top of `index.html` in the `DB`
array (e.g. `kevin_gill`, `milenko`, `jug_dc`). Export the official art, name
the files accordingly, and it appears everywhere automatically — nothing else
needs to change.

Also replace the ⚠ reconstructed effects in `DB` with the printed card text —
each entry's `txt` (display text) and `fx` (machine-readable effect) sit side
by side.

## Adding the new official content (coming soon)

When the new characters, art, and cards are finalized, each new card is one
line in the `DB` array: `id`, name, type, cost, GP, copy count, rules text, and
an `fx` effect built from the existing effect ops (documented in the comment
above `DB` — karma, draws, abolish, stomps, obtain, Wheel of Fate, etc.). Drop
its art in `assets/cards/<id>.jpg` and it's live in the Gallery, collection,
and AI decks with no other changes. Send me the card sheet when it's ready and
I'll wire them all in.

## Wrap it as a mobile app (Capacitor)

    npm init -y
    npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
    npx cap init "Into the Echoside" com.yourco.echoside --web-dir .
    npx cap add ios && npx cap add android
    npx cap open ios     # or: npx cap open android

The app is a single self-contained `index.html` — no build step required.

## Roadmap to real online multiplayer + payments

1. **Server**: a Node.js WebSocket service (rooms, matchmaking, authoritative
   game state). The lobby screens already model quick match / create / join.
2. **Payments**: Apple/Google require in-app purchases for digital unlocks —
   replace the demo paywall with StoreKit 2 / Google Play Billing (via
   Capacitor plugins), keeping the same premium flag.
3. **Accounts**: friend codes are generated client-side today; back them with
   the server's identity layer.
4. **Oracle of the Three Rings expansion**: Tarot/Gambit cards and Fast/Mirror
   effects are documented only at headline level publicly — implement from your
   licensed expansion rulebook.

## Rules fidelity notes

Sources and confidence levels are documented in `../research/echoside-rules.md`
and `../research/echoside-cards.json`. Known deliberate gaps: Wheel of Fate
results 2, 4, 5, 6, 9, 12 are reconstructed; Inner City Posse's returned card
goes to the Flavor discard instead of the bottom of the Flavor deck; team play
(2v2) and 3–4 player modes are not yet implemented (engine supports 2P).

## Legal

Into the Echoside ™ & © Psychopathic Records / Dark Carnival Games LLC. All
rights reserved. Official digital edition produced under license. This
pre-release build ships without the official art files (see "Drop in the
official card art"); reconstructed card texts (marked ⚠ in-app) should be
verified against the printed cards before store submission.

## Card ID reference

| id | card |
|---|---|
| ninja | Ninja |
| hound_dogs | Hound Dogs |
| loons | The Loons |
| amy_attic | Amy in the Attic |
| killer_carney | Killer Carney |
| wicked_clowns | Wicked Clowns |
| superballs | Superballs |
| willoughby_rags | Willoughby Rags |
| cartoon_nightmares | Cartoon Nightmares |
| wizard_hood | Wizard of the Hood |
| bpb | Bang! Pow! Boom! |
| wraith | The Wraith |
| mighty_death_pop | Mighty Death Pop |
| homies | Homies |
| natalie | Natalie the Ring Girl |
| psy_soldiers | Psychopathic Soldiers |
| jcw | JCW Wrestling |
| kevin_gill | K.G. Kevin Gill |
| soopa_ninjas | Soopa Ninjas |
| legs_diamond | Legs Diamond |
| sugar_slam | Sugar Slam |
| jumpsteady | Jumpsteady |
| blahzay_rose | Blahzay Rose |
| cupcake | Cupcake |
| amb | Axe Murder Boyz |
| big_hoodoo | Big Hoodoo |
| billy_bill | Billy Bill |
| killjoy_club | The Killjoy Club |
| psy_rydas | Psychopathic Rydas |
| rude_boy | Rude Boy |
| whitney | Whitney Peyton |
| hype_man | Hype Man |
| jelly_roll | Jelly Roll |
| wolfpac | Wolfpac |
| bodyguard | Bodyguard |
| head_pe | Head P.E. |
| madchild | Madchild |
| inner_city | Inner City Posse |
| gu | G.U. |
| kottonmouth | Kottonmouth Kings |
| gravedigger | Gravedigger's Shovel |
| juggalo_juice | Juggalo Juice |
| murda_cloak | Murda Cloak |
| hatchet_charm | Hatchetman Charm |
| ringmaster_hat | Ringmaster's Hat |
| ravens_mirror | The Raven's Mirror |
| chainsaw | Chuck the Chainsaw |
| toy_box | Toy Box |
| drainer_monks | Drainer Road Monks |
| pit_demoness | Pit Demoness |
| black_eyed | Black-Eyed Children |
| mr_happy | Mr. Happy |
| evil_eye | Ol' Evil Eye |
| cemetery_girl | Cemetery Girl |
| witch | The Witch |
| milenko | The Great Milenko |
| riddle_box | Riddle Box |
| missing_link | The Marvelous Missing Link |
| ringmaster | The Ringmaster |
| carnival_carnage | Carnival Carnage |
| monoxide | Monoxide |
| shaggy | Shaggy 2 Dope |
| hells_pit | Hell's Pit |
| violent_j | Violent J |
| shangri_la | Shangri-La |
| dark_lotus | Dark Lotus |
| jamie_madrox | Jamie Madrox |
| jug_dc | Juggalo |
| jug_psy | Juggalo |
| jug_ug | Juggalo |
| still_stabbin | Still Stabbin' |
| lil_somethin | Lil Somethin' Somethin' |
| karma_surge | Karma Surge |
| gang_related | Gang Related |
| second_wind | Second Wind |
| jokers_wild | Joker's Wild |
| joke_ya_mind | Joke Ya Mind |
| if_i_was_king | If I Was King |
| black_crows | Black Crows |
| hocus_pocus | Hocus Pocus |
| night_axe | Night of the Axe |
| multiples | Multiples of Myself |
