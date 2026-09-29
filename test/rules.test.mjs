import test from "node:test";
import assert from "node:assert/strict";
import {
  DB,
  transition,
  viewState,
  gatheringPoints,
} from "../server/engine.js";
import { createRoom, changeRoom, projectRoom } from "../pages/room.js";
const defs = Object.fromEntries(DB.map((d) => [d.id, d]));
const owned = (p) => [
  ...p.deck,
  ...p.hand,
  ...p.inPlay,
  ...p.items,
  ...p.fiends,
  ...p.discard,
];
async function game(options = {}) {
  const n = options.teams ? 4 : 2;
  const r = await transition(
    {
      config: {
        seed: 31,
        players: Array.from({ length: n }, (_, i) => ({
          name: "P" + i,
          isAI: true,
        })),
        ...options,
      },
    },
    { type: "start" },
  );
  const g = r.state;
  g.active = 0;
  g.first = 0;
  for (const p of g.players) {
    p.hand = [];
    p.items = [];
    p.fiends = [];
    p.inPlay = [];
    p.discard = [];
    p.karma = 0;
  }
  return g;
}
function add(g, id, seat = 0, zone = "hand") {
  const c = { id, u: ++g.uid, d: defs[id], tilted: false };
  g.players[seat][zone].push(c);
  return c;
}
const done = async (g, a, answers = []) => {
  const r = await transition(g, a, answers);
  assert.equal(r.pending, null, JSON.stringify(r.pending));
  return r.state;
};

