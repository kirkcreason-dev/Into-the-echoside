import { createRoom, changeRoom, projectRoom } from "../pages/room.js";
const encoder = new TextEncoder();
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function fail(status, message) {
  throw new HttpError(status, message);
}
function cleanName(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s || s.length > 24 || /[<>\x00-\x1f]/.test(s))
    fail(400, "Use a name between 1 and 24 characters.");
  return s.replace(/[&"']/g, "");
}
async function hash(s) {
  return [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(s))),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
async function body(request) {
  if (Number(request.headers.get("Content-Length")) > 10000)
    fail(413, "Request too large.");
  let s = await request.text();
  if (s.length > 10000) fail(413, "Request too large.");
  try {
    return JSON.parse(s);
  } catch {
    fail(400, "Invalid request.");
  }
}
async function session(request, db) {
  const c = (request.headers.get("Cookie") || "").match(
    /(?:^|;\s*)echo_session=([a-f0-9]{64})(?:;|$)/,
  )?.[1];
  if (c) {
    const id = await hash(c);
    const found = await db
      .prepare("SELECT id FROM sessions WHERE id = ?")
      .bind(id)
      .first();
    if (found) return { id };
  }
  const secret = token(),
    id = await hash(secret);
  await db
    .prepare("INSERT INTO sessions(id,created_at) VALUES (?,?)")
    .bind(id, Date.now())
    .run();
  return {
    id,
    cookie: `echo_session=${secret}; HttpOnly; Path=/; SameSite=Lax; Max-Age=15552000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}

function unpack(row) {
  const payload = JSON.parse(row.state);
  return {
    ...payload,
    code: row.code,
    revision: row.revision,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.DB)
      return json(
        { error: "The game service is temporarily unavailable." },
        503,
      );
    try {
      if (!["GET", "POST"].includes(request.method))
        fail(405, "Method not allowed.");
      if (request.method === "POST") {
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
          fail(403, "Open the game directly to continue.");
        if (!request.headers.get("Content-Type")?.includes("application/json"))
          fail(415, "Expected JSON.");
      }
      const s = await session(request, env.DB),
        headers = s.cookie ? { "Set-Cookie": s.cookie } : {};
      if (url.pathname === "/api/session" && request.method === "GET") {
        const rooms = await env.DB.prepare(
          "SELECT rooms.code, rooms.status, rooms.updated_at FROM seats JOIN rooms ON rooms.code=seats.room WHERE seats.session = ? ORDER BY rooms.updated_at DESC LIMIT 10",
        )
          .bind(s.id)
          .all();
        return json({ rooms: rooms.results }, 200, headers);
      }
      if (url.pathname === "/api/rooms" && request.method === "POST") {
        const b = await body(request),
          count = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM rooms WHERE host = ? AND updated_at > ?",
          )
            .bind(s.id, Date.now() - 60000)
            .first();
        if (count.n >= 6)
          fail(429, "Please wait a moment before creating another table.");
        const room = await createRoom(s.id, b);
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO rooms(code,host,status,revision,state,updated_at) VALUES (?,?,?,?,?,?)",
          ).bind(
            room.code,
            s.id,
            room.status,
            room.revision,
            JSON.stringify(room),
            room.updatedAt,
          ),
          env.DB.prepare(
            "INSERT INTO seats(id,room,session,seat) VALUES (?,?,?,?)",
          ).bind(room.code + ":" + s.id, room.code, s.id, 0),
        ]);
        return json(
          { ...projectRoom(room, s.id), hosting: "server" },
          201,
          headers,
        );
      }
      const match = url.pathname.match(
        /^\/api\/rooms\/([A-Z2-9]{8})(?:\/(join|start|action|choice|bot|tutorial|timeout|tiebreak))?$/,
      );
      if (!match) fail(404, "Route not found.");
      const row = await env.DB.prepare("SELECT * FROM rooms WHERE code = ?")
        .bind(match[1])
        .first();
      if (!row) fail(404, "Room not found. Check the code.");
      const old = unpack(row),
        route = match[2];
      if (!route && request.method === "GET")
        return json(
          { ...projectRoom(old, s.id), hosting: "server" },
          200,
          headers,
        );
      if (request.method !== "POST") fail(405, "Method not allowed.");
      const room = await changeRoom(old, s.id, route, await body(request));
      const saved = await env.DB.prepare(
        "UPDATE rooms SET state = ?, revision = ?, status = ?, updated_at = ? WHERE code = ? AND revision = ?",
      )
        .bind(
          JSON.stringify(room),
          room.revision,
          room.status,
          room.updatedAt,
          room.code,
          old.revision,
        )
        .run();
      if (!saved.meta.changes)
        fail(409, "The table changed. Refreshing your view.");
      if (route === "join")
        await env.DB.prepare(
          "INSERT OR REPLACE INTO seats(id,room,session,seat) VALUES (?,?,?,?)",
        )
          .bind(
            room.code + ":" + s.id,
            room.code,
            s.id,
            room.members.findIndex((m) => m.session === s.id),
          )
          .run();
      return json(
        { ...projectRoom(room, s.id), hosting: "server" },
        200,
        headers,
      );
    } catch (e) {
      if (e.status) return json({ error: e.message }, e.status);
      if (/D1|SQLITE|database/i.test(e.message)) {
        console.error("Game storage failure", e.message);
        return json(
          {
            error:
              "The game service is unavailable. Your last confirmed move is safe. Please reconnect.",
          },
          503,
        );
      }
      console.error("Game action failed", e.stack);
      return json(
        { error: e.message || "This action could not be completed." },
        400,
      );
    }
  },
};
