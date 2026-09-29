import { DB } from "../server/engine.js";
import { projectRoom } from "./room.js";
import { validateView } from "./validate-view.js";
const definitions = Object.fromEntries(DB.map((d) => [d.id, d]));
export function parseBackup(text) {
  if (typeof text !== "string" || text.length > 5e6)
    throw Error("This backup is too large.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error("Choose a valid game backup file.");
  }
  const room = data?.room;
  const bad = () => {
    throw Error("This is not a valid Echoside table backup.");
  };
  if (
    data?.format !== "echoside-table-backup" ||
    data.version !== 1 ||
    !room ||
    !Array.isArray(room.members) ||
    !room.members.length ||
    room.members.length > 4 ||
    !Number.isSafeInteger(room.updatedAt)
  )
    bad();
  for (const m of room.members)
    if (
      typeof m.session !== "string" ||
      m.session.length < 1 ||
      m.session.length > 100
    )
      bad();
  if (new Set(room.members.map((m) => m.session)).size !== room.members.length)
    bad();
  let count = 0;
  function canonicalize(value, depth = 0) {
    if (depth > 45 || ++count > 200000) bad();
    if (!value || typeof value !== "object") return;
    if ("u" in value && "id" in value) {
      if (
        !definitions[value.id] ||
        !Number.isSafeInteger(value.u) ||
        value.u < 1
      )
        bad();
      value.d = definitions[value.id];
    }
    for (const [key, child] of Object.entries(value))
      if (key !== "d") canonicalize(child, depth + 1);
  }
  canonicalize(room);
  for (const m of room.members) validateView(projectRoom(room, m.session));
  if (!!room.pending !== !!room.transaction) bad();
  if (room.transaction) {
    const tx = room.transaction;
    if (
      !tx.base ||
      !tx.action ||
      !Array.isArray(tx.answers) ||
      tx.answers.length > 1000
    )
      bad();
    if (tx.base.players) {
      for (const m of room.members)
        validateView(
          projectRoom({ ...room, game: tx.base, pending: null }, m.session),
        );
    } else if (
      tx.action.type !== "start" ||
      !tx.base.config ||
      tx.base.config.players?.length !== room.members.length
    )
      bad();
  }
  return room;
}
