import Peer from "peerjs";
import { parseBackup } from "./backup.js";
import { createRoom, changeRoom, projectRoom, fail } from "./room.js";
import {
  readRoom,
  writeRoom,
  identity,
  recentRooms,
  remember,
  roomIdentity,
  saveRoomIdentity,
} from "./storage.js";
import { validateView } from "./validate-view.js";

const prefix = "echoside-table-v1-";
let session,
  host,
  guest,
  openingHost,
  openingGuest,
  queue = Promise.resolve();
const serial = (fn) => {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
};
const sessionId = (code) =>
  code ? roomIdentity(code) : (session ||= identity());
const networkError = () =>
  new Error(
    "Could not reach the host. Keep the host’s game tab open, then try again. Some networks block direct game connections.",
  );
const connectionStatus = (connected) =>
  window.dispatchEvent(
    new CustomEvent("echoside-connection", { detail: { connected } }),
  );

function openPeer(id) {
  return new Promise((resolve, reject) => {
    const peer = new Peer(id, { secure: true, debug: 0 });
    let ready = false;
    const timer = setTimeout(() => {
      peer.destroy();
      reject(networkError());
    }, 14000);
    peer.on("open", () => {
      ready = true;
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on("error", (e) => {
      if (ready) return;
      clearTimeout(timer);
      peer.destroy();
      reject(
        new Error(
          e.type === "unavailable-id"
            ? "This table is already open in another tab. Return to that tab, or close it before resuming here."
            : networkError().message,
        ),
      );
    });
  });
}
function closeGuest() {
  if (guest) {
    guest.peer.destroy();
    for (const r of guest.requests.values()) r.reject(networkError());
    guest.requests.clear();
    guest = null;
  }
}
function closeHost() {
  if (host) {
    host.peer.destroy();
    host = null;
  }
}
function decorate(room, caller) {
  const view = projectRoom(room, caller);
  view.members = view.members.map((m, i) => ({
    ...m,
    connected:
      i === 0 ||
      m.isAI ||
      !!host?.connections.some(
        (c) => c.open && c.session === room.members[i].session,
      ),
  }));
  return view;
}
async function hostRequest(code, caller, route, body, remote = false) {
  return serial(async () => {
    const source = await readRoom(code);
    if (!source) fail(404, "Room not found.");
    if (remote && (source.solo || caller === source.members[0].session))
      fail(403, "This player cannot control the host.");
    if (!route) return decorate(source, caller);
    if (
      route === "start" &&
      source.members.some(
        (m, i) =>
          i > 0 &&
          !m.isAI &&
          !host?.connections.some((c) => c.open && c.session === m.session),
      )
    )
      fail(409, "Wait for everyone to reconnect before starting.");
    const updated = await changeRoom(source, caller, route, body);
    await writeRoom(updated);
    return decorate(updated, caller);
  });
}
async function serve(code) {
  if (host?.code === code && !host.peer.destroyed) {
    if (host.peer.disconnected) host.peer.reconnect();
    return;
  }
  if (openingHost) return openingHost;
  openingHost = (async () => {
    closeGuest();
    closeHost();
    const peer = await openPeer(prefix + code),
      current = { code, peer, connections: [] };
    host = current;
    peer.on("error", () => connectionStatus(false));
    peer.on("disconnected", () => {
      connectionStatus(false);
      if (!peer.destroyed)
        setTimeout(() => {
          if (host === current && peer.disconnected) peer.reconnect();
        }, 2000);
    });
    peer.on("open", () => connectionStatus(true));
    peer.on("connection", (conn) => {
      if (
        host !== current ||
        current.connections.filter((c) => c.open).length >= 12
      ) {
        conn.close();
        return;
      }
      current.connections.push(conn);
      let calls = 0,
        windowStart = Date.now();
      const stale = setTimeout(() => {
        if (!conn.session) conn.close();
      }, 10000);
      conn.on("close", () => {
        clearTimeout(stale);
        current.connections = current.connections.filter((c) => c !== conn);
      });
      conn.on("error", () => conn.close());
      conn.on("data", async (message) => {
        if (Date.now() - windowStart > 10000) {
          windowStart = Date.now();
          calls = 0;
        }
        if (
          ++calls > 80 ||
          !message ||
          typeof message !== "object" ||
          JSON.stringify(message).length > 12000
        ) {
          conn.close();
          return;
        }
        const { id, token, route, body } = message;
        if (
          typeof id !== "string" ||
          id.length > 80 ||
          typeof token !== "string" ||
          !/^[a-zA-Z0-9-]{36,64}$/.test(token) ||
          ![
            "",
            "join",
            "start",
            "action",
            "choice",
            "bot",
            "tutorial",
            "timeout",
            "tiebreak",
          ].includes(route)
        ) {
          conn.close();
          return;
        }
        if (conn.session && conn.session !== token) {
          conn.close();
          return;
        }
        conn.session = token;
        try {
          const data = await hostRequest(code, token, route, body, true);
          if (conn.open) conn.send({ id, data });
        } catch (e) {
          if (conn.open)
            conn.send({ id, error: e.message, status: e.status || 400 });
        }
      });
    });
    connectionStatus(true);
  })().finally(() => {
    openingHost = null;
  });
  return openingHost;
}
async function connect(code) {
  if (guest?.code === code && guest.conn.open) return guest;
  if (openingGuest) return openingGuest;
  openingGuest = (async () => {
    closeGuest();
    closeHost();
    const peer = await openPeer("echoside-player-" + crypto.randomUUID());
    const conn = peer.connect(prefix + code, {
        reliable: true,
        serialization: "binary",
      }),
      current = { code, peer, conn, requests: new Map() };
    guest = current;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (guest === current) closeGuest();
        reject(networkError());
      }, 14000);
      const lost = () => {
        clearTimeout(timer);
        connectionStatus(false);
        for (const r of current.requests.values()) r.reject(networkError());
        current.requests.clear();
        reject(networkError());
      };
      conn.on("open", () => {
        clearTimeout(timer);
        connectionStatus(true);
        resolve(current);
      });
      conn.on("close", lost);
      conn.on("error", lost);
      peer.on("error", lost);
      conn.on("data", (message) => {
        if (!message || typeof message !== "object") return;
        const pending = current.requests.get(message.id);
        if (!pending) return;
        current.requests.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) {
          const e = new Error(String(message.error));
          e.status = message.status;
          pending.reject(e);
        } else {
          try {
            pending.resolve(validateView(message.data));
          } catch (e) {
            pending.reject(e);
          }
        }
      });
    });
  })().finally(() => {
    openingGuest = null;
  });
  return openingGuest;
}
async function remoteRequest(code, route, body) {
  const client = await connect(code),
    id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.requests.delete(id);
      reject(networkError());
    }, 10000);
    client.requests.set(id, { resolve, reject, timer });
    client.conn.send({ id, token: sessionId(code), route, body });
  });
}
export async function pagesApi(path, body) {
  let token;
  if (path === "session") return { rooms: recentRooms() };
  if (path === "rooms" && body) {
    token = crypto.randomUUID();
    const room = await createRoom(token, body);
    saveRoomIdentity(room.code, token);
    if (!room.solo) await serve(room.code);
    else {
      closeGuest();
      closeHost();
    }
    await writeRoom(room);
    const view = decorate(room, token);
    remember(view);
    return view;
  }
  const match = path.match(
    /^rooms\/([A-Z2-9]{8})(?:\/(join|start|action|choice|bot|tutorial|timeout|tiebreak))?$/,
  );
  if (!match) fail(404, "Room not found. Check the code.");
  const [, code, route = ""] = match,
    owned = await readRoom(code);
  token = sessionId(code);
  let view;
  if (owned?.members[0].session === token) {
    if (!owned.solo) await serve(code);
    // Serialize all writes, including moves from multiple tabs when Web Locks is available.
    const change = () => hostRequest(code, token, route, body);
    view = navigator.locks
      ? await navigator.locks.request("echoside-" + code, change)
      : await change();
  } else view = await remoteRequest(code, route, body);
  remember(view);
  return view;
}

