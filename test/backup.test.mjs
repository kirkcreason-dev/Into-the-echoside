import test from "node:test";
import assert from "node:assert/strict";
import { parseBackup } from "../pages/backup.js";
import { createRoom, changeRoom } from "../pages/room.js";
const backup = (room) =>
  JSON.stringify({ format: "echoside-table-backup", version: 1, room });
test("backup restores full saved state including a pending private Gambit draft", async () => {
  const room = await createRoom("host", {
    name: "Host",
    solo: true,
    expansion: true,
  });
  assert(room.pending);
  const restored = parseBackup(backup(room));
  assert.deepEqual(restored, JSON.parse(JSON.stringify(room)));
  const a = await changeRoom(room, "host", "choice", {
      revision: room.revision,
      answer: [],
    }),
    b = await changeRoom(restored, "host", "choice", {
      revision: room.revision,
      answer: [],
    });
  assert.deepEqual({...a,updatedAt:0}, {...b,updatedAt:0});
});
test("backup canonicalizes card definitions and rejects unknown cards or broken transactions", async () => {
  let room = await createRoom("host", { name: "Host", solo: true });
  const actual = room.game.players[0].hand[0].d.cost;
  room.game.players[0].hand[0].d = { cost: 999 };
  assert.equal(
    parseBackup(backup(room)).game.players[0].hand[0].d.cost,
    actual,
  );
  room.game.players[1].hand[0].id = "unknown";
  assert.throws(() => parseBackup(backup(room)), /valid/);
  room = await createRoom("host", {
    name: "Host",
    solo: true,
    expansion: true,
  });
  delete room.transaction;
  assert.throws(() => parseBackup(backup(room)), /valid/);
});
