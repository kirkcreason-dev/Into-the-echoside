import test from "node:test";
import assert from "node:assert/strict";
import { DB, transition, viewState } from "../server/engine.js";
import { createRoom, changeRoom, projectRoom } from "../pages/room.js";
const defs = Object.fromEntries(DB.map((d) => [d.id, d]));
async function game(n = 2) {
  const { state: g } = await transition(
    {
      config: {
        seed: 8,
        expansion: true,
        gambits: true,
        players: Array.from({ length: n }, (_, i) => ({
          name: "P" + i,
          isAI: true,
        })),
      },
    },
    { type: "start" },
  );
  g.active = 0;
  g.first = 0;
  for (const p of g.players) {
    p.gambits = [];
    p.hand = [];
    p.inPlay = [];
    p.items = [];
    p.fiends = [];
    p.discard = [];
  }
  return g;
}
function add(g, id, seat = 0, zone = "gambits") {
  const c = { id, d: defs[id], u: ++g.uid, tilted: false };
  g.players[seat][zone].push(c);
  return c;
}
async function done(g, a, answers = []) {
  const r = await transition(g, a, answers);
  assert.equal(r.pending, null, JSON.stringify(r.pending));
  return r.state;
}

test("40 Gambits have sourced effects, costs, and independent draft supplies", async () => {
  assert.equal(DB.filter((d) => d.t === "GAMBIT").length, 40);
  for (const n of [2, 3, 4]) {
    const { state: g, pending } = await transition(
      {
        config: {
          seed: 42,
          expansion: true,
          gambits: true,
          players: Array.from({ length: n }, (_, i) => ({
            name: "P" + i,
            isAI: true,
          })),
        },
      },
      { type: "start" },
    );
    assert.equal(pending, null);
    const cards = [
      ...g.gambitReserve,
      ...g.gambitRemoved,
      ...g.players.flatMap((p) => p.gambits),
    ];
    assert.equal(cards.length, 40);
    assert.equal(new Set(cards.map((c) => c.u)).size, 40);
    assert(!g.main.some((c) => c.d.t === "GAMBIT"));
    for (const p of g.players)
      assert(p.gambits.reduce((n, c) => n + c.d.draftCost, 0) <= 3);
  }
});
test("draft budget is enforced, choices replay, and other seats cannot read or answer a draft", async () => {
  let r = await createRoom("host", { name: "Host", expansion: true });
  r = await changeRoom(r, "guest", "join", { name: "Guest" });
  r.seed = 42;
  r = await changeRoom(r, "host", "start", { revision: r.revision });
  assert.equal(r.pending.budget, 3);
  assert.equal(r.pending.cards.length, 10);
  const q = r.pending;
  await assert.rejects(
    changeRoom(r, "guest", "choice", { revision: r.revision, answer: [] }),
    /Another player/,
  );
  const expensive = q.cards.filter((c) => c.d.draftCost >= 2).slice(0, 2);
  assert.equal(expensive.length, 2);
  await assert.rejects(
    changeRoom(r, "host", "choice", {
      revision: r.revision,
      answer: expensive.map((c) => c.u),
    }),
    /Invalid card/,
  );
  assert.equal(projectRoom(r, "guest").pending.kind, "waiting");
  assert(
    projectRoom(r, "guest").game.players[0].gambitDraft.every(
      (c) => c === null,
    ),
  );
  r = await changeRoom(r, "host", "choice", {
    revision: r.revision,
    answer: [q.cards[0].u],
  });
  assert.equal(r.pending.actor, 1);
  assert(
    projectRoom(r, "guest").game.players[0].gambits.every((c) => c === null),
  );
  r = await changeRoom(r, "guest", "choice", {
    revision: r.revision,
    answer: [],
  });
  assert.equal(r.game.phase, undefined);
  for (let steps = 0; r.pending && steps < 100; steps++) {
    const q = r.pending;
    assert.notEqual(q.title, "Choose your Gambits");
    r = await changeRoom(r, r.members[q.actor].session, "choice", {
      revision: r.revision,
      answer:
        q.kind === "cards"
          ? q.cards.slice(0, q.min).map((c) => c.u)
          : q.labels.length - 1,
    });
  }
  assert.equal(r.pending, null);
});
test("every own-turn Gambit effect resolves legally and is removed exactly once", async () => {
  for (const d of DB.filter(
    (d) => d.t === "GAMBIT" && ["normal", "karma", "fast"].includes(d.timing),
  )) {
    let g = await game();
    const c = add(g, d.id);
    add(g, "c1203", 0, "hand");
    add(g, "c2515", 0, "discard");
    add(g, "c1430", 0, "discard");
    add(g, "c2512", 1, "items");
    add(g, "c2823", 1, "fiends");
    for (const x of g.players[0].discard) x.stompedTurn = g.turnN;
    g = await done(g, { type: "gambit", id: c.u });
    assert(!g.players[0].gambits.some((x) => x.u === c.u));
    assert.equal(g.gambitRemoved.filter((x) => x.u === c.u).length, 1);
    await assert.rejects(transition(g, { type: "gambit", id: c.u }), /timing/);
    assert(!Number.isNaN(g.players[0].karma));
  }
});
test("Gambit stomp obeys cost limits and the stronger stomp pierces printed shields", async () => {
  for (const [id, target, allowed] of [
    ["gambit28", "c1430", true],
    ["gambit28", "c1301", false],
    ["gambit07", "c2516", true],
  ]) {
    let g = await game();
    g.players[1].isAI = false;
    const c = add(g, target, 0, "hand");
    const gambit = add(g, id, 1);
    const a = { type: "play", id: c.u },
      r = await transition(g, a);
    if (allowed) {
      assert.equal(r.pending.actor, 1);
      g = await done(g, a, [0]);
      assert(g.gambitRemoved.some((x) => x.u === gambit.u));
      assert(!g.players[0].inPlay.some((x) => x.u === c.u));
    } else assert.equal(r.pending, null);
  }
});
test("Gambit Mirror copies one draw without a regular Mirror card Karma bonus", async () => {
  let g = await game();
  g.players[1].isAI = false;
  const c = add(g, "c2533", 0, "hand");
  add(g, "gambit20", 1);
  g = await done(g, { type: "play", id: c.u }, [0]);
  assert.equal(g.players[1].hand.length, 1);
  assert.equal(g.players[1].karma, 0);
  assert.equal(g.players[1].gambits.length, 0);
});
test("Gambit may replace an announced Epic purchase without charging the buyer", async () => {
  let g = await game();
  g.players[1].isAI = false;
  add(g, "gambit11", 1);
  g.players[0].karma = 30;
  const c = g.epicTier[0];
  g = await done(g, { type: "buy", zone: "epic", index: 0 }, [0, [c.u]]);
  assert.equal(g.players[0].karma, 30);
  assert.equal(g.players[0].epicBought, 0);
  assert.notEqual(g.epicTier[0].u, c.u);
});
test("Gambit scoring remains private until the final score", async () => {
  const g = await game();
  add(g, "gambit02", 1);
  const own = viewState(g, 1),
    other = viewState(g, 0);
  assert.equal(own.players[1].gp - other.players[1].gp, 3);
  assert.equal(other.players[1].gambits[0], null);
  for (const p of g.players) {
    p.deck = [];
    p.turns = 1;
  }
  g.players[0].turns = 0;
  g.endTriggered = true;
  const after = await done(g, { type: "end" });
  assert.equal(after.scores[1].gp, 3);
  assert.equal(viewState(after, 0).players[1].gambits[0].d.gp, 3);
});
test("Ninja Speed controls the first turn and is consumed", async () => {
  let found = false;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const config = {
      seed,
      expansion: true,
      gambits: true,
      players: [
        { name: "A", isAI: false },
        { name: "B", isAI: false },
      ],
    };
    let r = await transition({ config }, { type: "start" });
    const first = r.pending.cards.find((c) => c.id === "gambit40");
    if (first) {
      r = await transition({ config }, { type: "start" }, [[first.u], []]);
      assert.equal(r.pending, null);
      assert.equal(r.state.active, 0);
      assert.equal(r.state.first, 0);
      assert.deepEqual(r.state.firstRolls, []);
      assert(r.state.gambitRemoved.some((c) => c.id === "gambit40"));
      found = true;
    }
  }
  assert(found);
});
test("six complete Gambit games conserve all 40 Gambits and finish with equal turns", async () => {
  for (const n of [2, 3, 4])
    for (const seed of [3, 19]) {
      let { state: g } = await transition(
        {
          config: {
            seed,
            expansion: true,
            gambits: true,
            players: Array.from({ length: n }, (_, i) => ({
              name: "P" + i,
              isAI: true,
            })),
          },
        },
        { type: "start" },
      );
      let steps = 0;
      while (!g.over && steps++ < 2500) {
        g = await done(g, { type: "bot" });
        const gambits = [
          ...g.gambitReserve,
          ...g.gambitRemoved,
          ...g.players.flatMap((p) => p.gambits),
        ];
        assert.equal(gambits.length, 40);
        assert.equal(new Set(gambits.map((c) => c.u)).size, 40);
      }
      assert(g.over);
      assert(g.players.every((p) => p.turns === g.players[0].turns));
    }
});