export function recoveryKey(code) {
  return `ECHOSIDE1.${code}.${sessionId(code)}`;
}
export async function recoverSeat(key) {
  const match = String(key)
    .trim()
    .match(/^ECHOSIDE1\.([A-Z2-9]{8})\.([a-zA-Z0-9-]{36,64})$/);
  if (!match) throw Error("That recovery key is not valid.");
  const [, code, token] = match,
    previous = sessionId(code);
  saveRoomIdentity(code, token);
  try {
    return await pagesApi("rooms/" + code);
  } catch (e) {
    saveRoomIdentity(code, previous);
    throw e;
  }
}
export async function exportTable(code) {
  const room = await readRoom(code);
  if (!room || room.members[0].session !== sessionId(code))
    throw Error(
      "Only the host can save a full table backup. Use your seat recovery key to reconnect as a guest.",
    );
  return JSON.stringify({ format: "echoside-table-backup", version: 1, room });
}
export async function importTable(text) {
  const room = parseBackup(text);
  const existing = await readRoom(room.code);
  if (existing && existing.revision > room.revision)
    throw Error("This device already has a newer version of this table.");
  closeHost();
  closeGuest();
  await writeRoom(room);
  saveRoomIdentity(room.code, room.members[0].session);
  return pagesApi("rooms/" + room.code);
}
