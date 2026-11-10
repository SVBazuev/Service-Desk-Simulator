/**
 * extensions.js — facade for registering application extensions.
 * All app-specific templates, widgets, validators, and state slots
 * are registered through this single API.
 * In G.1 this object becomes the single `export default`.
 */
var Extension = {
  _middlewares: [],
  
  registerWorkflow: function(name, descriptor) {
    TemplateRenderer.templates[name] = descriptor;
  },
  registerPanelKind: function(kind, fn) {
    TemplateRenderer._panelKinds[kind] = fn;
  },
  registerWidget: function(name, fn) {
    TemplateRenderer._widgets[name] = fn;
  },
  registerReadonly: function(name, fn) {
    TemplateRenderer._readonly[name] = fn;
  },
  registerValidator: function(rule, fn) {
    Validator.registerRule(rule, fn);
  },
  registerSlot: function(name, initial) {
    State.registerSlot(name, initial);
  },
  registerFieldFormatter: function(fieldId, fn) {
    Validator.registerFieldFormatter(fieldId, fn);
  },

  /**
   * Register a middleware around the submit pipeline.
   * Signature: (ctx, next) => result
   *   - ctx: { level, workflow, ticket, schema, formData, state }
   *   - next: () => result  — runs the rest of the chain
   * Middleware may mutate ctx.formData before calling next(),
   * observe/wrap the result after next(), or abort by not calling next()
   * (submit then resolves to undefined and nothing is persisted).
   */
  use: function(fn) {
    if (typeof fn !== "function") {
      throw new Error("Extension.use: middleware must be a function");
    }
    this._middlewares.push(fn);
  },

  runMiddleware: function(ctx, terminal) {
    const stack = this._middlewares;
    const dispatch = (i) => {
      if (i >= stack.length) return terminal(ctx);
      return stack[i](ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  }
};
