/**
 * middleware.js — application-side middlewares registered via the
 * Extension API.
 */
import { Extension } from "../core/extensions.js";
import { State } from "../core/state.js";

Extension.registerSlot("submitLog", []);

Extension.use(function auditSubmit(ctx, next) {
  const result = next();
  State.submitLog.push({
    ticketId: ctx.ticket.id,
    level: ctx.level,
    workflow: ctx.workflow,
    ok: !!(result && result.ok),
    at: Date.now()
  });
  return result;
});
