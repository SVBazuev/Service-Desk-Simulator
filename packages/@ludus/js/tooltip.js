/**
 * tooltip.js — `<ludus-tooltip>` Custom Element.
 *
 * API:
 *   <ludus-tooltip content="hint">child</ludus-tooltip>
 *
 * Behaviour: open on mouseenter/focusin, close on mouseleave/focusout/Escape.
 * Position: in-host, `position: fixed` on the tooltip child, so it is not
 * clipped or z-stacked by the host's ancestors. Collision detection:
 * prefer top, flip to bottom if not enough room, clamp horizontally to
 * the viewport.
 *
 * Known gap: if any ancestor of the host has `transform`, `filter`,
 * `perspective`, `will-change: transform`, or `contain: paint|layout|strict|content`,
 * CSS treats `position: fixed` as `absolute` relative to that ancestor —
 * the tooltip positions relative to the ancestor instead of the viewport.
 * Fix (if it ever bites): move the tooltip node to document.body and copy
 * `--tooltip-*` custom properties via getComputedStyle. Tracked as a TODO,
 * not implemented (YAGNI).
 */

const STYLE_ID = "ludus-tooltip-style";
const STYLE_TEXT = `
.ludus-tooltip {
  position: fixed;
  z-index: 2147483647;
  top: 0;
  left: 0;
  max-width: var(--tooltip-max-width, min(320px, calc(100vw - 32px)));
  background: var(--tooltip-bg, #202832);
  color: var(--tooltip-fg, #d7dee6);
  border: 1px solid var(--tooltip-border, #3a4754);
  border-radius: var(--tooltip-radius, 6px);
  padding: var(--tooltip-padding, 8px 10px);
  font-size: var(--tooltip-font-size, 12px);
  line-height: var(--tooltip-line-height, 1.45);
  font-family: var(--tooltip-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  box-shadow: var(--tooltip-shadow, 0 8px 24px rgba(0, 0, 0, .4));
  pointer-events: none;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.ludus-tooltip[hidden] {
  display: none !important;
}
`;

const GAP = 8;
const MARGIN = 8;

let uidCounter = 0;
function nextId() {
  return `ludus-tooltip-${++uidCounter}`;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  document.head.appendChild(style);
}

class LudusTooltip extends HTMLElement {
  static get observedAttributes() {
    return ["content"];
  }

  constructor() {
    super();
    this._tip = null;
    this._open = false;
    this._id = nextId();
    this._handlers = {};
  }

  connectedCallback() {
    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }

    if (!this._tip) {
      this._tip = document.createElement("div");
      this._tip.className = "ludus-tooltip";
      this._tip.id = this._id;
      this._tip.setAttribute("role", "tooltip");
      this._tip.hidden = true;
      this.appendChild(this._tip);
    }

    this._handlers.enter = () => this._show();
    this._handlers.leave = () => this._hide();
    this._handlers.focusin = () => this._show();
    this._handlers.focusout = () => this._hide();
    this._handlers.keydown = (e) => {
      if (e.key === "Escape" && this._open) this._hide();
    };
    this._handlers.reposition = () => {
      if (this._open) this._position();
    };

    this.addEventListener("mouseenter", this._handlers.enter);
    this.addEventListener("mouseleave", this._handlers.leave);
    this.addEventListener("focusin", this._handlers.focusin);
    this.addEventListener("focusout", this._handlers.focusout);
    this.addEventListener("keydown", this._handlers.keydown);
    window.addEventListener("scroll", this._handlers.reposition, true);
    window.addEventListener("resize", this._handlers.reposition);
  }

  disconnectedCallback() {
    this.removeEventListener("mouseenter", this._handlers.enter);
    this.removeEventListener("mouseleave", this._handlers.leave);
    this.removeEventListener("focusin", this._handlers.focusin);
    this.removeEventListener("focusout", this._handlers.focusout);
    this.removeEventListener("keydown", this._handlers.keydown);
    window.removeEventListener("scroll", this._handlers.reposition, true);
    window.removeEventListener("resize", this._handlers.reposition);

    if (this._tip && this._tip.parentNode === this) {
      this._tip.remove();
    }
    this._tip = null;
    this._open = false;
    this.removeAttribute("aria-describedby");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "content" && this._open) {
      this._updateContent();
      this._position();
    }
  }

  _updateContent() {
    if (!this._tip) return;
    this._tip.textContent = this.getAttribute("content") || "";
  }

  _show() {
    if (this._open) return;
    if (this.hasAttribute("disabled")) return;
    const content = this.getAttribute("content");
    if (!content) return;
    if (!this._tip) return;

    this._updateContent();
    this._tip.style.visibility = "hidden";
    this._tip.hidden = false;
    this._position();
    this._tip.style.visibility = "";
    this._open = true;
    this.setAttribute("aria-describedby", this._id);
  }

  _hide() {
    if (!this._open || !this._tip) return;
    this._tip.hidden = true;
    this._open = false;
    this.removeAttribute("aria-describedby");
  }

  _position() {
    if (!this._tip) return;
    const hostRect = this.getBoundingClientRect();
    const tipRect = this._tip.getBoundingClientRect();
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    let top;
    if (hostRect.top >= tipRect.height + GAP) {
      top = hostRect.top - tipRect.height - GAP;
    } else {
      top = hostRect.bottom + GAP;
    }

    let left = hostRect.left + hostRect.width / 2 - tipRect.width / 2;
    left = Math.max(MARGIN, Math.min(left, viewportW - tipRect.width - MARGIN));

    this._tip.style.top = `${top}px`;
    this._tip.style.left = `${left}px`;
  }
}

export function registerTooltip() {
  if (customElements.get("ludus-tooltip")) return;
  injectStyle();
  customElements.define("ludus-tooltip", LudusTooltip);
}
