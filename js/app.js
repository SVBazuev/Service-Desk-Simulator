/**
 * app.js — entry point. All application logic lives under
 * service-desk/app/*.js; this file only wires DOMContentLoaded → init().
 */
import { init } from "./service-desk/app/init.js";

document.addEventListener("DOMContentLoaded", () => {
  window.__initPromise__ = init();
});
