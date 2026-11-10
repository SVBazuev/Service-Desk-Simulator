/**
 * extensions.js — facade for registering application extensions.
 * All app-specific templates, widgets, validators, and state slots
 * are registered through this single API.
 * In G.1 this object becomes the single `export default`.
 */
var Extension = {
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
  }
};
