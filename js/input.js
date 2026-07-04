// Unified input: keyboard (physical key codes), mouse, touch dual-stick, gamepad.
// Everything is folded into one command state per tick + edge-triggered presses.

const BIND = {
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  Space: "boost", ShiftLeft: "dodge", ShiftRight: "dodge",
  KeyE: "special", KeyQ: "swap", Escape: "pause",
  Digit1: "w1", Digit2: "w2", Digit3: "w3", Digit4: "w4", Digit5: "w5",
  Enter: "navOk", NumpadEnter: "navOk", Backspace: "navBack",
};
const NAV = { ArrowUp: "navUp", ArrowDown: "navDown", ArrowLeft: "navLeft", ArrowRight: "navRight", KeyW: "navUp", KeyS: "navDown", KeyA: "navLeft", KeyD: "navRight" };
const PAD_BTN = { 0: "boost", 1: "dodge", 2: "special", 3: "swap", 6: "missile", 7: "fire", 9: "pause", 12: "navUp", 13: "navDown", 14: "navLeft", 15: "navRight" };
const DEAD = 0.22;

class Input {
  constructor() {
    this.held = new Set();
    this.pressedSet = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, rdown: false, moved: false };
    this.clicks = [];
    this.touchButtons = [];
    this.touches = new Map(); // id -> {role, anchorX, anchorY, x, y, btn}
    this.touchActive = false;
    this.padActive = false;
    this.padWasPressed = {};
    this.state = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAim: false, fire: false, missile: false, boost: false, dodge: false, special: false };
    this.anyKey = false;
    this._bind();
  }

  _bind() {
    addEventListener("keydown", (e) => {
      this.anyKey = true;
      const c = BIND[e.code];
      if (c) { if (!this.held.has(c)) this.pressedSet.add(c); this.held.add(c); e.preventDefault(); }
      const n = NAV[e.code];
      if (n) this.pressedSet.add(n);
    });
    addEventListener("keyup", (e) => { const c = BIND[e.code]; if (c) this.held.delete(c); });
    addEventListener("mousemove", (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; });
    addEventListener("mousedown", (e) => {
      this.anyKey = true;
      if (e.button === 0) { this.mouse.down = true; this.clicks.push({ x: e.clientX, y: e.clientY }); }
      if (e.button === 2) this.mouse.rdown = true;
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("blur", () => { this.held.clear(); this.mouse.down = false; this.mouse.rdown = false; this.touches.clear(); });

    const opts = { passive: false };
    addEventListener("touchstart", (e) => {
      this.anyKey = true; this.touchActive = true;
      for (const t of e.changedTouches) {
        const btn = this.touchButtons.find((b) => Math.hypot(t.clientX - b.x, t.clientY - b.y) < b.r * 1.4);
        if (btn) {
          this.touches.set(t.identifier, { role: "btn", btn: btn.id, x: t.clientX, y: t.clientY });
          this.pressedSet.add(btn.id);
        } else if (t.clientX < innerWidth * 0.45) {
          this.touches.set(t.identifier, { role: "move", anchorX: t.clientX, anchorY: t.clientY, x: t.clientX, y: t.clientY });
        } else {
          this.touches.set(t.identifier, { role: "aim", anchorX: t.clientX, anchorY: t.clientY, x: t.clientX, y: t.clientY });
        }
        this.clicks.push({ x: t.clientX, y: t.clientY });
      }
      e.preventDefault();
    }, opts);
    addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        const rec = this.touches.get(t.identifier);
        if (rec) { rec.x = t.clientX; rec.y = t.clientY; }
      }
      e.preventDefault();
    }, opts);
    const end = (e) => {
      for (const t of e.changedTouches) this.touches.delete(t.identifier);
      e.preventDefault();
    };
    addEventListener("touchend", end, opts);
    addEventListener("touchcancel", end, opts);
  }

  setTouchButtons(btns) { this.touchButtons = btns; }

  pressed(name) { return this.pressedSet.has(name); }

  // Fold all devices into the command state. Called once per rendered frame.
  poll(canvasW, canvasH) {
    const s = this.state;
    s.moveX = 0; s.moveY = 0;
    s.fire = false; s.missile = false; s.hasAim = false;
    if (this.held.has("up")) s.moveY -= 1;
    if (this.held.has("down")) s.moveY += 1;
    if (this.held.has("left")) s.moveX -= 1;
    if (this.held.has("right")) s.moveX += 1;
    s.boost = this.held.has("boost");
    s.dodge = this.held.has("dodge");
    s.special = this.held.has("special");
    if (this.mouse.down) s.fire = true;
    if (this.mouse.rdown) s.missile = true;
    if (this.mouse.moved) { s.aimX = this.mouse.x; s.aimY = this.mouse.y; s.hasAim = true; }

    // touch sticks
    for (const rec of this.touches.values()) {
      if (rec.role === "move") {
        const dx = (rec.x - rec.anchorX) / 55, dy = (rec.y - rec.anchorY) / 55;
        const m = Math.hypot(dx, dy);
        if (m > 0.15) { s.moveX = clampAbs(dx, 1); s.moveY = clampAbs(dy, 1); }
      } else if (rec.role === "aim") {
        const dx = rec.x - rec.anchorX, dy = rec.y - rec.anchorY;
        if (Math.hypot(dx, dy) > 14) {
          s.aimX = canvasW / 2 + dx * 6; s.aimY = canvasH / 2 + dy * 6;
          s.hasAim = true; s.fire = true;
        }
      } else if (rec.role === "btn") {
        if (rec.btn === "boost") s.boost = true;
        if (rec.btn === "dodge") s.dodge = true;
        if (rec.btn === "special") s.special = true;
        if (rec.btn === "missile") s.missile = true;
      }
    }

    // gamepad
    for (const gp of navigator.getGamepads?.() ?? []) {
      if (!gp) continue;
      this.padActive = true;
      const ax = dz(gp.axes[0]), ay = dz(gp.axes[1]), rx = dz(gp.axes[2]), ry = dz(gp.axes[3]);
      if (ax || ay) { s.moveX = ax; s.moveY = ay; }
      if (rx || ry) {
        s.aimX = canvasW / 2 + rx * 300; s.aimY = canvasH / 2 + ry * 300;
        s.hasAim = true;
      }
      gp.buttons.forEach((b, i) => {
        const name = PAD_BTN[i];
        if (!name) return;
        const was = this.padWasPressed[i];
        if (b.pressed && !was) this.pressedSet.add(name);
        this.padWasPressed[i] = b.pressed;
        if (b.pressed) {
          if (name === "fire") s.fire = true;
          if (name === "missile") s.missile = true;
          if (name === "boost") s.boost = true;
          if (name === "dodge") s.dodge = true;
          if (name === "special") s.special = true;
        }
      });
    }
    const m = Math.hypot(s.moveX, s.moveY);
    if (m > 1) { s.moveX /= m; s.moveY /= m; }
  }

  // consume edge events after each simulation tick batch
  postFrame() {
    this.pressedSet.clear();
    this.clicks.length = 0;
    this.anyKey = false;
  }

  moveStickTouch() {
    for (const rec of this.touches.values()) if (rec.role === "move") return rec;
    return null;
  }
  aimStickTouch() {
    for (const rec of this.touches.values()) if (rec.role === "aim") return rec;
    return null;
  }
}

function dz(v) { return Math.abs(v || 0) < DEAD ? 0 : v; }
function clampAbs(v, m) { return Math.max(-m, Math.min(m, v)); }

export const input = new Input();
