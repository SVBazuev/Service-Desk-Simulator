/**
 * middleware.js — application-side middlewares registered via the
 * Extension API. Demonstrates the submit hook: it records each
 * submit into `State.submitLog` for later inspection (telemetry,
 * debugging, backend sync in a future multiplayer commit).
 */

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