test("base rulebook p10: cycle Juggalos only once per turn", async () => {
  let g = await game();
  g.players[0].karma = 3;
  g = await done(g, { type: "cycle" });
  assert.equal(g.players[0].karma, 2);
  await assert.rejects(transition(g, { type: "cycle" }));
  g = await done(g, { type: "end" });
  assert.equal(g.players[0].jugCycled, false);
});
test("base setup has real first-player rolls and beginner component exclusions", async () => {
  const g = await game({ advanced: false });
  assert.equal(g.main.length + g.gallery.length, 83);
  assert(
    ![...g.main, ...g.gallery].some(
      (c) => c.d.t === "FIEND" || ["axe", "toy"].includes(c.d.passive),
    ),
  );
  assert(g.firstRolls.flat().every((r) => r.roll >= 1 && r.roll <= 12));
});
test("Flavor cannot be abolished from a hand", async () => {
  const g = await game();
  g.players[0].isAI = false;
  const actor = add(g, "c1403"),
    flavor = add(g, "c2904"),
    ninja = add(g, "c1203");
  const r = await transition(g, { type: "play", id: actor.u });
  assert.equal(r.pending.kind, "cards");
  assert(!r.pending.cards.some((c) => c.u === flavor.u));
  assert(r.pending.cards.some((c) => c.u === ninja.u));
});
test("FAQ: Entourage can copy a Juggalo without changing crew", async () => {
  const g = await game(),
    actor = add(g, "c2721");
  add(g, "c3000", 0, "inPlay");
  const after = await done(g, { type: "play", id: actor.u });
  assert.equal(after.players[0].karma, 2);
  assert.equal(after.players[0].inPlay.at(-1).crewOverride, undefined);
});
test("FAQ: Boondox copying Soopa Soaka draws and retains its Item ability", async () => {
  const g = await game(),
    actor = add(g, "c2715");
  add(g, "c2512", 1, "items");
  const count = g.players[0].hand.length;
  const after = await done(g, { type: "play", id: actor.u });
  assert.equal(after.players[0].hand.length, count);
  assert(after.players[0].inPlay.at(-1).borrowedReaction);
});
test("copied Item activation is usable once after copying", async () => {
  let g = await game();
  const actor = add(g, "c2715");
  add(g, "c2515", 1, "items");
  g = await done(g, { type: "play", id: actor.u });
  g = await done(g, { type: "item", id: actor.u });
  assert.equal(g.players[0].hand.filter((c) => c.d.t === "FLAVOR").length, 1);
  await assert.rejects(transition(g, { type: "item", id: actor.u }));
});
test("Soopa Soaka cannot stomp from hand", async () => {
  const g = await game(),
    actor = add(g, "c1203");
  g.players[1].isAI = false;
  add(g, "c2512", 1);
  const r = await transition(g, { type: "play", id: actor.u });
  assert.equal(r.pending, null);
});
test("FAQ: Killjoy Club can counter a stomp; original card resolves", async () => {
  const g = await game(),
    actor = add(g, "c1430");
  g.players[0].isAI = false;
  g.players[1].isAI = false;
  const counter = add(g, "c2516", 0),
    stomp = add(g, "c1400", 1);
  const action = { type: "play", id: actor.u };
  const a = await transition(g, action);
  assert.equal(a.pending.actor, 1);
  const b = await transition(g, action, [0]);
  assert.equal(b.pending.actor, 0);
  assert.match(b.pending.labels[0], /Killjoy/);
  const after = await done(g, action, [0, 0]);
  assert.equal(after.players[0].karma, 2);
  assert(after.players[0].discard.some((c) => c.u === counter.u));
  assert(after.players[1].discard.some((c) => c.u === stomp.u));
  assert(after.players[0].inPlay.some((c) => c.u === actor.u));
});
test("used Fiends stay in play but cannot be reused before the end of turn", async () => {
  let g = await game(),
    fiend = add(g, "c2803", 0, "fiends");
  g = await done(g, { type: "fiend", id: fiend.u });
  assert.equal(g.players[0].fiends[0].spent, true);
  assert(!g.abyss.some((c) => c.u === fiend.u));
  await assert.rejects(transition(g, { type: "fiend", id: fiend.u }));
  g = await done(g, { type: "end" });
  assert(g.abyss.some((c) => c.u === fiend.u));
});
test("Fiend victim is declared before stomp and a stomp cancels Karma", async () => {
  const g = await game();
  g.players[0].isAI = false;
  g.players[1].isAI = false;
  add(g, "c1203", 1);
  add(g, "c1400", 1);
  const fiend = add(g, "c2821", 0, "fiends"),
    action = { type: "fiend", id: fiend.u };
  const a = await transition(g, action);
  assert.equal(a.pending.actor, 0);
  assert.match(a.pending.title, /Target P1/);
  const b = await transition(g, action, [0]);
  assert.equal(b.pending.actor, 1);
  assert(b.state.log.some((s) => /declares: P1/.test(s)));
  const after = await done(g, action, [0, 0]);
  assert.equal(after.players[0].karma, 0);
  assert(after.abyss.some((c) => c.u === fiend.u));
});
test("team gifts cost 1, consume buyer delivery bonuses, and go to partner discard", async () => {
  let g = await game({ teams: true });
  g.players[0].isAI = false;
  g.players[0].karma = 4;
  g.players[0].nextToHand = ["DC"];
  const c = g.jug.find((c) => c.d.crew === "DC");
  g.jug.splice(g.jug.indexOf(c), 1);
  g.jug.push(c);
  g = await done(g, { type: "buy", zone: "juggalo" }, [1]);
  assert.equal(g.players[0].karma, 0);
  assert.deepEqual(g.players[0].nextToHand, []);
  assert(g.players[2].discard.some((x) => x.u === c.u));
  assert(!g.players[2].hand.some((x) => x.u === c.u));
});
test("opponent effects and stomp windows exclude teammates", async () => {
  const g = await game({ teams: true });
  g.players[2].isAI = false;
  add(g, "c1400", 2);
  add(g, "c2515", 1, "items");
  const ally = add(g, "c2515", 2, "items");
  add(g, "c2515", 3, "items");
  const fiend = add(g, "c2816", 0, "fiends");
  const after = await done(g, { type: "fiend", id: fiend.u });
  assert(after.players[2].items.some((c) => c.u === ally.u));
  assert.equal(after.players[1].items.length, 0);
  assert.equal(after.players[3].items.length, 0);
});
test("Epic GP breaks total GP ties", async () => {
  const g = await game();
  for (const p of g.players) p.deck = [];
  add(g, "c1301", 0, "discard");
  add(g, "c1420", 1, "discard");
  add(g, "c1420", 1, "discard");
  g.endTriggered = true;
  g.players[1].turns = 1;
  const after = await done(g, { type: "end" });
  assert.deepEqual(
    after.scores.map((s) => s.gp),
    [4, 4],
  );
  assert.deepEqual(after.winners, [0]);
  assert.equal(after.tieBreak, "epic");
});
test("GP ignores temporary Hound Dog crew assignments", async () => {
  const g = await game();
  const red = add(g, "c1425"),
    hound = add(g, "c1200");
  hound.crewOverride = "DC";
  assert.equal(gatheringPoints([red, hound]), 0);
  assert.equal(viewState(g, 0).players[0].gp, 0);
});
test("Fast Dumpin can interrupt an announced purchase without spending buyer Karma", async () => {
  const g = await game({ expansion: true });
  g.players[1].isAI = false;
  add(g, "c1409", 1);
  g.players[0].karma = 10;
  const c = g.gallery[0],
    a = { type: "buy", zone: "gallery", index: 0 };
  const first = await transition(g, a);
  assert.match(first.pending.title, /wants to recruit/);
  const after = await done(g, a, [0, [c.u]]);
  assert.equal(after.players[0].karma, 10);
  assert(after.abyss.some((x) => x.u === c.u));
  assert.equal(after.players[1].karma, 2);
});
test("Fast Bitch Slap interrupts an Item and consumes its activation", async () => {
  const g = await game({ expansion: true }),
    item = add(g, "c2502", 0, "items");
  g.players[1].isAI = false;
  add(g, "c1404", 1);
  const after = await done(g, { type: "item", id: item.u }, [0, [item.u]]);
  assert.equal(after.players[0].items[0].tilted, true);
  assert.equal(after.players[0].items[0].nullTurn, g.turnN);
  assert.deepEqual(after.gallery, g.gallery);
});
test("Mirror takes one draw after Jumpsteady draws two and carries Karma forward", async () => {
  const g = await game({ expansion: true });
  g.players[1].isAI = false;
  const actor = add(g, "c2533");
  add(g, "c1414", 1);
  const after = await done(g, { type: "play", id: actor.u }, [0]);
  assert.equal(after.players[0].hand.length, 2);
  assert.equal(after.players[1].hand.length, 1);
  assert.equal(after.players[1].karma, 2);
  assert.equal(after.players[1].inPlay.length, 1);
});
test("Jacob’s Word grants its printed +2 Karma", async () => {
  const g = await game({ expansion: true }),
    actor = add(g, "c2915");
  const after = await done(g, { type: "play", id: actor.u });
  assert.equal(after.players[0].karma, 2);
});
test("public Juggalo order is visible while private deck order stays hidden", async () => {
  const g = await game(),
    v = viewState(g, 0);
  assert.equal(v.jug.cards.length, 21);
  assert(v.jug.cards.every((c) => c.d.n === "Juggalo"));
  assert(v.main.every((c) => c === null));
  assert(v.players[1].deck.every((c) => c === null));
});
test("team rooms need four seats and solo teams create one ally and two opponents", async () => {
  let room = await createRoom("host", { name: "Host", teams: true });
  room = await changeRoom(room, "guest", "join", { name: "Guest" });
  await assert.rejects(
    changeRoom(room, "host", "start", { revision: room.revision }),
    /four seats/,
  );
  const solo = await createRoom("host", {
    name: "Host",
    teams: true,
    solo: true,
  });
  assert.equal(solo.game.players.length, 4);
  assert.equal(solo.game.teams, true);
});
test("room clock refuses early timeout and advances a stalled turn after expiry", async () => {
  let room = await createRoom("host", { name: "Host", turnSeconds: 120 });
  room = await changeRoom(room, "guest", "join", { name: "Guest" });
  room = await changeRoom(room, "host", "start", { revision: room.revision });
  await assert.rejects(
    changeRoom(room, "host", "timeout", { revision: room.revision }),
    /still has time/,
  );
  const active = room.game.active;
  room.updatedAt = Date.now() - 121000;
  room = await changeRoom(room, "host", "timeout", { revision: room.revision });
  assert.equal(room.game.active, 1 - active);
  assert(projectRoom(room, "host").deadline > Date.now());
});
test("Juggalo Juice only replaces the card just obtained", async () => {
  let g = await game();
  g.players[0].karma = 30;
  g = await done(g, { type: "buy", zone: "gallery", index: 0 });
  add(g, "c2503", 0, "items");
  g = await done(g, { type: "buy", zone: "gallery", index: 1 });
  assert.equal(g.gallery[0], null);
  assert(g.gallery[1]);
});
test("Gallery wipes replace their targets without filling previously empty spaces", async () => {
  const g = await game();
  g.players[0].isAI = false;
  const actor = add(g, "c1412");
  g.gallery[0] = null;
  const target = g.gallery[1];
  const after = await done(g, { type: "play", id: actor.u }, [[target.u]]);
  assert.equal(after.gallery[0], null);
  assert(after.gallery[1]);
  assert.notEqual(after.gallery[1].u, target.u);
});
test("each My Axe may trigger on the same Fiend acquisition", async () => {
  const g = await game();
  add(g, "c2508", 0, "items");
  add(g, "c2508", 0, "items");
  const a = add(g, "c1203"),
    b = add(g, "c1203");
  g.players[0].karma = 10;
  const fiend = add(g, "c2823");
  g.players[0].hand.pop();
  g.gallery[0] = fiend;
  const after = await done(g, { type: "buy", zone: "gallery", index: 0 });
  assert(after.abyss.some((c) => c.u === a.u));
  assert(after.abyss.some((c) => c.u === b.u));
  assert(after.players[0].items.every((c) => c.tilted));
});
test("The Smog declares all opponents and nullifies their permanents", async () => {
  const g = await game({ expansion: true });
  const actor = add(g, "c2815", 0, "fiends");
  const item = add(g, "c2515", 1, "items");
  const after = await done(g, { type: "fiend", id: actor.u });
  assert.equal(after.players[1].items.find((c) => c.u === item.u).nullBy, 1);
});
