import { DB } from "../server/engine.js";
const definitions = Object.fromEntries(DB.map((d) => [d.id, d]));
const number = (value, min = 0, max = 1e7) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
export function validateView(value) {
  const bad = () => {
    throw Error(
      "The host sent an invalid table update. Reconnect to the room to try again.",
    );
  };
  if (
    !value ||
    !/^[A-Z2-9]{8}$/.test(value.code) ||
    !number(value.revision) ||
    !["lobby", "playing", "complete"].includes(value.status) ||
    !Array.isArray(value.members) ||
    value.members.length < 1 ||
    value.members.length > 4 ||
    !number(value.seat, 0, value.members.length - 1)
  )
    bad();
  for (const m of value.members)
    if (typeof m.name !== "string" || m.name.length > 24) bad();
  const card = (c) => {
    if (c === null) return c;
    if (!c || !number(c.u, 1) || !definitions[c.id]) bad();
    return { ...c, d: definitions[c.id] };
  };
  const cards = (list, max = 1000) => {
    if (!Array.isArray(list) || list.length > max) bad();
    return list.map(card);
  };
  const g = value.game;
  if (g) {
    if (
      !Array.isArray(g.players) ||
      g.players.length !== value.members.length ||
      !number(g.active, 0, g.players.length - 1) ||
      !number(g.turnN, 1) ||
      !Array.isArray(g.log) ||
      g.log.length > 50000 ||
      g.log.some((s) => typeof s !== "string" || s.length > 10000)
    )
      bad();
    for (const p of g.players) {
      if (
        typeof p.name !== "string" ||
        p.name.length > 24 ||
        !number(p.karma) ||
        !number(p.gp, -100000)
      )
        bad();
      for (const zone of [
        "deck",
        "hand",
        "discard",
        "inPlay",
        "items",
        "fiends",
      ])
        p[zone] = cards(p[zone]);
      for (const zone of ["gambits", "gambitDraft"])
        if (p[zone]) p[zone] = cards(p[zone], 40);
    }
    for (const zone of [
      "main",
      "flavor",
      "flavorDis",
      "abyss",
      "tarotDiscard",
      "epicDeck",
      "epicTier",
      "gallery",
      "extraGallery",
    ])
      g[zone] = cards(g[zone]);
    for (const zone of ["gambitReserve", "gambitRemoved"])
      if (g[zone]) g[zone] = cards(g[zone], 40);
    if (g.relic) g.relic = card(g.relic);
    if (!g.jug || !number(g.jug.count, 0, 100)) bad();
    g.jug.top = card(g.jug.top);
    if (g.jug.cards) g.jug.cards = cards(g.jug.cards, 100);
    if (g.scores) {
      if (!Array.isArray(g.scores) || g.scores.length > 4) bad();
      for (const s of g.scores)
        if (typeof s.name !== "string" || !number(s.gp, -100000)) bad();
    }
    if (
      g.winners &&
      (!Array.isArray(g.winners) || g.winners.some((i) => !number(i, 0, 3)))
    )
      bad();
  }
  const q = value.pending;
  if (q) {
    if (
      !number(q.actor, 0, value.members.length - 1) ||
      typeof q.title !== "string" ||
      q.title.length > 2000 ||
      !["waiting", "cards", "option"].includes(q.kind)
    )
      bad();
    if (
      q.kind === "option" &&
      (!Array.isArray(q.labels) ||
        q.labels.length > 1000 ||
        q.labels.some((s) => typeof s !== "string" || s.length > 2000))
    )
      bad();
    if (q.contextCards) q.contextCards = cards(q.contextCards);
    if (q.kind === "cards") {
      q.cards = cards(q.cards);
      if (
        !number(q.min, 0, q.cards.length) ||
        !number(q.max, q.min, q.cards.length)
      )
        bad();
    }
  }
  return value;
}
