import {
  pagesApi,
  recoveryKey,
  recoverSeat,
  exportTable,
  importTable,
} from "./client.js";
window.echosidePages = {
  api: pagesApi,
  recoveryKey,
  recoverSeat,
  exportTable,
  importTable,
};
await import("../public/app.js");
