let opening;
export function database() {
  return (opening ||= new Promise((resolve, reject) => {
    const req = indexedDB.open("echoside-pages-v1", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("rooms", { keyPath: "code" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new Error("Allow browser storage to save and play your games."));
  }));
}
export async function readRoom(code) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("rooms").objectStore("rooms").get(code);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function writeRoom(room) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("rooms", "readwrite");
    tx.objectStore("rooms").put(room);
    tx.oncomplete = resolve;
    tx.onerror = () =>
      reject(
        new Error(
          "The browser could not save this move. Free some storage and try again.",
        ),
      );
  });
}
export function identity() {
  try {
    const key = "echoside-pages-player";
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      localStorage.setItem(key, value);
    }
    return value;
  } catch {
    throw Error("Allow browser storage to save and play your games.");
  }
}
export function recentRooms() {
  try {
    return JSON.parse(localStorage.getItem("echoside-pages-recent") || "[]");
  } catch {
    return [];
  }
}
export function remember(view) {
  const rows = recentRooms().filter((r) => r.code !== view.code);
  rows.unshift({
    code: view.code,
    status: view.status,
    updated_at: Date.now(),
  });
  try {
    localStorage.setItem(
      "echoside-pages-recent",
      JSON.stringify(rows.slice(0, 10)),
    );
  } catch {}
}

export function roomIdentity(code) {
  const key = "echoside-seat-" + code;
  let value = localStorage.getItem(key);
  if (!value) {
    value = recentRooms().some((r) => r.code === code)
      ? identity()
      : crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}
export function saveRoomIdentity(code, token) {
  localStorage.setItem("echoside-seat-" + code, token);
}
