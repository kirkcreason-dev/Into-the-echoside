import DB from "./cards.json" with { type: "json" };
import { normalizeVariants } from "./variants.js";
export { DB };
const DEF = Object.fromEntries(DB.map((d) => [d.id, d]));
const CREWS = ["DC", "PSY", "UG"];
const TYPE_META = {
  DC: { label: "Dark Carnival", glyph: "DC" },
  PSY: { label: "Psychopathic", glyph: "P" },
  UG: { label: "Underground", glyph: "U" },
};
class Pending extends Error {
  constructor(prompt) {
    super("Choice required");
    this.prompt = prompt;
  }
}
export function makeRuntime(state, answers = []) {
  let cursor = 0,
    budget = 0;
  const S = {
    data: {
      set: { speed: 1000, stompAsk: true, haptics: false },
      stats: { epics: 0, stomps: 0, abolished: 0, games: 0, wins: 0 },
      ach: {},
    },
    save() {},
  };
  const TUT = { on() {}, active: false };
  function unlock() {}
  const UI = {
    render() {},
    logChanged() {},
    toast() {},
    banner: async () => {},
    showWheel: async () => {},
    gameOver() {},
  };
  function random() {
    G.rng = (Math.imul(1664525, G.rng) + 1013904223) >>> 0;
    return G.rng / 4294967296;
  }
  function sleep() {
    return Promise.resolve();
  }
  function choose(p, opts) {
    const cards = opts.cards || [];
    if (opts.selectedUids)
      return Promise.resolve(
        cards.filter((c) => opts.selectedUids.includes(c.u)),
      );
    const min = opts.min || 0,
      max = Math.min(opts.max || 1, cards.length);
    const guided =
      G.tutorial?.active &&
      p === G.players[0] &&
      opts.kind === "option" &&
      ((G.tutorial.step === 2 && opts.meta?.purpose === "crew") ||
        (G.tutorial.step === 7 && opts.meta?.purpose === "reaction"));
    if (guided) {
      opts = {
        ...opts,
        tutorialChoice: 0,
        tutorialHint:
          G.tutorial.step === 2
            ? "Choose Dark Carnival for all three Hound Dogs to unlock its Unity benefit."
            : "Stomp this card with Drainer Road Monks. The Fiend is abolished to the Abyss; the opponent’s card has no effect.",
      };
      if (cursor < answers.length && answers[cursor] !== 0)
        throw Error(
          "Choose the highlighted option for this lesson, or leave the guide to play freely.",
        );
    }
    if (p.isAI) {
      if (opts.kind === "cards") {
        let a = cards.slice();
        if (["abolish", "discard"].includes(opts.purpose))
          a.sort((a, b) => cardValue(a) - cardValue(b));
        else a.sort((a, b) => cardValue(b) - cardValue(a));
        if (opts.purpose === "abolish") a = a.filter(junk);
        if (opts.budget != null) {
          let left = opts.budget;
          return Promise.resolve(
            a
              .filter((c) => {
                if (c.d.draftCost > left) return false;
                left -= c.d.draftCost;
                return true;
              })
              .slice(0, max),
          );
        }
        return Promise.resolve(
          a.slice(0, Math.max(min, Math.min(max, a.length))),
        );
      }
      return Promise.resolve(
        (opts.purpose || opts.meta?.purpose) === "reaction"
          ? opts.labels.length - 1
          : 0,
      );
    }
    const n = cursor++;
    if (n < answers.length) {
      const value = answers[n];
      if (opts.kind === "option") {
        if (
          !Number.isInteger(value) ||
          value < 0 ||
          value >= opts.labels.length
        )
          throw Error("Choose a valid option.");
        return Promise.resolve(value);
      }
      if (
        !Array.isArray(value) ||
        new Set(value).size !== value.length ||
        value.length < min ||
        value.length > max ||
        value.some((id) => !cards.some((c) => c.u === id)) ||
        (opts.budget != null &&
          value.reduce(
            (sum, id) =>
              sum + (cards.find((c) => c.u === id)?.d.draftCost || 0),
            0,
          ) > opts.budget)
      )
        throw Error("Invalid card selection.");
      return Promise.resolve(value.map((id) => cards.find((c) => c.u === id)));
    }
    throw new Pending({
      actor: G.players.indexOf(p),
      kind: opts.kind,
      title: opts.title,
      sub: opts.sub || "",
      ...(opts.contextCards ? { contextCards: opts.contextCards.map(c => ({u:c.u,id:c.id,d:c.d})) } : {}),
      labels: opts.labels,
      cards: cards.map((c) => ({ u: c.u, id: c.id, d: c.d })),
      min,
      max,
      index: n,
      ...(opts.budget != null ? { budget: opts.budget } : {}),
      ...(guided
        ? {
            tutorialChoice: opts.tutorialChoice,
            tutorialHint: opts.tutorialHint,
          }
        : {}),
    });
  }
  let uidC = state?.uid || 0;
  function mk(id) {
    return { u: ++uidC, id, d: DEF[id], crewOverride: null, tilted: false };
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function crewOf(c) {
    if (c.crewOverride) return c.crewOverride;
    if (c.d.t === "JUG") return c.d.crew;
    return CREWS.includes(c.d.t) ? c.d.t : null;
  }

  function d12() {
    return 1 + Math.floor(random() * 12);
  }
  function buzz(ms) {
    if (S.data.set.haptics && navigator.vibrate) void 0;
  }

  /* ======================= GAME STATE ======================= */
  let G = state;
  function newPlayer(name, isAI) {
    const deck = [];
    for (let i = 0; i < 7; i++) deck.push(mk("c1203"));
    for (let i = 0; i < 3; i++) deck.push(mk("c1200"));
    shuffle(deck);
    return {
      name,
      isAI,
      deck,
      hand: [],
      discard: [],
      inPlay: [],
      items: [],
      fiends: [],
      gambits: [],
      karma: 0,
      unityUsed: false,
      jugCycled: false,
      epicBought: 0,
      kg: false,
      hocus: false,
      playedCount: 0,
      turns: 0,
      stompAskOff: false,
    };
  }
  function me() {
    return G.players[0];
  }
  function log(msg) {
    G.log.push(msg);
    UI.logChanged();
  }

  function drawFlavorN(p, n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (!G.flavor.length) {
        if (!G.flavorDis.length) break;
        G.flavor = shuffle(G.flavorDis.splice(0));
      }
      const c = G.flavor.pop();
      p.hand.push(c);
      drawn.push(c);
    }
    return drawn;
  }
  function removeFrom(arr, c) {
    const i = arr.indexOf(c);
    if (i >= 0) arr.splice(i, 1);
    return c;
  }
  function allOwned(p) {
    return [
      ...p.deck,
      ...p.hand.filter((c) => c.d.t !== "FLAVOR"),
      ...p.discard,
      ...p.inPlay.filter((c) => c.d.t !== "FLAVOR"),
      ...p.items,
      ...p.fiends,
      ...(p.gambits || []),
    ];
  }
  function crewCounts(p) {
    const n = { DC: 0, PSY: 0, UG: 0 };
    [...p.inPlay, ...p.fiends, ...p.items].forEach((c) => {
      const cr = crewOf(c);
      if (cr) n[cr]++;
    });
    return n;
  }
  function unityReady(p) {
    if (p.unityUsed) return null;
    const n = crewCounts(p);
    const r = CREWS.filter((c) => n[c] >= 3);
    return r.length ? r : null;
  }
  function cardValue(c) {
    return (
      (c.d.gp || 0) * 2 + (c.d.cost || 0) * 0.3 + (c.d.t === "EPIC" ? 3 : 0)
    );
  }
  function junk(c) {
    return c.d.t === "START" || (c.d.gp || 0) === 0;
  }

  /* ======================= CHOICE ROUTING (human=UI, AI=heuristics) ======================= */
  async function pickCards(p, opts) {
    // {title,sub,cards,min,max,purpose,skip}
    if (!opts.cards.length) return [];
    return choose(p, { ...opts, kind: "cards" });
  }
  async function pickOption(p, title, labels, meta) {
    return choose(p, { title, labels, meta, sub: meta?.sub, contextCards: meta?.contextCards, kind: "option" });
  }

  /* ======================= EFFECT ENGINE ======================= */
  async function runOps(p, ops, ctx) {
    for (const o of ops || []) {
      if (G.over) return;
      if (++budget > 700) throw Error("This effect chain is too long.");
      await fastWindow(p, ctx?.card ? `${p.name} resolves ${ctx.card.d.n}: ${ctx.card.d.txt}` : `${p.name} resolves a benefit`, ctx || {});
      await runOp(p, o, ctx || {});
    }
  }
  async function runOp(p, o, ctx) {
    switch (o.op) {
      case "k":
        p.karma += o.n;
        log(`<b>${p.name}</b> +${o.n} Karma (${p.karma})`);
        if (p.karma >= 15) unlock("big_turn");
        break;
      case "draw": {
        const drawn = await drawSafe(p, o.n);
        log(`<b>${p.name}</b> draws ${drawn.length}`);
        if (drawn.length) await mirrorWindow(p, "draw", ctx);
        break;
      }
      case "drawFlavor": {
        const before = p.hand.length;
        drawFlavorN(p, o.n);
        log(`<b>${p.name}</b> draws ${p.hand.length - before} Flavor`);
        if (p.hand.length > before) await mirrorWindow(p, "flavor", ctx);
        break;
      }
      case "drawKeep": {
        const tmp = await drawSafe(p, o.draw);
        tmp.forEach((c) => removeFrom(p.hand, c));
        if (!tmp.length) break;
        await mirrorWindow(p, "draw", ctx);
        const kept = await pickCards(p, {
          title: `Keep ${o.keep}`,
          sub: "The rest are discarded.",
          cards: tmp,
          min: Math.min(o.keep, tmp.length),
          max: Math.min(o.keep, tmp.length),
          purpose: "keep",
        });
        tmp.forEach((c) => {
          if (kept.includes(c)) p.hand.push(c);
          else toDiscard(p, c);
        });
        log(`<b>${p.name}</b> draws ${tmp.length}, keeps ${kept.length}`);
        break;
      }
      case "drawFlavorKeep": {
        const tmp = [];
        for (let i = 0; i < o.draw; i++) {
          if (!G.flavor.length && G.flavorDis.length)
            G.flavor = shuffle(G.flavorDis.splice(0));
          if (G.flavor.length) tmp.push(G.flavor.pop());
        }
        if (!tmp.length) break;
        await mirrorWindow(p, "flavor", ctx);
        const kept = await pickCards(p, {
          title: `Keep ${o.keep} Flavor cards`,
          cards: tmp,
          min: Math.min(o.keep, tmp.length),
          max: Math.min(o.keep, tmp.length),
          purpose: "keep",
        });
        tmp.forEach((c) => {
          if (kept.includes(c)) p.hand.push(c);
          else G.flavorDis.push(c);
        });
        break;
      }
      case "drawDiscard": {
        if (o.opt) {
          const ch = await pickOption(
            p,
            "Discard a card to draw a card?",
            ["Yes", "No"],
            { purpose: "optDrawDiscard" },
          );
          if (ch === 1) break;
        }
        const drawn = await drawSafe(p, o.draw);
        if (drawn.length) await mirrorWindow(p, "draw", ctx);
        const ds = await pickCards(p, {
          title: `Discard ${o.discard}`,
          cards: p.hand.slice(),
          min: Math.min(o.discard, p.hand.length),
          max: Math.min(o.discard, p.hand.length),
          purpose: "discard",
        });
        ds.forEach((c) => {
          removeFrom(p.hand, c);
          toDiscard(p, c);
        });
        log(`<b>${p.name}</b> draws ${o.draw}, discards ${ds.length}`);
        break;
      }
      case "abolish": {
        const pool = [];
        if (o.from.includes("hand"))
          pool.push(...p.hand.filter((c) => c.d.t !== "FLAVOR"));
        if (o.from.includes("discard"))
          pool.push(...p.discard.filter((c) => c.d.t !== "FLAVOR"));
        const sel = await pickCards(p, {
          title: `Abolish up to ${o.max}`,
          sub: "Chosen cards are removed from the game (the Abyss).",
          cards: pool,
          selectedUids: o.declaredSelf,
          min: o.opt ? 0 : Math.min(o.max, pool.length),
          max: o.max,
          purpose: "abolish",
          skip: !!o.opt,
          zoneOf: (c) => (p.hand.includes(c) ? "hand" : "discard"),
        });
        sel.forEach((c) => {
          removeFrom(p.hand, c);
          removeFrom(p.discard, c);
          G.abyss.push(c);
          S.data.stats.abolished++;
        });
        if (sel.length) {
          log(`<b>${p.name}</b> abolishes ${sel.map((c) => c.d.n).join(", ")}`);
          await mirrorWindow(p, "abolish", ctx);
          if (o.drawEach) {
            const drawn = await drawSafe(p, sel.length);
            if (drawn.length) await mirrorWindow(p, "draw", ctx);
          }
          if (o.gainEach) p.karma += o.gainEach * sel.length;
          if (o.then) await runOps(p, o.then, ctx);
        }
        break;
      }
      case "abolishSelfK":
        if (ctx.card) {
          removeFrom(p.inPlay, ctx.card);
          G.abyss.push(ctx.card);
        }
        p.karma += o.n;
        log(
          `<b>${p.name}</b> abolishes ${ctx.card ? ctx.card.d.n : "card"} for +${o.n} Karma`,
        );
        break;
      case "or": {
        if (o.declared) {
          await runOps(p, o.declared, ctx);
          break;
        }
        const ch = await pickOption(p, "Choose one:", [o.la, o.lb], {
          purpose: "or",
          ctx,
        });
        await runOps(p, ch === 0 ? o.a : o.b, ctx);
        break;
      }
      case "chooseCrew": {
        const n = crewCounts(p);
        let cr;
        if (p.isAI) {
          cr = CREWS.slice().sort((a, b) => n[b] - n[a])[0];
        } else {
          const ch = await pickOption(
            p,
            "Choose a Crew for " + (ctx.card ? ctx.card.d.n : "this card"),
            CREWS.map((c) => TYPE_META[c].glyph + " " + TYPE_META[c].label),
            { purpose: "crew" },
          );
          cr = CREWS[ch];
        }
        if (ctx.card) ctx.card.crewOverride = cr;
        log(
          `<b>${p.name}</b>: ${ctx.card ? ctx.card.d.n : ""} becomes ${TYPE_META[cr].label}`,
        );
        break;
      }
      case "kgShield":
        p.kg = true;
        log(`<b>${p.name}</b> is protected from stomps this turn`);
        break;
      case "hocusPocus":
        p.hocus = true;
        break;
      case "condDC": {
        const others = p.inPlay.filter(
          (c) => c !== ctx.card && crewOf(c) === "DC",
        ).length;
        const gain = others >= 1 ? o.n : o.base;
        p.karma += gain;
        log(`<b>${p.name}</b> +${gain} Karma (${p.karma})`);
        break;
      }
      case "revealTopSelf": {
        await ensureDeck(p);
        if (!p.deck.length) break;
        const top = p.deck[p.deck.length - 1];
        log(`${p.name} reveals ${top.d.n} from their deck.`);
        const ch = await pickOption(
          p,
          `Top of your deck: ${top.d.n} — ${top.d.txt}`,
          ["Discard it", "Return it face down"],
          { purpose: "revealSelf", card: top },
        );
        if (ch === 0) {
          p.deck.pop();
          toDiscard(p, top);
          log(`<b>${p.name}</b> discards ${top.d.n} from top of deck`);
        }
        break;
      }
      case "shovel": {
        await ensureDeck(p);
        if (!p.deck.length) break;
        const top = p.deck[p.deck.length - 1];
        if ((top.d.cost || 0) <= 3) {
          p.deck.pop();
          p.hand.push(top);
          log(`<b>${p.name}</b>'s Shovel digs up ${top.d.n}`);
          await mirrorWindow(p, "draw", ctx);
          if (!p.isAI) UI.toast(`⛏️ Dug up: ${top.d.n}`);
        } else {
          log(
            `<b>${p.name}</b>'s Shovel reveals ${top.d.n} (too heavy — returned)`,
          );
          if (!p.isAI)
            UI.toast(`Top card: ${top.d.n} (cost ${top.d.cost}) — returned`);
        }
        break;
      }
      case "cloak": {
        const g = p.fiends.length ? 2 : 1;
        p.karma += g;
        log(`<b>${p.name}</b> +${g} Karma (Murda Cloak)`);
        break;
      }
      case "revealTopMain": {
        const top = await nextMain(p);
        if (!top) break;
        const ch = await pickOption(
          p,
          `Top of Main Deck: ${top.d.n} (cost ${top.d.cost}) — ${top.d.txt}`,
          ["Obtain it for free", "Abolish it"],
          { purpose: "revealMain", card: top },
        );
        if (ch === 0) {
          await gainCard(p, top, "free");
        } else {
          G.abyss.push(top);
          log(`<b>${p.name}</b> abolishes ${top.d.n} off the Main Deck`);
        }
        break;
      }
      case "shuffleBack": {
        const pool = p.discard.filter(
          (c) => c !== ctx.card && (c.d.cost || 0) <= o.maxCost,
        );
        const sel = await pickCards(p, {
          title: `Shuffle up to ${o.max} into your deck`,
          cards: pool,
          min: 0,
          max: o.max,
          purpose: "recover",
          skip: true,
        });
        sel.forEach((c) => {
          removeFrom(p.discard, c);
          p.deck.push(c);
        });
        if (sel.length) {
          shuffle(p.deck);
          log(`<b>${p.name}</b> shuffles ${sel.length} card(s) back into deck`);
        }
        break;
      }
      case "fromDiscard": {
        let pool = p.discard.filter(
          (c) =>
            (!o.crew || crewOf(c) === o.crew) &&
            (!o.type || c.d.t === o.type) &&
            (!o.nonEpic || c.d.t !== "EPIC") &&
            (o.maxCost == null || (c.d.cost || 0) <= o.maxCost),
        );
        const sel = await pickCards(p, {
          title:
            o.dest === "top"
              ? "Place on top of your deck"
              : "Put into your hand",
          cards: pool,
          min: o.opt ? 0 : Math.min(1, pool.length),
          max: 1,
          purpose: "recover",
          skip: !!o.opt,
        });
        if (sel[0]) {
          removeFrom(p.discard, sel[0]);
          if (o.dest === "top") p.deck.push(sel[0]);
          else p.hand.push(sel[0]);
          log(`<b>${p.name}</b> recovers ${sel[0].d.n}`);
        }
        break;
      }
      case "fromAbyss": {
        const pool = G.abyss.filter(
          (c) => (c.d.cost || 0) <= o.maxCost && c.d.t !== "FLAVOR",
        );
        const sel = await pickCards(p, {
          title: "Obtain from the Abyss",
          cards: pool,
          min: 0,
          max: 1,
          purpose: "obtain",
          skip: true,
        });
        if (sel[0]) {
          removeFrom(G.abyss, sel[0]);
          await gainCard(p, sel[0], "free");
        }
        break;
      }
      case "flavorDiscardToHand": {
        const sel = await pickCards(p, {
          title: "Take from Flavor discard",
          cards: G.flavorDis.slice(),
          min: 0,
          max: 1,
          purpose: "obtain",
          skip: true,
        });
        if (sel[0]) {
          removeFrom(G.flavorDis, sel[0]);
          sel[0].flavorBottom = true;
          p.hand.push(sel[0]);
          log(`<b>${p.name}</b> takes ${sel[0].d.n} from the Flavor discard`);
        }
        break;
      }
      case "obtain": {
        let pool = G.gallery.filter(
          (c) =>
            c &&
            !c.hiddenBy &&
            (c.d.cost || 0) <= o.maxCost &&
            (o.exactCost == null || c.d.cost === o.exactCost) &&
            (!o.itemOnly || c.d.t === "ITEM"),
        );
        if (
          !o.itemOnly &&
          !o.galleryOnly &&
          G.jug.length &&
          3 <= o.maxCost &&
          (o.exactCost == null || o.exactCost === 3)
        )
          pool = pool.concat([G.jug[G.jug.length - 1]]);
        if (!pool.length) {
          if (!p.isAI) UI.toast("Nothing eligible to obtain.");
          break;
        }
        const sel = await pickCards(p, {
          title: `Obtain a card (cost ≤ ${o.maxCost}) for free`,
          cards: pool,
          min: o.opt ? 0 : 1,
          max: 1,
          purpose: "obtain",
          skip: !!o.opt,
        });
        if (sel[0]) {
          const c = sel[0];
          await fastWindow(p, `${p.name} wants to obtain ${c.d.n}`);
          if (!G.gallery.includes(c) && G.jug.at(-1) !== c) break;
          if (c.hiddenBy) break;
          const gi = G.gallery.indexOf(c);
          if (gi >= 0) {
            G.gallery[gi] = null;
          } else if (G.jug[G.jug.length - 1] === c) {
            G.jug.pop();
          }
          await gainCard(p, c, "free");
          if (gi >= 0) await galleryRefillCheck(p, gi);
        }
        break;
      }
      case "obtainJuggalo":
        if (G.jug.length) {
          const c = G.jug.pop();
          await gainCard(p, c, "free");
        }
        break;
      case "wheel":
        for (let i = 0; i < o.n; i++) {
          if (G.over) break;
          await spinWheel(p, o.bonus || 0);
        }
        break;
      case "galleryWipe": {
        const pool = G.gallery.filter((c) => c && !c.hiddenBy);
        const sel = await pickCards(p, {
          title: `Abolish up to ${o.max} Gallery cards`,
          sub:
            o.refill === false
              ? "Spaces stay empty until the turn ends."
              : "They are replaced immediately.",
          cards: pool,
          min: o.required ? Math.min(o.max, pool.length) : 0,
          max: o.max,
          purpose: "wipe",
          skip: true,
        });
        const replaced = sel.map((c) => G.gallery.indexOf(c));
        sel.forEach((c) => {
          const i = G.gallery.indexOf(c);
          G.gallery[i] = null;
          G.abyss.push(c);
        });
        if (o.refill !== false) await refillGallery(p, replaced);
        if (sel.length)
          log(`<b>${p.name}</b> wipes ${sel.length} Gallery card(s)`);
        checkEndTriggers();
        break;
      }
      case "obsoleteOppDiscardItems": {
        const q = opp(p);
        if (!q.items.length) break;
        const ch = await pickOption(
          p,
          `Force ${q.name} to discard all Items in play? (${q.items.map((c) => c.d.n).join(", ")})`,
          ["Yes — discard them", "No"],
          { purpose: "oppItems" },
        );
        if (ch === 0) {
          const n = q.items.length;
          q.items.splice(0).forEach((c) => q.discard.push(c));
          log(`<b>${q.name}</b> discards ${n} Item(s)!`);
          buzz(60);
        }
        break;
      }
      case "peekOppHand": {
        const q = opp(p);
        if (!q.hand.length) break;
        const sel = await pickCards(p, {
          title: `${q.name}'s hand — choose 1 to discard`,
          cards: q.hand.slice(),
          min: 1,
          max: 1,
          purpose: "handAttack",
        });
        if (sel[0]) {
          removeFrom(q.hand, sel[0]);
          toDiscard(q, sel[0]);
          log(`<b>${p.name}</b> forces ${q.name} to discard ${sel[0].d.n}`);
        }
        break;
      }
      case "copyGallery": {
        const pool = G.gallery.filter(
          (c) =>
            c &&
            !c.hiddenBy &&
            CREWS.includes(c.d.t) &&
            (c.d.cost || 0) <= o.maxCost &&
            c.d.fx,
        );
        const sel = await pickCards(p, {
          title: "Copy a Gallery Crew card's effect",
          cards: pool,
          min: 0,
          max: 1,
          purpose: "copy",
          skip: true,
        });
        if (sel[0]) {
          log(`<b>${p.name}</b> copies ${sel[0].d.n}`);
          await copyEffect(p, sel[0], ctx);
        }
        break;
      }
      case "copyEpicTier": {
        const pool = G.epicTier.filter(
          (c) =>
            c &&
            c.d.fx &&
            !c.d.fx.some((o) => o.op === "copyEpicTier") &&
            !(ctx.chain || []).includes(c.id),
        );
        const sel = await pickCards(p, {
          title: "Copy an Epic Tier effect",
          cards: pool,
          min: 0,
          max: 1,
          purpose: "copy",
          skip: true,
        });
        if (sel[0]) {
          log(`<b>${p.name}</b> copies ${sel[0].d.n}`);
          await copyEffect(p, sel[0], ctx);
        }
        break;
      }
      case "copyInPlay": {
        const pool = p.inPlay.filter(
          (c) =>
            c !== ctx.card &&
            !(ctx.chain || []).includes(c.id) &&
            (c.d.t === "START" || CREWS.includes(crewOf(c))) &&
            (c.d.cost || 0) <= o.maxCost &&
            c.d.fx,
        );
        const sel = await pickCards(p, {
          title: `Copy a card you have in play (cost ≤ ${o.maxCost})`,
          cards: pool,
          min: 0,
          max: 1,
          purpose: "copy",
          skip: true,
        });
        if (sel[0]) {
          log(`<b>${p.name}</b> copies ${sel[0].d.n}`);
          await copyEffect(p, sel[0], ctx);
        }
        break;
      }
      case "sugarSlam": {
        if (p.playedCount === 1 && p.hand.length) {
          const ch = await pickOption(
            p,
            "Sugar Slam",
            ["+2 Karma", "Discard the rest of your hand and draw 5 new cards"],
            { purpose: "sugar" },
          );
          if (ch === 1) {
            const n = p.hand.length;
            p.hand.splice(0).forEach((c) => toDiscard(p, c));
            const drawn = await drawSafe(p, 5);
            if (drawn.length) await mirrorWindow(p, "draw", ctx);
            log(`<b>${p.name}</b> mulligans ${n} cards and draws ${drawn.length}`);
            break;
          }
        }
        p.karma += 2;
        log(`<b>${p.name}</b> +2 Karma (${p.karma})`);
        break;
      }
      case "mulligan": {
        const n = p.hand.length;
        p.hand.splice(0).forEach((c) => toDiscard(p, c));
        const drawn = await drawSafe(p, 5);
        if (drawn.length) await mirrorWindow(p, "draw", ctx);
        log(`<b>${p.name}</b> discards ${n} and draws ${drawn.length} (Pit Demoness)`);
        break;
      }
      default:
        await extraOp(p, o, ctx);
    }
    UI.render();
  }

  /* ======================= GAIN / BUY ======================= */
  async function buyGallery(p, i) {
    const c = G.gallery[i];
    if (!c || p.karma < c.d.cost) return false;
    await fastWindow(p, `${p.name} wants to recruit ${c.d.n}`);
    if (G.gallery[i] !== c || c.hiddenBy) {
      log("The purchase was interrupted. Karma was not spent.");
      return false;
    }
    p.karma -= c.d.cost;
    G.gallery[i] = null;
    await gainCard(p, c, "buy");
    buzz(20);
    await galleryRefillCheck(p, i);
    if (G.tutorial && !p.isAI) TUT.on("buy", { card: c, zone: "gallery" });
    UI.render();
    return true;
  }
  async function buyJug(p) {
    if (!G.jug.length || p.karma < 3) return false;
    const intended = G.jug.at(-1);
    await fastWindow(p, `${p.name} wants to recruit the top Juggalo`);
    if (G.jug.at(-1) !== intended) return false;
    p.karma -= 3;
    const c = G.jug.pop();
    await gainCard(p, c, "buy");
    UI.render();
    return true;
  }
  function cycleJug(p) {
    if (!G.jug.length || p.karma < 1 || p.jugCycled) return false;
    p.jugCycled = true;
    p.karma -= 1;
    G.jug.unshift(G.jug.pop());
    log(`<b>${p.name}</b> cycles the top Juggalo card`);
    UI.render();
    return true;
  }

  /* ======================= STOMPS ======================= */
  /* ======================= TURN FLOW ======================= */
  async function claimUnity(p, crew) {
    if (p.unityUsed || !unityReady(p)?.includes(crew)) return;
    p.unityUsed = true;
    log(`<b>${p.name}</b> claims ${TYPE_META[crew].label} Unity`);
    if (await replaceUnity(p)) return;
    if (crew === "DC") await runOps(p, [{ op: "k", n: 2 }], {});
    if (crew === "PSY") await runOps(p, [{ op: "draw", n: 1 }], {});
    if (crew === "UG") await runOps(p, [{ op: "drawFlavor", n: 1 }], {});
    UI.render();
  }
  async function replaceUnity(p) {
    if (!G.variants?.abolishUnity || ![...p.hand, ...p.discard].some(c => c.d.t !== "FLAVOR")) return false;
    const choice = await pickOption(p, "Abolish Made Easy", ["Take the Unity benefit", "Abolish a card instead"], {});
    if (choice !== 1) return false;
    await runOps(p, [{ op: "abolish", from: ["hand", "discard"], max: 1 }], {});
    return true;
  }
  function living(c) {
    return c && !c.nullBy && c.nullTurn !== G.turnN;
  }
  function passives(p, kind) {
    return [...p.items, ...p.inPlay, ...(p.endTurnEffects || []), ...(G.relic && G.players[G.active] === p ? [G.relic] : [])].filter(
      (c) => living(c) && (c.d.passive === kind || c.borrowedPassive === kind),
    );
  }
  function has(p, kind) {
    return passives(p, kind).length > 0;
  }
  function teamMate(p) {
    return G.teams ? G.players[(G.players.indexOf(p) + 2) % 4] : null;
  }
  function enemyPlayers(p) {
    return G.players.filter((q) => q !== p && q !== teamMate(p));
  }
  function opp(p) {
    return G.players[(G.players.indexOf(p) + 1) % G.players.length];
  }
  function scoreGP(p) {
    return gatheringPoints(allOwned(p));
  }
  function toDiscard(p, c) {
    c.crewOverride = null;
    c.borrowedPassive = null;
    delete c.borrowedActive;
    delete c.borrowedReaction;
    delete c.effectCopy;
    delete c.spent;
    if (c.temporary) {
      G.abyss.push(c);
      delete c.temporary;
    } else if (c.d.t === "FLAVOR") {
      if (c.flavorBottom) {
        G.flavor.unshift(c);
        delete c.flavorBottom;
      } else G.flavorDis.push(c);
    } else p.discard.push(c);
  }
  async function ensureDeck(p) {
    if (!p.deck.length && p.discard.length) {
      await beforeDiscardShuffle(p);
      p.deck = shuffle(p.discard.splice(0));
    }
  }
  async function beforeDiscardShuffle(p) {
    if (p.discard.length) for (const effect of passives(p, "guillotine"))
        await runOps(
          p,
          [{ op: "abolish", from: ["hand", "discard"], max: 1, opt: true }],
          { noMirror: true, noFast: true },
        );
  }
  async function drawSafe(p, n) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      await ensureDeck(p);
      if (!p.deck.length) break;
      const c = p.deck.pop();
      p.hand.push(c);
      drawn.push(c);
    }
    return drawn;
  }
  async function setupJuggaloArmy() {
    G.phase = "army";
    for (const p of G.players) {
      G.active = G.players.indexOf(p);
      const removed = await pickCards(p, {
        title: "Juggalo Army · replace three starters",
        sub: "Choose any three Starter cards to remove from your deck. They stay outside the game; you will recruit three Juggalos in their place.",
        cards: p.deck,
        min: 3,
        max: 3,
        purpose: "discard",
      });
      for (const c of removed) {
        removeFrom(p.deck, c);
        G.armyRemoved.push(c);
      }
    }
    let contenders = G.players.map((_, i) => i);
    G.armyRolls = [];
    while (contenders.length > 1) {
      const rolls = contenders.map(seat => ({ seat, roll: d12() }));
      G.armyRolls.push(rolls);
      const highest = Math.max(...rolls.map(r => r.roll));
      contenders = rolls.filter(r => r.roll === highest).map(r => r.seat);
    }
    const first = contenders[0];
    G.armyDraftOrder = G.players.map((_, i) => (first + i) % G.players.length);
    log(`Juggalo Army: <b>${G.players[first].name}</b> won the draft roll. Each player recruits one Juggalo per round for three rounds.`);
    for (let round = 0; round < 3; round++) {
      for (const seat of G.armyDraftOrder) {
        G.active = seat;
        const p = G.players[seat];
        const [c] = await pickCards(p, {
          title: `Juggalo Army · recruit ${round + 1} of 3`,
          sub: "Choose one card from the remaining Juggalo Deck. Play passes around the table after each choice.",
          cards: G.jug,
          min: 1,
          max: 1,
          purpose: "keep",
        });
        removeFrom(G.jug, c);
        p.deck.push(c);
        log(`<b>${p.name}</b> recruits <b>${c.d.n}</b> (${c.d.crew}) for Juggalo Army.`);
      }
    }
    shuffle(G.jug);
    for (const p of G.players) shuffle(p.deck);
    G.active = 0;
    delete G.phase;
  }
  async function newGame(config) {
    const variants = normalizeVariants(config.variants, !!config.expansion, config.advanced !== false);
    if (config.teams && config.players.length !== 4)
      throw Error("Team play requires four players.");
    if (
      config.tutorial &&
      (config.players.length !== 2 ||
        config.players[0].isAI ||
        !config.players[1].isAI ||
        config.expansion)
    )
      throw Error(
        "The guided game uses the base set with one player and the Void.",
      );
    G = {
      rng: config.seed >>> 0,
      uid: 0,
      main: [],
      flavor: [],
      flavorDis: [],
      abyss: [],
      tarotDiscard: [],
      jug: [],
      epicDeck: [],
      epicTier: [],
      gallery: [],
      players: [],
      active: 0,
      turnN: 1,
      over: false,
      endTriggered: false,
      teams: !!config.teams,
      advanced: config.advanced !== false,
      log: [],
      expansion: !!config.expansion,
      variants,
      config,
      extraGallery: [],
      armyRemoved: [],
    };
    uidC = 0;
    for (const d of DB) {
      if (
        d.t === "GAMBIT" ||
        d.t === "START" ||
        d.set === "promo" ||
        (!G.expansion && d.set === "oracle") ||
        (!G.advanced && (d.t === "FIEND" || ["axe", "toy"].includes(d.passive)))
      )
        continue;
      let count = G.expansion ? d.copies : d.baseCopies;
      if (d.t === "EPIC") count = 1;
      const target =
        d.t === "EPIC"
          ? G.epicDeck
          : d.t === "FLAVOR"
            ? G.flavor
            : d.t === "JUG"
              ? G.jug
              : G.main;
      for (let i = 0; i < count; i++) target.push(mk(d.id));
    }
    shuffle(G.main);
    shuffle(G.flavor);
    shuffle(G.epicDeck);
    shuffle(G.jug);
    if (variants.relic) {
      const i = variants.relic === "random"
        ? G.main.findLastIndex(c => c.d.t === "ITEM" && c.id !== "c2512")
        : G.main.findIndex(c => c.id === variants.relic);
      if (i < 0) throw Error("The selected Relic is not in this card set.");
      G.relic = G.main.splice(i, 1)[0];
      if (variants.relic === "random") shuffle(G.main);
      log(`Relic of Power: <b>${G.relic.d.n}</b>. Its effects are available during each player's own turn.`);
    }
    G.players = config.players.map((p) => newPlayer(p.name, !!p.isAI));
    if (variants.juggaloArmy) await setupJuggaloArmy();
    for (const p of G.players) await drawSafe(p, 5);
    const epicCount = variants.epicCount ?? G.epicDeck.length - Math.max(0, (4 - G.players.length) * 2);
    G.epicDeck.splice(0, G.epicDeck.length - epicCount);
    G.epicTier = G.epicDeck.splice(-3);
    while (G.epicTier.length < 3) G.epicTier.push(null);
    G.first = 0;
    G.gambitsEnabled = G.expansion && !!config.gambits;
    G.gambitRemoved = [];
    G.gambitReserve = [];
    G.gallery = Array(6).fill(null);
    if (G.gambitsEnabled) {
      G.phase = "draft";
      G.gambitReserve = shuffle(
        DB.filter((d) => d.t === "GAMBIT").map((d) => mk(d.id)),
      );
      for (const p of G.players) p.gambitDraft = G.gambitReserve.splice(-10);
      for (const p of G.players) {
        const chosen = await pickCards(p, {
          title: "Choose your Gambits",
          sub: "Keep up to 3 points of Gambits. Picks stay private. Each can be used once; unspent draft points are lost.",
          cards: p.gambitDraft,
          min: 0,
          max: 3,
          budget: 3,
          purpose: "draft",
        });
        p.gambits = chosen;
        G.gambitReserve.push(
          ...p.gambitDraft.filter((c) => !chosen.includes(c)),
        );
        delete p.gambitDraft;
        log(`<b>${p.name}</b> has chosen their Gambits.`);
      }
      const first = G.players.findIndex((p) =>
        p.gambits.some((c) => c.d.timing === "game_start"),
      );
      if (first >= 0) {
        G.active = first;
        G.first = first;
        const p = G.players[first],
          c = p.gambits.find((c) => c.d.timing === "game_start");
        consumeGambit(p, c);
      }
      delete G.phase;
    }
    // Ninja Speed is revealed after drafting, before any first-player roll.
    if (!G.gambitRemoved.some(c => c.d.timing === "game_start")) {
      let contenders = G.players.map((_, i) => i);
      G.firstRolls = [];
      while (contenders.length > 1) {
        const rolls = contenders.map((seat) => ({ seat, roll: d12() }));
        G.firstRolls.push(rolls);
        const best = Math.max(...rolls.map((r) => r.roll));
        contenders = rolls.filter((r) => r.roll === best).map((r) => r.seat);
      }
      G.active = contenders[0];
      G.first = G.active;
    } else G.firstRolls = [];
    await refillGallery(G.players[G.active]);
    if (config.tutorial) {
      // Rearrange existing cards, preserving the printed starter deck and all supplies.
      const p = G.players[0],
        starter = [...p.hand, ...p.deck];
      p.hand = [
        ...starter.filter((c) => c.id === "c1203").slice(0, 2),
        ...starter.filter((c) => c.id === "c1200"),
      ];
      p.deck = starter.filter((c) => !p.hand.includes(c));
      for (const [slot, id] of [
        [0, "c1430"],
        [1, "c2823"],
      ]) {
        const existing = G.gallery.findIndex((c) => c?.id === id);
        if (existing >= 0)
          [G.gallery[slot], G.gallery[existing]] = [
            G.gallery[existing],
            G.gallery[slot],
          ];
        else {
          const index = G.main.findIndex((c) => c.id === id);
          [G.gallery[slot], G.main[index]] = [G.main[index], G.gallery[slot]];
        }
      }
      G.active = 0;
      G.first = 0;
      G.tutorial = { active: true, step: 0 };
    }
    log(`<b>${G.players[G.active].name}</b> takes the first turn.`);
    return G;
  }
  function tutorialCommand(command) {
    if (!G.tutorial?.active)
      throw Error("There is no active guide at this table.");
    if (command === "skip") {
      G.tutorial.active = false;
      G.tutorial.skipped = true;
      return;
    }
    if (command === "next" && G.tutorial.step === 0) {
      G.tutorial.step = 1;
      return;
    }
    if (command === "finish" && G.tutorial.step === 9) {
      G.tutorial.active = false;
      G.tutorial.completed = true;
      return;
    }
    throw Error("Complete the highlighted lesson first.");
  }
  function checkTutorialAction(action, p) {
    if (!G.tutorial?.active || p.isAI) return;
    const step = G.tutorial.step,
      card = p.hand.find((c) => c.u === action.id);
    const valid =
      (step === 1 &&
        (action.type === "ninjas" ||
          (action.type === "play" && card?.id === "c1203"))) ||
      (step === 2 && action.type === "play" && card?.id === "c1200") ||
      (step === 3 && action.type === "unity" && action.crew === "DC") ||
      ([4, 5].includes(step) &&
        action.type === "buy" &&
        action.zone === "gallery" &&
        G.gallery[action.index]?.id === (step === 4 ? "c1430" : "c2823")) ||
      (step === 6 && action.type === "end");
    if (!valid)
      throw Error(
        "Follow the highlighted lesson, or leave the guide to play freely.",
      );
  }
  function advanceTutorial() {
    if (!G.tutorial?.active) return;
    const p = G.players[0],
      step = G.tutorial.step;
    if (
      (step === 1 && !p.hand.some((c) => c.id === "c1203")) ||
      (step === 2 && !p.hand.some((c) => c.id === "c1200")) ||
      (step === 3 && p.unityUsed) ||
      (step === 4 && p.discard.some((c) => c.id === "c1430")) ||
      (step === 5 && p.fiends.some((c) => c.id === "c2823")) ||
      (step === 6 && G.active === 1) ||
      (step === 7 && !p.fiends.some((c) => c.id === "c2823")) ||
      (step === 8 && G.active === 0)
    )
      G.tutorial.step++;
  }
  async function nextMain(p) {
    let c = G.main.pop();
    if (c) checkEndTriggers();
    while (c?.d.t === "TAROT") {
      G.tarotDiscard.push(c);
      log(`Tarot revealed: <b>${c.d.n}</b>.`);
      await runOps(p, c.d.fx, { card: c, noMirror: true, noFast: true });
      c = G.main.pop();
      if (c) checkEndTriggers();
    }
    return c || null;
  }
  async function refillGallery(p, slots = [0, 1, 2, 3, 4, 5]) {
    for (const i of slots) if (!G.gallery[i]) G.gallery[i] = await nextMain(p);
    checkEndTriggers();
  }
  function checkEndTriggers() {
    if (!G.endTriggered && (!G.main.length || (!G.variants?.mainOnly && !G.epicDeck.length))) {
      G.endTriggered = true;
      log("The shared deck is exhausted. Finish the round with equal turns.");
    }
  }
  async function galleryRefillCheck(p, index) {
    if (has(p, "juice") && Number.isInteger(index))
      await refillGallery(p, [index]);
  }
  async function gainCard(p, c, how, allowGift = true) {
    const buyer = p,
      qualifiesHand = (p.nextToHand || []).includes(crewOf(c) || c.d.t),
      qualifiesItem = c.d.t === "ITEM" && p.hocus;
    if (qualifiesHand) p.nextToHand = [];
    if (qualifiesItem) p.hocus = false;
    const teammate = teamMate(p);
    if (
      allowGift &&
      teammate &&
      p.karma >= 1 &&
      (await pickOption(
        p,
        `Who receives ${c.d.n}?`,
        ["Keep it", `Give to ${teammate.name} · 1 Karma`],
        { purpose: "gift" },
      )) === 1
    ) {
      p.karma--;
      p = teammate;
      log(
        `<b>${buyer.name}</b> spends 1 Karma to give ${c.d.n} to <b>${p.name}</b>.`,
      );
    }
    log(
      `<b>${p.name}</b> ${how === "buy" ? "recruits" : "obtains"} <b>${c.d.n}</b>.`,
    );
    if (c.d.t === "FIEND") p.fiends.push(c);
    else if (c.d.t === "ITEM" && has(p, "hat")) {
      p.items.push(c);
      if (c.d.fx) await runOps(p, c.d.fx, { card: c });
    } else if (
      p === buyer &&
      (qualifiesItem || qualifiesHand) &&
      (await pickOption(
        p,
        `Put ${c.d.n} into your hand?`,
        ["Into hand", "Discard pile"],
        {},
      )) === 0
    ) {
      p.hand.push(c);
    } else {
      const charm =
        G.players[G.active] === p &&
        passives(p, "charm").find((i) => !i.tilted);
      if (
        charm &&
        CREWS.includes(crewOf(c)) &&
        c.d.cost <= 5 &&
        (await pickOption(
          p,
          "Hatchetman Charm: put this card on top of your deck?",
          ["Top of deck", "Discard pile"],
          {},
        )) === 0
      ) {
        charm.tilted = true;
        p.deck.push(c);
      } else p.discard.push(c);
    }
    if (c.d.onGain && !c.obtained) {
      c.obtained = true;
      await runOps(p, c.d.onGain, { card: c });
    }
    if (c.d.t === "FIEND" && G.players[G.active] === p) {
      for (const axe of passives(p, "axe").filter((c) => !c.tilted)) {
        const pool = [...p.hand, ...p.discard].filter(
          (c) => c.d.t !== "FLAVOR",
        );
        const chosen = await select(
          p,
          "My Axe: abolish a card?",
          pool,
          1,
          0,
          "abolish",
        );
        if (chosen.length) {
          axe.tilted = true;
          await runOps(
            p,
            [
              {
                op: "abolish",
                from: ["hand", "discard"],
                max: 1,
                opt: true,
                declaredSelf: chosen.map((c) => c.u),
              },
            ],
            {},
          );
        }
      }
    }
  }

  async function buyEpic(p, i) {
    const c = G.epicTier[i],
      cost = Math.max(0, (c?.d.cost || 0) - (p.epicDiscount || 0));
    if (!c || p.karma < cost || p.epicBought >= 1)
      throw Error("This Epic cannot be purchased.");
    await fastWindow(p, `${p.name} wants to recruit ${c.d.n}`);
    if (G.epicTier[i] !== c) return;
    p.karma -= cost;
    G.epicTier[i] = null;
    p.epicBought++;
    await gainCard(p, c, "buy");
  }
  async function copyEffect(p, c, ctx) {
    if ((ctx.chain || []).includes(c.id)) return;
    if (ctx.card) ctx.card.effectCopy = c.effectCopy || c.id;
    await runOps(p, (c.effectCopy ? DEF[c.effectCopy] : c.d).fx, {
      ...ctx,
      chain: [...(ctx.chain || []), c.id],
    });
  }
  async function spinWheel(p, bonus = 0) {
    const roll = Math.max(1, Math.min(12, d12() + bonus));
    G.lastWheel = roll;
    log(`<b>${p.name}</b> rolls ${roll} on the Wheel of Fate.`);
    await runOps(p, WHEEL[roll], {});
  }
  const WHEEL = [
    [],
    [],
    [{ op: "galleryWipe", max: 1 }],
    [{ op: "fromDiscard", maxCost: 3, dest: "top", opt: true }],
    [{ op: "k", n: 1 }],
    [{ op: "draw", n: 1 }],
    [{ op: "fromDiscard", maxCost: 5, dest: "top", opt: true }],
    [{ op: "abolish", from: ["hand", "discard"], max: 1, opt: true }],
    [{ op: "k", n: 2 }],
    [{ op: "fromDiscard", maxCost: 7, dest: "top", opt: true }],
    [{ op: "draw", n: 2 }],
    [{ op: "drawFlavor", n: 1 }],
    [{ op: "k", n: 3 }],
  ];
  function reaction(c) {
    return c.borrowedReaction || c.d.reaction;
  }
  function stompers(q, p, c) {
    const protectedAny = p.kg || has(p, "cloak"),
      shielded = !!c.d.shield;
    if (p.gambitShield === G.turnN) return [];
    return [
      ...(q.gambits || []),
      ...q.fiends,
      ...q.items,
      ...q.inPlay.filter((c) => c.borrowedReaction),
      ...q.hand.filter((x) => x.d.t !== "ITEM"),
    ].filter(
      (x) =>
        !x.spent &&
        living(x) &&
        (x.d.reaction || x.borrowedReaction) &&
        (!reaction(x).nonEpic || c.d.t !== "EPIC") &&
        (reaction(x).maxCost == null || c.d.cost <= reaction(x).maxCost) &&
        (!protectedAny || reaction(x).pierce) &&
        (!shielded || reaction(x).pierce || reaction(x).pierceShield),
    );
  }
  async function fastWindow(p, title, ctx = {}) {
    if (ctx.noFast || !G.expansion) return;
    for (const q of enemyPlayers(p)) {
      let guard = 20;
      while (guard--) {
        const cards = [...q.hand, ...(q.gambits || [])].filter((c) => c.d.fast);
        if (!cards.length || q.isAI) break;
        const ch = await pickOption(
          q,
          title,
          [...cards.map((c) => "Fast: " + c.d.n), "Pass"],
          { purpose: "reaction", contextCards: cards, sub: "Use a Fast card now, or pass to continue the announced action." },
        );
        if (ch >= cards.length) break;
        if (cards[ch].d.t === "GAMBIT")
          await useGambit(q, cards[ch], { noFast: true });
        else await playCard(q, cards[ch], { noFast: true });
      }
    }
  }
  async function stompWindow(p, c, ctx = {}) {
    if ((ctx.depth || 0) > 20) throw Error("Too many chained stomps.");
    for (let step = 1; step < G.players.length; step++) {
      const q = G.players[(G.players.indexOf(p) + step) % G.players.length];
      if (q === teamMate(p)) continue;
      let guard = 12;
      while (guard--) {
        const avail = stompers(q, p, c),
          fast = ctx.noFast
            ? []
            : [...q.hand, ...(q.gambits || [])].filter((x) => x.d.fast);
        if (!avail.length && !fast.length) break;
        const options = [
          ...avail.map((x) => "Stomp with " + x.d.n),
          ...fast.map((x) => "Fast: " + x.d.n),
          "Let it resolve",
        ];
        let choice;
        if (q.isAI) {
          choice = avail.length && c.d.cost >= 5 ? 0 : options.length - 1;
        } else
          choice = await pickOption(q, `${p.name} plays ${c.d.n}`, options, {
            purpose: "reaction", contextCards: [c, ...avail, ...fast], sub: "A stomp cancels the played card if it resolves. Fast cards interrupt before the effect continues.",
          });
        if (choice === options.length - 1) break;
        if (choice >= avail.length) {
          const f = fast[choice - avail.length];
          if (f.d.t === "GAMBIT") {
            await useGambit(q, f, { noFast: true });
            continue;
          }
          removeFrom(q.hand, f);
          q.inPlay.push(f);
          if (!(await stompWindow(q, f, { noFast: true })))
            await runOps(q, f.d.fx, { card: f, noFast: true });
          continue;
        }
        const s = avail[choice],
          r = reaction(s),
          canCounter = q.hand.includes(s) || q.fiends.includes(s);
        if (canCounter) {
          if (q.hand.includes(s)) {
            removeFrom(q.hand, s);
            q.inPlay.push(s);
          }
          if (
            await stompWindow(q, s, {
              noFast: true,
              depth: (ctx.depth || 0) + 1,
            })
          )
            continue;
        }
        [q.hand, q.fiends, q.items, q.inPlay].forEach((a) => removeFrom(a, s));
        if (s.d.t === "GAMBIT") consumeGambit(q, s);
        else if (r.cost === "abolishSelf") G.abyss.push(s);
        else toDiscard(q, s);
        [p.inPlay, p.items, p.fiends].forEach((a) => removeFrom(a, c));
        if (r.obtainMax != null && c.d.cost <= r.obtainMax)
          await gainCard(q, c, "free", false);
        else if (
          c.d.t === "FIEND" ||
          c.temporary ||
          (c.d.t !== "FLAVOR" &&
            r.abolishMax != null &&
            c.d.cost <= r.abolishMax)
        )
          G.abyss.push(c);
        else {
          toDiscard(p, c);
          c.stompedTurn = G.turnN;
        }
        log(`<b>${q.name}</b> stomps <b>${c.d.n}</b> with ${s.d.n}.`);
        await runOps(q, r.after, { noMirror: true });
        return true;
      }
    }
    return false;
  }
  async function mirrorWindow(p, kind, ctx = {}) {
    if (ctx.noMirror) return;
    for (const q of enemyPlayers(p)) {
      const cards = [...q.hand, ...(q.gambits || [])].filter((c) => c.d.mirror);
      if (!cards.length || q.isAI) continue;
      const ch = await pickOption(
        q,
        `Mirror ${p.name}'s ${kind} effect?`,
        [...cards.map((c) => "Play " + c.d.n), "Pass"],
        { purpose: "reaction", contextCards: cards, sub: "Mirror copies one draw or one abolish benefit; it does not copy the entire printed effect." },
      );
      if (ch < cards.length) {
        const c = cards[ch];
        if (c.d.t === "GAMBIT") consumeGambit(q, c);
        else {
          removeFrom(q.hand, c);
          q.inPlay.push(c);
        }
        await runOps(
          q,
          kind === "draw"
            ? [{ op: "draw", n: 1 }]
            : kind === "flavor"
              ? [{ op: "drawFlavor", n: 1 }]
              : [
                  {
                    op: "abolish",
                    from: ["hand", "discard"],
                    max: 1,
                    opt: true,
                  },
                ],
          { card: c, noMirror: true },
        );
        if (c.d.t !== "GAMBIT") q.karma += 2;
        log(
          `<b>${q.name}</b> mirrors the ${kind} effect${c.d.t === "GAMBIT" ? "" : " and gains 2 Karma"}.`,
        );
      }
    }
  }
  async function playCard(p, c, ctx = {}) {
    if (!p.hand.includes(c)) throw Error("This card is not in your hand.");
    removeFrom(p.hand, c);
    if (c.d.t === "ITEM") p.items.push(c);
    else p.inPlay.push(c);
    if (G.players[G.active] === p) p.playedCount++;
    log(`<b>${p.name}</b> plays <b>${c.d.n}</b>.`);
    if (!(await stompWindow(p, c, ctx)))
      await runOps(p, c.d.fx, { ...ctx, card: c, chain: [c.id] });
  }
  function consumeGambit(p, c) {
    removeFrom(p.gambits, c);
    G.gambitRemoved.push(c);
    log(`<b>${p.name}</b> uses Gambit: ${c.d.n}.`);
  }
  async function useGambit(p, c, ctx = {}) {
    if (
      !c ||
      !(p.gambits || []).includes(c) ||
      !["normal", "karma", "fast"].includes(c.d.timing)
    )
      throw Error("This Gambit is available only at its printed timing.");
    if (G.players[G.active] !== p && !c.d.fast)
      throw Error("Use this Gambit during your own turn.");
    consumeGambit(p, c);
    await runOps(p, c.d.fx, { ...ctx, card: c });
  }
  async function useItem(p, c) {
    if (!c || c.tilted || !living(c) || !(c.d.active || c.borrowedActive))
      throw Error("This Item is not available.");
    c.tilted = true;
    await fastWindow(p, `${p.name} activates ${c.d.n}`);
    if (living(c))
      await runOps(p, c.borrowedActive || c.d.active, {
        card: c,
        noFast: true,
      });
  }
  // Fiend targets are announced before opponents decide whether to stomp (base rules p.13).
  async function declareFiend(p, source) {
    const ops = structuredClone(source),
      named = [];
    for (const o of ops) {
      if (o.op === "or") {
        const i = await pickOption(
          p,
          "Declare the Fiend effect",
          [o.la, o.lb],
          {},
        );
        o.declared = await declareFiend(p, i === 0 ? o.a : o.b);
      }
      if (o.op === "abolish") {
        const pool = [
          ...(o.from.includes("hand") ? p.hand : []),
          ...(o.from.includes("discard") ? p.discard : []),
        ].filter((c) => c.d.t !== "FLAVOR");
        const selected = await select(
          p,
          "Declare cards to abolish",
          pool,
          o.max,
          o.opt ? 0 : Math.min(o.max, pool.length),
          "abolish",
        );
        o.declaredSelf = selected.map((c) => c.u);
        named.push(...selected.map((c) => c.d.n));
        if (o.then)
          o.then = selected.length ? await declareFiend(p, o.then) : [];
      }
      if (o.op === "flipGallery") {
        const selected = await select(
          p,
          "Declare Gallery targets",
          G.gallery.filter((c) => c && !c.hiddenBy),
          o.max,
        );
        o.selected = selected.map((c) => c.u);
        named.push(...selected.map((c) => c.d.n));
      }
      if (
        [
          "randomDiscard",
          "oppDiscardItems",
          "discardEnemyItems",
          "enemyAbolish",
          "enemyShuffle",
          "nullify",
          "nullifyAll",
        ].includes(o.op)
      ) {
        const candidates =
          o.all || o.op === "nullifyAll"
            ? enemyPlayers(p)
            : [await pickTarget(p, "Declare the Fiend’s target")];
        o.targetSeats = [];
        o.selections = {};
        for (const q of candidates) {
          const seat = G.players.indexOf(q);
          let selected;
          if (o.op === "randomDiscard" || o.op === "oppDiscardItems") {
            if (
              (await pickOption(
                p,
                `Target ${q.name}?`,
                ["Target this opponent", "Pass"],
                {},
              )) !== 0
            )
              continue;
          } else if (o.op === "enemyShuffle")
            selected = await select(
              p,
              `Declare cards in ${q.name}'s discard`,
              q.discard,
              o.max,
            );
          else if (o.op === "enemyAbolish")
            selected = await select(
              p,
              `Declare a card to abolish from ${q.name}`,
              q.discard.filter(
                (c) => c.d.cost <= o.maxCost && c.d.t !== "FLAVOR",
              ),
            );
          else if (o.op === "discardEnemyItems")
            selected = await select(
              p,
              `Declare ${q.name}'s Item target`,
              q.items,
              o.max || 1,
            );
          else if (o.op === "nullify")
            selected = await select(
              p,
              `Declare ${q.name}'s nullified card`,
              [...q.items, ...q.fiends].filter(living),
              o.max || 1,
            );
          o.targetSeats.push(seat);
          if (selected)
            o.selections[o.op === "enemyShuffle" ? 0 : seat] = selected.map(
              (c) => c.u,
            );
          named.push(
            q.name +
              (selected?.length
                ? " · " + selected.map((c) => c.d.n).join(", ")
                : ""),
          );
        }
      }
    }
    if (named.length) log(`<b>${p.name}</b> declares: ${named.join("; ")}.`);
    return ops;
  }
  async function useFiend(p, c) {
    if (
      !c ||
      !p.fiends.includes(c) ||
      c.spent ||
      !living(c) ||
      !c.d.fiendUse?.length
    )
      throw Error("This Fiend cannot be used.");
    if (c.d.useWhen === "ownStart" && p.playedCount)
      throw Error("Use this Fiend before playing cards.");
    log(`<b>${p.name}</b> unleashes <b>${c.d.n}</b>.`);
    const ops = await declareFiend(p, c.d.fiendUse);
    if ((await stompWindow(p, c)) || !living(c)) return;
    c.spent = true;
    await runOps(p, ops, { card: c });
  }
  async function endTurn(p) {
    await fastWindow(p, `${p.name} is ending their turn`);
    for (const c of [...p.fiends, ...p.items].filter(
      (c) => c.temporary || c.spent,
    )) {
      removeFrom(p.fiends, c);
      removeFrom(p.items, c);
      delete c.temporary;
      G.abyss.push(c);
    }
    p.endTurnEffects = structuredClone(
      p.inPlay.filter((c) => c.borrowedPassive),
    );
    p.inPlay.splice(0).forEach((c) => toDiscard(p, c));
    p.hand.splice(0).forEach((c) => toDiscard(p, c));
    p.karma = 0;
    p.jugCycled = false;
    p.kg = false;
    p.hocus = false;
    p.unityUsed = false;
    p.epicBought = 0;
    p.playedCount = 0;
    p.epicDiscount = 0;
    p.abyssBuy = false;
    p.nextToHand = [];
    for (const c of G.extraGallery.splice(0)) {
      const i = G.gallery.indexOf(null);
      if (i >= 0) G.gallery[i] = c;
      else G.abyss.push(c);
    }
    await refillGallery(p);
    for (let i = 0; i < 3; i++)
      if (!G.epicTier[i]) G.epicTier[i] = G.epicDeck.pop() || null;
    checkEndTriggers();
    await drawSafe(p, 5 + passives(p, "mask").length);
    delete p.endTurnEffects;
    p.turns++;
    log(`<b>${p.name}</b> ends turn ${p.turns}.`);
    if (
      G.endTriggered &&
      G.players.every((q) => q.turns === G.players[0].turns)
    ) {
      gameOver();
      return;
    }
    G.active = (G.active + 1) % G.players.length;
    G.turnN++;
    const np = G.players[G.active];
    if (G.relic) G.relic.tilted = false;
    np.items.forEach((c) => (c.tilted = false));
    for (const q of G.players)
      for (const c of [...q.items, ...q.fiends, ...q.inPlay]) {
        if (c.nullBy === G.active + 1) delete c.nullBy;
      }
    for (let i = 0; i < G.gallery.length; i++) {
      const c = G.gallery[i];
      if (c?.hiddenBy === G.active + 1) {
        delete c.hiddenBy;
        if (c.hiddenAbolish) {
          delete c.hiddenAbolish;
          G.abyss.push(c);
          G.gallery[i] = null;
        }
      }
    }
    await refillGallery(np);
    if (np.hand.length < 5 && np.items.some(c => c.d.passive === "lotus" && living(c))) {
      const c = np.items.find((c) => c.d.passive === "lotus" && living(c));
      const ch = await pickOption(
        np,
        "Discard The Lotus Cross to draw back up to 5?",
        ["Draw back up", "Keep it in play"],
        {},
      );
      if (ch === 0) {
        removeFrom(np.items, c);
        toDiscard(np, c);
        await drawSafe(np, 5 - np.hand.length);
      }
    }
  }
  function gameOver() {
    G.over = true;
    G.scores = G.players.map((p) => ({
      name: p.name,
      gp: scoreGP(p),
      epic: allOwned(p)
        .filter((c) => c.d.t === "EPIC")
        .reduce((n, c) => n + c.d.gp, 0),
    }));
    const groups = G.teams
      ? [
          [0, 2],
          [1, 3],
        ]
      : G.players.map((_, i) => [i]);
    const scores = groups.map((seats) => ({
      seats,
      gp: seats.reduce((sum, i) => sum + G.scores[i].gp, 0),
      epic: seats.reduce((sum, i) => sum + G.scores[i].epic, 0),
    }));
    const best = Math.max(...scores.map((s) => s.gp)),
      tied = scores.filter((s) => s.gp === best),
      epic = Math.max(...tied.map((s) => s.epic));
    G.winners = tied.filter((s) => s.epic === epic).flatMap((s) => s.seats);
    G.tieBreak = tied.length > 1 ? "epic" : "points";
    G.finalTie = G.winners.length > (G.teams ? 2 : 1);
    if (G.teams) G.teamScores = scores;
    log(
      "The Gathering is over. Final Gathering Points and Epic tiebreakers have been counted.",
    );
  }

  async function pickTarget(p, title, players = enemyPlayers(p)) {
    if (players.length === 1) return players[0];
    const i = await pickOption(
      p,
      title,
      players.map((q) => q.name),
      {},
    );
    return players[i];
  }
  async function select(p, title, cards, max = 1, min = 0, purpose = "effect") {
    return pickCards(p, { title, cards, min, max, purpose, skip: min === 0 });
  }
  async function inspectHand(p, q) {
    if (p.isAI) return;
    await pickOption(
      p,
      `${q.name}'s hand: ${q.hand.map((c) => c.d.n).join(", ") || "empty"}`,
      ["Continue"],
      {},
    );
  }
  async function extraOp(p, o, ctx) {
    switch (o.op) {
      case "gambitShield":
        p.gambitShield = G.turnN;
        break;
      case "gambitShuffle":
        if (
          p.discard.length &&
          (await pickOption(
            p,
            "Shuffle your discard pile into your deck?",
            ["Shuffle", "Keep it"],
            {},
          )) === 0
        ) {
          await beforeDiscardShuffle(p);
          p.deck.push(...p.discard.splice(0));
          shuffle(p.deck);
        }
        break;
      case "gambitDiscard": {
        const selected = await select(
          p,
          "Discard one card",
          p.hand,
          1,
          Math.min(1, p.hand.length),
          "discard",
        );
        for (const c of selected) {
          removeFrom(p.hand, c);
          toDiscard(p, c);
        }
        break;
      }
      case "gambitTrade": {
        const [c] = await select(
          p,
          "Abolish a Crew or Item",
          [...p.hand, ...p.discard].filter(
            (c) => crewOf(c) || c.d.t === "ITEM",
          ),
          1,
          0,
          "abolish",
        );
        if (c) {
          removeFrom(p.hand, c);
          removeFrom(p.discard, c);
          G.abyss.push(c);
          await mirrorWindow(p, "abolish", ctx);
          await runOps(p, [{ op: "obtain", maxCost: c.d.cost }], ctx);
        }
        break;
      }
      case "gambitCrewAbolish":
        if (Object.values(crewCounts(p)).some((n) => n >= 4))
          await runOps(
            p,
            [{ op: "abolish", from: ["hand", "discard"], max: 1 }],
            ctx,
          );
        break;
      case "recoverStomped": {
        const pool = p.discard.filter(
          (c) =>
            c.stompedTurn === G.turnN &&
            (o.maxCost == null || c.d.cost <= o.maxCost),
        );
        const selected = await select(
          p,
          "Recover cards stomped this turn",
          pool,
          o.all ? pool.length : 1,
          0,
          "recover",
        );
        for (const c of selected) {
          removeFrom(p.discard, c);
          p.hand.push(c);
        }
        break;
      }
      case "replaceEpic": {
        const [c] = await select(
          p,
          "Replace one Epic Tier card",
          G.epicTier.filter(Boolean),
          1,
          Math.min(1, G.epicTier.filter(Boolean).length),
        );
        if (c) {
          const i = G.epicTier.indexOf(c);
          G.epicDeck.unshift(c);
          G.epicTier[i] = G.epicDeck.pop();
          checkEndTriggers();
        }
        break;
      }
      case "gambitNullify": {
        const q = await pickTarget(p, "Choose an opponent");
        for (const c of o.type === "ITEM" ? q.items : q.fiends)
          c.nullTurn = G.turnN;
        break;
      }
      case "gambitAbyss": {
        const remaining = await select(
          p,
          "Return up to five non-Starters from the Abyss",
          G.abyss.filter((c) => c.d.t !== "START"),
          5,
          0,
          "recover",
        );
        while (remaining.length) {
          const [c] = await select(
            p,
            "Choose the next card to place",
            remaining,
            1,
            1,
          );
          const side = await pickOption(
            p,
            "Place " + c.d.n,
            ["Top of Main Deck", "Bottom of Main Deck"],
            {},
          );
          removeFrom(remaining, c);
          removeFrom(G.abyss, c);
          if (side === 0) G.main.push(c);
          else G.main.unshift(c);
        }
        break;
      }
      case "arrangeDeck": {
        const decks = [
          { name: "Main Deck", cards: G.main },
          { name: "Flavor deck", cards: G.flavor },
          { name: "Epic deck", cards: G.epicDeck },
          { name: "Juggalo deck", cards: G.jug },
          ...G.players.map((q) => ({
            name: q.name + "'s deck",
            cards: q.deck,
          })),
        ].filter((d) => d.cards.length);
        if (!decks.length) break;
        const i = await pickOption(
            p,
            "Choose a deck",
            decks.map((d) => d.name),
            {},
          ),
          deck = decks[i].cards,
          top = deck.splice(-o.n);
        const order = [];
        while (top.length) {
          const [c] = await select(
            p,
            "Choose the next card from the top",
            top,
            1,
            1,
          );
          removeFrom(top, c);
          order.push(c);
        }
        deck.push(...order.reverse());
        break;
      }
      case "noop":
        break;
      case "nextToHand":
        p.nextToHand = o.types;
        break;
      case "epicDiscount":
        p.epicDiscount = (p.epicDiscount || 0) + 1;
        break;
      case "buyAbyss":
        p.abyssBuy = true;
        break;
      case "abolishSelf":
        removeFrom(p.inPlay, ctx.card);
        G.abyss.push(ctx.card);
        break;
      case "crewAbolish":
        if ([...p.inPlay, ...p.items, ...p.fiends].filter(c => c !== ctx.card && crewOf(c) === o.crew).length >= 2)
          await runOps(
            p,
            [{ op: "abolish", from: ["hand", "discard"], max: 1, opt: true }],
            ctx,
          );
        break;
      case "freeUnity": {
        if (await replaceUnity(p)) break;
        const i = await pickOption(
          p,
          "Choose a Unity benefit",
          [
            "Dark Carnival · +2 Karma",
            "Psychopathic · draw 1",
            "Underground · draw Flavor",
          ],
          {},
        );
        await runOps(
          p,
          [
            i === 0
              ? { op: "k", n: 2 }
              : i === 1
                ? { op: "draw", n: 1 }
                : { op: "drawFlavor", n: 1 },
          ],
          ctx,
        );
        break;
      }
      case "juggaloKarma":
        p.karma += [...p.inPlay, ...p.items, ...p.discard, ...(G.relic && G.players[G.active] === p ? [G.relic] : [])].filter((c) =>
          /juggalo/i.test(c.d.n),
        ).length;
        break;
      case "techTop": {
        if (!p.discard.includes(ctx.card)) break;
        if (
          (await pickOption(
            p,
            "Place Tech N9ne on top of your deck?",
            ["Top of deck", "Discard pile"],
            {},
          )) === 0
        ) {
          removeFrom(p.discard, ctx.card);
          p.deck.push(ctx.card);
        }
        break;
      }
      case "changeCrew": {
        const a = await select(
          p,
          "Choose a Crew card in play",
          p.inPlay.filter((c) => CREWS.includes(crewOf(c))),
        );
        if (a[0]) await runOps(p, [{ op: "chooseCrew" }], { card: a[0] });
        break;
      }
      case "copyOwn": {
        const a = await select(
          p,
          "Copy a card in your play area",
          p.inPlay.filter(
            (c) =>
              c !== ctx.card &&
              o.types.includes(crewOf(c) || c.d.t) &&
              !(ctx.chain || []).includes(c.id),
          ),
        );
        if (a[0]) await copyEffect(p, a[0], ctx);
        break;
      }
      case "copyItem": {
        let pool = G.players.flatMap((q) => q.items).filter(living);
        if (o.extra)
          pool = pool.concat(
            G.gallery.filter((c) => c?.d.t === "ITEM" && !c.hiddenBy),
            G.abyss.filter((c) => c.d.t === "ITEM"),
          );
        const a = await select(
          p,
          "Copy an Item until the end of your turn",
          pool,
        );
        if (a[0]) {
          ctx.card.borrowedPassive = a[0].d.passive;
          ctx.card.borrowedActive = a[0].d.active;
          ctx.card.borrowedReaction = a[0].d.reaction;
          ctx.card.tilted = false;
          await runOps(p, a[0].d.fx, ctx);
        }
        break;
      }
      case "nullify":
      case "nullifyAll": {
        const others = enemyPlayers(p);
        const groups = o.targetSeats
          ? o.targetSeats.map((i) => G.players[i])
          : o.op === "nullifyAll"
            ? others
            : o.all
              ? others
              : [await pickTarget(p, "Choose an opponent")];
        for (const q of groups) {
          const pool = [...q.items, ...q.fiends].filter(living),
            selected = o.selections?.[G.players.indexOf(q)]
              ? pool.filter((c) =>
                  o.selections[G.players.indexOf(q)].includes(c.u),
                )
              : o.op === "nullifyAll"
                ? pool
                : await select(p, "Choose a card to nullify", pool, o.max || 1);
          for (const c of selected) {
            if (o.until === "turn") c.nullTurn = G.turnN;
            else c.nullBy = G.players.indexOf(p) + 1;
          }
        }
        break;
      }
      case "flipGallery": {
        const pool = G.gallery.filter((c) => c && !c.hiddenBy),
          a = o.selected
            ? pool.filter((c) => o.selected.includes(c.u))
            : await select(p, "Turn Gallery cards facedown", pool, o.max);
        for (const c of a) {
          c.hiddenBy = G.players.indexOf(p) + 1;
          c.hiddenAbolish = !!o.abolish;
        }
        break;
      }
      case "oppDiscardItems":
      case "discardEnemyItems": {
        const targets = o.targetSeats
          ? o.targetSeats.map((i) => G.players[i])
          : o.all
            ? enemyPlayers(p)
            : [await pickTarget(p, "Choose an opponent")];
        for (const q of targets) {
          if (has(q, "toy") && !o.pierce) continue;
          let cards = q.items.slice();
          if (!cards.length) continue;
          if (o.op === "discardEnemyItems")
            cards = o.selections
              ? cards.filter((c) =>
                  o.selections[G.players.indexOf(q)].includes(c.u),
                )
              : await select(
                  p,
                  `Discard an Item belonging to ${q.name}`,
                  cards,
                  o.max || 1,
                );
          else if (
            !o.targetSeats &&
            (await pickOption(
              p,
              `Discard all of ${q.name}'s Items?`,
              ["Discard them", "Pass"],
              {},
            )) !== 0
          )
            continue;
          for (const c of cards) {
            removeFrom(q.items, c);
            toDiscard(q, c);
          }
          log(`<b>${q.name}</b> discards ${cards.length} Item(s).`);
        }
        break;
      }
      case "randomDiscard": {
        const targets = o.targetSeats
          ? o.targetSeats.map((i) => G.players[i])
          : o.all
            ? enemyPlayers(p)
            : [await pickTarget(p, "Choose an opponent")];
        for (const q of targets)
          if (
            q.hand.length &&
            (o.targetSeats ||
              (await pickOption(
                p,
                `Make ${q.name} discard a random card?`,
                ["Discard", "Pass"],
                {},
              )) === 0)
          ) {
            const c = q.hand.splice(Math.floor(random() * q.hand.length), 1)[0];
            toDiscard(q, c);
            log(`<b>${q.name}</b> discards ${c.d.n}.`);
          }
        break;
      }
      case "enemyAbolish": {
        const targets = o.targetSeats
          ? o.targetSeats.map((i) => G.players[i])
          : o.all
            ? enemyPlayers(p)
            : [await pickTarget(p, "Choose an opponent")];
        for (const q of targets) {
          const pool = q.discard.filter(
              (c) => c.d.cost <= o.maxCost && c.d.t !== "FLAVOR",
            ),
            a = o.selections
              ? pool.filter((c) =>
                  o.selections[G.players.indexOf(q)].includes(c.u),
                )
              : await select(p, `Abolish from ${q.name}'s discard`, pool);
          for (const c of a) {
            removeFrom(q.discard, c);
            G.abyss.push(c);
          }
        }
        break;
      }
      case "enemyShuffle": {
        const q = o.targetSeats
            ? G.players[o.targetSeats[0]]
            : await pickTarget(p, "Choose an opponent"),
          a = o.selections
            ? q.discard.filter((c) => o.selections[0].includes(c.u))
            : await select(
                p,
                `Shuffle cards into ${q.name}'s deck`,
                q.discard,
                o.max,
              );
        for (const c of a) {
          removeFrom(q.discard, c);
          q.deck.push(c);
        }
        shuffle(q.deck);
        break;
      }
      case "peekHand":
        await inspectHand(
          p,
          await pickTarget(p, "Whose hand will you inspect?"),
        );
        break;
      case "peekAll":
        for (const q of enemyPlayers(p)) await inspectHand(p, q);
        break;
      case "peekAttack": {
        const q = await pickTarget(p, "Choose an opponent");
        await inspectHand(p, q);
        const a = await select(
          p,
          `Make ${q.name} discard a Crew or Item`,
          q.hand.filter((c) => CREWS.includes(crewOf(c)) || c.d.t === "ITEM"),
        );
        if (a[0]) {
          removeFrom(q.hand, a[0]);
          toDiscard(q, a[0]);
          await drawSafe(q, 1);
          await inspectHand(p, q);
        }
        break;
      }
      case "enemyMulligan":
        for (const q of enemyPlayers(p)) {
          await inspectHand(p, q);
          if (
            (await pickOption(
              p,
              `Have ${q.name} discard their hand and draw 5?`,
              ["Keep their hand", "Replace their hand"],
              {},
            )) === 1
          ) {
            q.hand.splice(0).forEach((c) => toDiscard(q, c));
            await drawSafe(q, 5);
            await inspectHand(p, q);
          }
        }
        break;
      case "enemyTop":
      case "revealAllTop": {
        const targets =
          o.op === "revealAllTop"
            ? G.players
            : [await pickTarget(p, "Choose an opponent")];
        for (const q of targets) {
          await ensureDeck(q);
          const c = q.deck.at(-1);
          if (c) log(`${q.name} reveals ${c.d.n}.`);
          if (
            c &&
            (await pickOption(
              p,
              `${q.name}'s top card: ${c.d.n}`,
              ["Keep it on top", "Discard it"],
              {},
            )) === 1
          )
            toDiscard(q, q.deck.pop());
        }
        break;
      }
      case "lyte": {
        const [c] = await drawSafe(p, 1);
        if (c) await mirrorWindow(p, "draw", ctx);
        if (
          c &&
          (await pickOption(
            p,
            `You drew ${c.d.n}`,
            ["Keep it", "Discard it and draw again"],
            {},
          )) === 1
        ) {
          removeFrom(p.hand, c);
          toDiscard(p, c);
          const drawn = await drawSafe(p, 1);
          if (drawn.length) await mirrorWindow(p, "draw", ctx);
        }
        break;
      }
      case "abyssToMain": {
        const a = await select(
          p,
          "Return a non-Starter from the Abyss",
          G.abyss.filter((c) => c.d.t !== "START"),
        );
        if (a[0]) {
          removeFrom(G.abyss, a[0]);
          const i = await pickOption(
            p,
            "Where should it go?",
            ["Top of Main Deck", "Bottom of Main Deck"],
            {},
          );
          if (i === 0) G.main.push(a[0]);
          else G.main.unshift(a[0]);
        }
        break;
      }
      case "lastAbyss": {
        const c = G.abyss.pop();
        if (c) await gainCard(p, c, "free");
        break;
      }
      case "abolishFiend": {
        const pool = [
          ...G.gallery,
          ...G.players.flatMap((q) => q.fiends),
        ].filter(
          (c) =>
            c?.d.t === "FIEND" &&
            !c.hiddenBy &&
            (!o.inPlayOnly || !G.gallery.includes(c)),
        );
        const a = await select(p, "Abolish a Fiend", pool);
        if (a[0]) {
          for (const q of G.players) removeFrom(q.fiends, a[0]);
          const i = G.gallery.indexOf(a[0]);
          if (i >= 0) G.gallery[i] = null;
          G.abyss.push(a[0]);
          p.karma += o.gain || 0;
        }
        break;
      }
      case "upgrade": {
        const a = await select(
          p,
          "Abolish a non-Epic to obtain a stronger card",
          [...p.hand, ...p.discard].filter(
            (c) => !["EPIC", "FLAVOR"].includes(c.d.t),
          ),
        );
        if (a[0]) {
          removeFrom(p.hand, a[0]);
          removeFrom(p.discard, a[0]);
          G.abyss.push(a[0]);
          await runOps(
            p,
            [{ op: "obtain", maxCost: a[0].d.cost + 1, opt: true }],
            ctx,
          );
        }
        break;
      }
      case "butterfly":
        for (let i = 0; i < 3; i++) {
          const c = await nextMain(p);
          if (c) G.extraGallery.push(c);
        }
        break;
      case "playMain": {
        const c = await nextMain(p);
        if (c) {
          c.temporary = true;
          if (c.d.t === "FIEND") {
            p.fiends.push(c);
            if (c.d.fiendUse?.length && c.d.useWhen !== "ownStart")
              await useFiend(p, c);
          } else {
            p.hand.push(c);
            await playCard(p, c);
          }
        }
        break;
      }
      case "shuffleAll":
        if (
          (await pickOption(
            p,
            "Shuffle your discard into your deck?",
            ["Shuffle", "Pass"],
            {},
          )) === 0
        ) {
          await beforeDiscardShuffle(p);
          p.deck.push(...p.discard.splice(0));
          shuffle(p.deck);
        }
        break;
      case "rollBand": {
        const r = d12();
        G.lastWheel = r;
        log(`<b>${p.name}</b> rolls ${r}.`);
        p.karma += (o.band === "geto" ? 3 : 2) + (r <= 3 ? 0 : r <= 9 ? 1 : 2);
        if (r >= 10)
          await extraOp(
            p,
            o.band === "geto"
              ? { op: "discardEnemyItems", max: 1 }
              : { op: "abolishFiend", inPlayOnly: true },
            ctx,
          );
        break;
      }
      case "doubleWheel": {
        const a = d12(),
          b = d12();
        const i = await pickOption(
          p,
          `Wheel of Fate: choose ${a} or ${b}`,
          [String(a), String(b)],
          {},
        );
        G.lastWheel = i === 0 ? a : b;
        await runOps(p, WHEEL[G.lastWheel], ctx);
        break;
      }
      case "chicken": {
        for (const q of enemyPlayers(p)) await ensureDeck(q);
        for (const q of enemyPlayers(p))
          if (q.deck.at(-1)) log(`${q.name} reveals ${q.deck.at(-1).d.n}.`);
        const top = enemyPlayers(p)
          .map((q) => q.deck.at(-1))
          .filter((c) => c && (c.d.t === "START" || CREWS.includes(crewOf(c))));
        const a = await select(p, "Copy an opponent’s revealed top card", top);
        if (a[0]) await copyEffect(p, a[0], ctx);
        break;
      }
      case "reorderMain": {
        const top = G.main.splice(-o.n);
        while (top.length) {
          const a = await select(
            p,
            "Choose the next top card (first picked ends up lowest)",
            top,
            1,
            1,
          );
          removeFrom(top, a[0]);
          G.main.push(a[0]);
        }
        break;
      }
      case "oracleFavor": {
        const decks = [
          { name: "Main Deck", cards: G.main },
          { name: "Flavor deck", cards: G.flavor },
          { name: "Epic deck", cards: G.epicDeck },
          { name: "Juggalo deck", cards: G.jug },
          ...G.players.map((q) => ({
            name: q.name + "'s deck",
            cards: q.deck,
          })),
        ].filter((x) => x.cards.length >= 2);
        if (!decks.length) break;
        const i = await pickOption(
            p,
            "Choose a deck",
            decks.map((x) => x.name),
            {},
          ),
          deck = decks[i].cards,
          top = deck.splice(-2);
        log(
          `Revealed from ${decks[i].name}: ${top.map((c) => c.d.n).join(", ")}.`,
        );
        const a = await select(
          p,
          "Choose one to keep on top. The other goes to the bottom.",
          top,
          1,
          1,
        );
        deck.push(a[0]);
        deck.unshift(top.find((c) => c !== a[0]));
        break;
      }
      case "juggaloDay": {
        const cards = [];
        for (let i = 0; i < G.players.length; i++) {
          const c = await nextMain(p);
          if (c) cards.push(c);
        }
        for (const q of G.players) {
          if (!cards.length) break;
          const a = await select(p, `Give one card to ${q.name}`, cards, 1, 1);
          removeFrom(cards, a[0]);
          await gainCard(q, a[0], "free", false);
        }
        break;
      }
      case "tarot": {
        const players = G.players.map(
          (_, i) => G.players[(G.active + i) % G.players.length],
        );
        const passes = [];
        for (const q of players) {
          if (o.kind === "swords") {
            const a = await select(
              q,
              "Three of Swords: give a non-Epic card to your left",
              q.hand.filter((c) => c.d.t !== "EPIC"),
              1,
              q.hand.some((c) => c.d.t !== "EPIC") ? 1 : 0,
            );
            if (a[0]) {
              removeFrom(q.hand, a[0]);
              passes.push([opp(q), a[0]]);
            }
            continue;
          }
          if (o.kind === "wheel") {
            const top = [];
            for (let i = 0; i < 3; i++) {
              await ensureDeck(q);
              if (q.deck.length) top.push(q.deck.pop());
            }
            const disc = await select(
              q,
              "Wheel of Fortune: discard any of these cards",
              top,
              top.length,
            );
            disc.forEach((c) => {
              removeFrom(top, c);
              toDiscard(q, c);
            });
            while (top.length) {
              const a = await select(
                q,
                "Choose the next card to return (last picked is on top)",
                top,
                1,
                1,
              );
              removeFrom(top, a[0]);
              q.deck.push(a[0]);
            }
            continue;
          }
          const ops =
            o.kind === "cups"
              ? [{ op: "fromDiscard", dest: "top", maxCost: 5, opt: true }]
              : o.kind === "death"
                ? [
                    {
                      op: "abolish",
                      from: ["hand", "discard"],
                      max: 1,
                      opt: true,
                    },
                  ]
                : o.kind === "pentacles"
                  ? [{ op: "draw", n: 1 }]
                  : [{ op: "drawFlavor", n: 1 }];
          if (
            ["pentacles", "wands"].includes(o.kind) &&
            (await pickOption(
              q,
              "Resolve " + ctx.card.d.n + "?",
              ["Accept", "Pass"],
              {},
            )) !== 0
          )
            continue;
          await runOps(q, ops, { ...ctx, noMirror: true });
        }
        for (const [q, c] of passes) q.hand.push(c);
        break;
      }
      default:
        throw Error("Unrecognized card effect: " + o.op);
    }
  }
  function aiAction(p) {
    const gambit = (p.gambits || []).find((c) =>
      ["normal", "karma", "fast"].includes(c.d.timing),
    );
    if (gambit) return { type: "gambit", id: gambit.u };
    if (p.hand.length) {
      const sorted = p.hand
        .slice()
        .sort(
          (a, b) =>
            Number(b.d.fx?.some((o) => o.op === "draw")) -
            Number(a.d.fx?.some((o) => o.op === "draw")),
        );
      return { type: "play", id: sorted[0].u };
    }
    const it = [...p.items, ...p.inPlay].find(
      (c) => living(c) && !c.tilted && (c.d.active || c.borrowedActive),
    );
    if (it) return { type: "item", id: it.u };
    if (G.relic?.d.active && !G.relic.tilted) return { type: "relic" };
    const u = unityReady(p);
    if (u) return { type: "unity", crew: u[0] };
    const epic = G.epicTier.findIndex(
      (c) => c && p.karma >= c.d.cost - (p.epicDiscount || 0) && !p.epicBought,
    );
    if (epic >= 0) return { type: "buy", zone: "epic", index: epic };
    const candidates = G.gallery
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c && !x.c.hiddenBy && x.c.d.cost <= p.karma)
      .sort((a, b) => cardValue(b.c) - cardValue(a.c));
    if (candidates[0])
      return { type: "buy", zone: "gallery", index: candidates[0].i };
    if (p.karma >= 3 && G.jug.length) return { type: "buy", zone: "juggalo" };
    const fiend = p.fiends.find(
      (c) =>
        !c.spent &&
        living(c) &&
        c.d.fiendUse?.length &&
        c.d.useWhen !== "ownStart",
    );
    if (fiend) return { type: "fiend", id: fiend.u };
    return { type: "end" };
  }
  async function execute(action) {
    try {
      if (action.type === "start") {
        await newGame(G.config);
      } else if (action.type === "tutorial") {
        tutorialCommand(action.command);
      } else {
        if (!G.players?.length || G.over)
          throw Error("This match is not active.");
        const p = G.players[G.active];
        if (action.type === "bot") {
          if (!p.isAI) throw Error("Not an AI turn.");
          action = aiAction(p);
        }
        checkTutorialAction(action, p);
        switch (action.type) {
          case "gambit": {
            await useGambit(
              p,
              (p.gambits || []).find((c) => c.u === action.id),
            );
            break;
          }
          case "play": {
            const c = p.hand.find((c) => c.u === action.id);
            if (!c) throw Error("Card not in hand.");
            await playCard(p, c);
            break;
          }
          case "ninjas":
            for (const c of p.hand.filter((c) => c.id === "c1203"))
              await playCard(p, c);
            break;
          case "buy": {
            if (action.zone === "epic") await buyEpic(p, action.index);
            else if (action.zone === "gallery") {
              const c = G.gallery[action.index];
              if (!c || c.hiddenBy || p.karma < c.d.cost)
                throw Error("Card cannot be purchased.");
              await buyGallery(p, action.index);
            } else if (action.zone === "juggalo") {
              if (!(await buyJug(p)))
                throw Error("Not enough Karma or no Juggalos remain.");
            } else if (action.zone === "extra") {
              const c = G.extraGallery.find((c) => c.u === action.id);
              if (!c || c.d.cost > p.karma)
                throw Error("Cannot buy this card.");
              p.karma -= c.d.cost;
              removeFrom(G.extraGallery, c);
              await gainCard(p, c, "buy");
            } else if (action.zone === "abyss") {
              const c = G.abyss.find((c) => c.u === action.id),
                cost = Math.max(
                  0,
                  (c?.d.cost || 0) -
                    (c?.d.t === "EPIC" ? p.epicDiscount || 0 : 0),
                );
              if (
                !p.abyssBuy ||
                !c ||
                cost > p.karma ||
                (c.d.t === "EPIC" && p.epicBought >= 1) ||
                ["FLAVOR", "TAROT"].includes(c.d.t)
              )
                throw Error("Cannot buy from the Abyss.");
              await fastWindow(
                p,
                `${p.name} wants to recruit ${c.d.n} from the Abyss`,
              );
              p.karma -= cost;
              if (c.d.t === "EPIC") p.epicBought++;
              p.abyssBuy = false;
              removeFrom(G.abyss, c);
              await gainCard(p, c, "buy");
            } else throw Error("Unknown purchase zone.");
            break;
          }
          case "cycle":
            if (!cycleJug(p)) throw Error("Not enough Karma.");
            break;
          case "item":
            await useItem(
              p,
              [...p.items, ...p.inPlay].find((c) => c.u === action.id),
            );
            break;
          case "relic":
            await useItem(p, G.relic);
            break;
          case "fiend":
            await useFiend(
              p,
              p.fiends.find((c) => c.u === action.id),
            );
            break;
          case "unity":
            if (!unityReady(p)?.includes(action.crew))
              throw Error("Unity is not ready.");
            await claimUnity(p, action.crew);
            break;
          case "end":
            await endTurn(p);
            break;
          default:
            throw Error("Unknown game action.");
        }
      }
      advanceTutorial();
      G.uid = uidC;
      return { state: G, pending: null };
    } catch (e) {
      if (e instanceof Pending) {
        G.uid = uidC;
        return { state: G, pending: e.prompt };
      }
      throw e;
    }
  }
  return {
    execute,
    get state() {
      return G;
    },
  };
}
export async function transition(state, action, answers = []) {
  return makeRuntime(structuredClone(state), answers).execute(action);
}
export function viewState(state, seat) {
  if (!state?.players) return null;
  const g = structuredClone(state);
  g.players.forEach((p, i) => {
    const cards = [
      ...p.deck,
      ...p.hand,
      ...p.discard,
      ...p.inPlay,
      ...p.items,
      ...p.fiends,
    ].filter((c) => c.d.t !== "FLAVOR");
    p.gp = gatheringPoints([
      ...cards,
      ...(i === seat || g.over ? p.gambits || [] : []),
    ]);
    if (p.gambits && i !== seat && !g.over)
      p.gambits = Array(p.gambits.length).fill(null);
    if (p.gambitDraft && i !== seat)
      p.gambitDraft = Array(p.gambitDraft.length).fill(null);
    p.deck = Array(p.deck.length).fill(null);
    if (i !== seat && !g.over) p.hand = Array(p.hand.length).fill(null);
  });
  for (const zone of ["main", "flavor", "epicDeck"]) {
    const top = g[zone].at(-1);
    g[zone] = Array(g[zone].length).fill(null);
    if (g.variants?.mirrors && top) g[zone][g[zone].length - 1] = top;
  }
  g.jug = { count: g.jug.length, top: g.jug.at(-1) || null, cards: g.jug };
  if (g.gambitReserve)
    g.gambitReserve = Array(g.gambitReserve.length).fill(null);
  delete g.rng;
  delete g.uid;
  delete g.config;
  return g;
}

export function gatheringPoints(cards) {
  return cards.reduce(
    (n, c) =>
      n +
      (c.d.variableGP
        ? cards.filter((x) => x !== c && (x.d.crew || x.d.t) === c.d.variableGP)
            .length
        : c.d.gp || 0),
    0,
  );
}
