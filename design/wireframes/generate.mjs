/*
 * Wireframe generator — Ask Advisor.
 * Emits low-fidelity SVG wireframes for every screen (desktop + mobile).
 * Wireframes are intentionally grayscale + structural: they communicate
 * information architecture and layout, not final visuals (the final visuals
 * are the implemented app, captured in design/research/*.png).
 * One brand accent (sky) marks the single primary action per screen — a direct
 * reflection of the salience principle in design/RATIONALE.md §18.
 *
 * Run:  node design/wireframes/generate.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = dirname(fileURLToPath(import.meta.url));

/* ── palette (wireframe grays + one brand accent) ───────────────────────── */
const C = {
  page: "#f4f6f9",
  frame: "#ffffff",
  line: "#d4dae3",
  lineSoft: "#e7ebf1",
  fill: "#eef1f6",
  fillStrong: "#dfe5ee",
  ink: "#3c4a63",
  inkSoft: "#8590a8",
  navy: "#001532",
  accent: "#15679f",
  accentSoft: "#d7ecfa",
  note: "#15679f"
};

/* ── primitives ─────────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function rect(x, y, w, h, { r = 8, fill = C.fill, stroke = C.line, sw = 1, dash } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}
function line(x1, y1, x2, y2, { stroke = C.line, sw = 1, dash } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}
function text(x, y, str, { size = 13, fill = C.ink, weight = 400, anchor = "start", spacing = 0, family = "DM Sans, Arial, sans-serif" } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(str)}</text>`;
}
// horizontal "text line" placeholders
function lines(x, y, w, count, { gap = 12, h = 7, last = 0.6 } = {}) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const lw = i === count - 1 ? w * last : w;
    out += rect(x, y + i * gap, lw, h, { r: 3, fill: C.fillStrong, stroke: "none" });
  }
  return out;
}
function pill(x, y, w, str, { fill = C.fill, stroke = C.line, tcol = C.ink, h = 26 } = {}) {
  return rect(x, y, w, h, { r: h / 2, fill, stroke }) + text(x + w / 2, y + h / 2 + 4, str, { size: 11, fill: tcol, anchor: "middle", weight: 600 });
}
function primary(x, y, w, str) {
  const h = 40;
  return rect(x, y, w, h, { r: h / 2, fill: C.accent, stroke: "none" }) + text(x + w / 2, y + h / 2 + 4, str, { size: 13, fill: "#fff", anchor: "middle", weight: 600 });
}
function chip(x, y, str, { fill = C.fill, tcol = C.ink } = {}) {
  const w = 16 + str.length * 6.2;
  return pill(x, y, w, str, { fill, tcol, h: 22 }) + `<!--w:${w}-->`;
}
// annotation callout — ties an element to a behavioral principle
function note(x, y, w, str) {
  const pad = 10;
  const lineH = 15;
  const wrapped = wrap(str, Math.floor((w - pad * 2) / 6.0));
  const h = pad * 2 + wrapped.length * lineH;
  let out = rect(x, y, w, h, { r: 8, fill: "#eef6fc", stroke: C.accentSoft, sw: 1 });
  out += rect(x, y, 3, h, { r: 0, fill: C.accent, stroke: "none" });
  wrapped.forEach((ln, i) => {
    out += text(x + pad, y + pad + 11 + i * lineH, ln, { size: 11, fill: C.note, weight: i === 0 ? 700 : 400 });
  });
  return out;
}
function wrap(str, max) {
  const words = str.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* ── shells ─────────────────────────────────────────────────────────────── */
function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<rect width="${w}" height="${h}" fill="${C.page}"/>
${body}
</svg>`;
}
function browserFrame(w, h, title) {
  const top = 36;
  let out = rect(8, 8, w - 16, h - 16, { r: 14, fill: C.frame, stroke: C.line });
  out += `<path d="M8 22 a14 14 0 0 1 14 -14 h${w - 44} a14 14 0 0 1 14 14 v${top - 14} h-${w - 16} z" fill="${C.fill}" stroke="${C.line}"/>`;
  out += `<circle cx="26" cy="26" r="4" fill="${C.line}"/><circle cx="40" cy="26" r="4" fill="${C.line}"/><circle cx="54" cy="26" r="4" fill="${C.line}"/>`;
  out += rect(74, 16, w - 130, 20, { r: 10, fill: C.frame, stroke: C.line });
  out += text(86, 30, title, { size: 11, fill: C.inkSoft });
  return { out, top: top + 8, padX: 24 };
}
function phoneFrame(w, h) {
  let out = rect(6, 6, w - 12, h - 12, { r: 30, fill: C.frame, stroke: C.line, sw: 1.5 });
  out += rect((w - 110) / 2, 16, 110, 22, { r: 11, fill: C.navy, stroke: "none" });
  return { out, top: 52, padX: 18 };
}
// top nav (desktop, navy) and bottom tabs (mobile)
function topNav(x, w, y, items, active) {
  let out = rect(x, y, w, 46, { r: 10, fill: C.navy, stroke: "none" });
  out += rect(x + 14, y + 12, 22, 22, { r: 6, fill: C.accent, stroke: "none" });
  out += text(x + 44, y + 28, "Ask Advisor", { size: 12, fill: "#fff", weight: 700 });
  let cx = x + 170;
  for (const it of items) {
    const w2 = 20 + it.length * 6.4;
    if (it === active) out += rect(cx - 8, y + 11, w2 + 12, 24, { r: 12, fill: "rgba(52,152,219,0.22)", stroke: "none" });
    out += text(cx, y + 28, it, { size: 12, fill: it === active ? "#fff" : "#9fb0c4", weight: 500 });
    cx += w2 + 16;
  }
  out += rect(x + w - 44, y + 11, 26, 24, { r: 12, fill: "rgba(255,255,255,0.08)", stroke: "none" });
  return out;
}
function bottomTabs(x, w, y, items, active) {
  let out = rect(x, y, w, 56, { r: 0, fill: "#ffffff", stroke: C.line });
  const seg = w / items.length;
  items.forEach((it, i) => {
    const cxx = x + seg * i + seg / 2;
    if (it === active) out += rect(cxx - 12, y + 8, 24, 3, { r: 2, fill: C.accent, stroke: "none" });
    out += rect(cxx - 9, y + 16, 18, 14, { r: 4, fill: it === active ? C.accent : C.fillStrong, stroke: "none" });
    out += text(cxx, y + 46, it, { size: 9, fill: it === active ? C.accent : C.inkSoft, anchor: "middle", weight: 600 });
  });
  return out;
}
function eyebrow(x, y, str) {
  return text(x, y, str.toUpperCase(), { size: 10, fill: C.accent, weight: 700, spacing: 1.5 });
}
function heading(x, y, str, size = 26) {
  return text(x, y, str, { size, fill: C.navy, weight: 700, family: "Montserrat, Arial, sans-serif" });
}

/* ── screen definitions ─────────────────────────────────────────────────── */
const CLIENT_NAV = ["Ask", "Learn", "Plan", "Account"];
const ADMIN_NAV = ["Review", "Sources", "Wiki", "Questions", "Health", "Settings"];

const screens = {};

/* 1. Login — desktop split */
screens["01-login-desktop"] = () => {
  const W = 1280, H = 760;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com");
  let b = f.out;
  const top = f.top;
  // left navy hero
  const half = (W - 16) / 2;
  b += rect(8, top, half - 4, H - top - 8, { r: 0, fill: C.navy, stroke: "none" });
  b += rect(40, top + 40, 200, 26, { r: 13, fill: "rgba(255,255,255,0.1)", stroke: "rgba(255,255,255,0.2)" });
  b += text(54, top + 57, "Beyond Freedom Financial", { size: 11, fill: "#cfe2f3", weight: 600 });
  b += heading(40, top + 150, "Tax help with", 36);
  b += heading(40, top + 196, "the receipts.", 36);
  b += rect(40, top + 230, 360, 7, { r: 3, fill: "rgba(255,255,255,0.18)", stroke: "none" });
  b += rect(40, top + 246, 300, 7, { r: 3, fill: "rgba(255,255,255,0.12)", stroke: "none" });
  b += rect(40, top + 300, 56, 4, { r: 2, fill: C.accent, stroke: "none" });
  b += rect(104, top + 300, 32, 4, { r: 2, fill: "rgba(52,152,219,0.6)", stroke: "none" });
  // right card
  const cx = 8 + half + 60;
  const cw = half - 120;
  b += rect(cx, top + 90, cw, 340, { r: 18, fill: C.frame, stroke: C.line });
  b += heading(cx + 32, top + 140, "Secure portal login", 18);
  b += text(cx + 32, top + 164, "Start with your client email.", { size: 12, fill: C.inkSoft });
  b += text(cx + 32, top + 200, "Email", { size: 11, fill: C.ink, weight: 600 });
  b += rect(cx + 32, top + 210, cw - 64, 40, { r: 10, fill: C.frame, stroke: C.lineSoft });
  b += rect(cx + 32, top + 264, 18, 18, { r: 4, fill: C.accentSoft, stroke: C.accent });
  b += text(cx + 58, top + 277, "Keep me signed in for 30 days", { size: 11, fill: C.ink });
  b += primary(cx + 32, top + 300, cw - 64, "Send secure code");
  b += note(cx, top + 450, cw, "Progressive disclosure (§Login): the 6-digit code field only appears after the email is accepted, so the first screen asks for one thing, not two.");
  return svg(W, H, b);
};

/* 1b. Login mobile */
screens["01-login-mobile"] = () => {
  const W = 390, H = 760;
  const f = phoneFrame(W, H);
  let b = f.out; const top = f.top; const px = f.padX;
  b += rect(px, top, W - px * 2, 150, { r: 14, fill: C.navy, stroke: "none" });
  b += pill(px + 16, top + 18, 150, "Beyond Freedom", { fill: "rgba(255,255,255,0.1)", stroke: "rgba(255,255,255,0.2)", tcol: "#cfe2f3" });
  b += heading(px + 16, top + 78, "Tax help with", 22);
  b += heading(px + 16, top + 104, "the receipts.", 22);
  const cy = top + 172;
  b += rect(px, cy, W - px * 2, 300, { r: 16, fill: C.frame, stroke: C.line });
  b += heading(px + 20, cy + 36, "Secure login", 16);
  b += text(px + 20, cy + 70, "Email", { size: 11, fill: C.ink, weight: 600 });
  b += rect(px + 20, cy + 80, W - px * 2 - 40, 40, { r: 10, fill: C.frame, stroke: C.lineSoft });
  b += primary(px + 20, cy + 140, W - px * 2 - 40, "Send secure code");
  b += text(px + 20, cy + 215, "Encrypted portal session.", { size: 10, fill: C.inkSoft });
  return svg(W, H, b);
};

/* 2. Loading */
screens["02-loading"] = () => {
  const W = 1280, H = 600;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com");
  let b = f.out;
  b += rect(8, f.top, W - 16, H - f.top - 8, { r: 0, fill: C.navy, stroke: "none" });
  b += `<circle cx="${W / 2}" cy="${H / 2 - 20}" r="34" fill="rgba(52,152,219,0.18)" stroke="${C.accent}"/>`;
  b += `<circle cx="${W / 2}" cy="${H / 2 - 20}" r="50" fill="none" stroke="rgba(52,152,219,0.4)" stroke-dasharray="4 6"/>`;
  b += text(W / 2, H / 2 + 44, "Opening Ask Advisor", { size: 13, fill: "#cfe2f3", anchor: "middle", weight: 500 });
  b += note(W / 2 - 220, H / 2 + 80, 440, "Doherty threshold: a branded, animated hold under ~400ms reads as 'working', preventing the 'is it broken?' bounce on first paint.");
  return svg(W, H, b);
};

/* helper: client page header */
function pageHeader(x, y, eb, h1) {
  return eyebrow(x, y, eb) + heading(x, y + 30, h1, 28);
}

/* 3. Ask — empty (desktop) */
screens["03-ask-empty-desktop"] = () => {
  const W = 1280, H = 940;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/ask");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Ask");
  let y = top + 78;
  b += pageHeader(px, y, "Ask Advisor", "Start with the question you'd bring to the call.");
  y += 70;
  // chips
  let cxp = px;
  for (const t of ["Demo Client", "S Corp", "Hire Kids / Augusta"]) { b += chip(cxp, y, t); cxp += 24 + t.length * 6.4; }
  y += 44;
  const mainW = W - px * 2 - 16 - 320 - 24;
  // panel
  b += rect(px, y, mainW, 470, { r: 18, fill: C.frame, stroke: C.line });
  b += rect(px + 20, y + 20, mainW - 40, 110, { r: 12, fill: C.navy, stroke: "none" });
  b += text(px + 36, y + 46, "WELCOME BACK", { size: 9, fill: C.accent, weight: 700, spacing: 1.2 });
  b += heading(px + 36, y + 74, "Demo Client", 18);
  b += rect(px + 36, y + 92, mainW - 72 - 200, 22, { r: 6, fill: "rgba(255,255,255,0.08)", stroke: "none" });
  // prompt cards
  for (let i = 0; i < 3; i++) b += rect(px + 20, y + 150 + i * 40, mainW - 40, 32, { r: 8, fill: C.fill, stroke: C.lineSoft });
  // builder tabs
  let tx = px + 20;
  for (const t of ["My Business", "My Family", "Tax Deadlines", "Savings"]) { b += chip(tx, y + 290, t, t === "Tax Deadlines" ? { fill: C.navy, tcol: "#fff" } : {}); tx += 18 + t.length * 6.8; }
  // textarea
  b += rect(px + 20, y + 330, mainW - 40, 70, { r: 10, fill: C.frame, stroke: C.lineSoft });
  b += text(px + 32, y + 356, "Or type your own question", { size: 11, fill: C.inkSoft });
  b += pill(px + 20, y + 415, 110, "Voice note", {});
  b += primary(px + mainW - 190, y + 408, 170, "Ask Advisor");
  // sidebar
  const sx = px + mainW + 24;
  b += rect(sx, y, 320, 120, { r: 14, fill: C.frame, stroke: C.line });
  b += eyebrow(sx + 18, y + 28, "Next tax moment");
  b += heading(sx + 18, y + 56, "June 15", 18);
  b += primary(sx + 18, y + 72, 120, "Ask about this");
  b += rect(sx, y + 136, 320, 110, { r: 14, fill: C.frame, stroke: C.line });
  b += `<circle cx="${sx + 50}" cy="${y + 190}" r="30" fill="none" stroke="${C.fillStrong}" stroke-width="7"/>`;
  b += `<path d="M ${sx + 50} ${y + 160} A 30 30 0 1 1 ${sx + 24} ${y + 205}" fill="none" stroke="${C.accent}" stroke-width="7"/>`;
  b += text(sx + 50, y + 195, "91", { size: 16, anchor: "middle", weight: 700, fill: C.navy, family: "Montserrat, Arial" });
  b += text(sx + 96, y + 185, "Tax readiness", { size: 12, weight: 600, fill: C.ink });
  b += rect(sx, y + 262, 320, 90, { r: 14, fill: C.frame, stroke: C.line });
  b += eyebrow(sx + 18, y + 288, "Conversation memory");
  // empty answer
  b += rect(px, y + 490, mainW, 110, { r: 18, fill: C.frame, stroke: C.line, dash: "5 5" });
  b += text(px + 24, y + 540, "Source-backed answers appear here.", { size: 15, fill: C.accent, weight: 600 });
  b += note(sx, y + 366, 320, "Loss aversion + temporal landmarks (§5): a days-until-deadline counter framed as time-to-act beats a neutral date.");
  b += note(px, y + 612, mainW, "Choice architecture (§3): suggested prompts carry the phrasing load for non-experts, turning a blank box into one tap.");
  return svg(W, H, b);
};

/* 3b Ask empty mobile */
screens["03-ask-empty-mobile"] = () => {
  const W = 390, H = 880;
  const f = phoneFrame(W, H);
  let b = f.out; const top = f.top; const px = f.padX;
  b += pageHeader(px, top + 10, "Ask", "Start with your question.");
  let y = top + 64;
  b += rect(px, y, W - px * 2, 120, { r: 14, fill: C.navy, stroke: "none" });
  b += text(px + 16, y + 30, "WELCOME BACK", { size: 9, fill: C.accent, weight: 700 });
  b += heading(px + 16, y + 56, "Demo Client", 16);
  y += 136;
  b += rect(px, y, W - px * 2, 70, { r: 12, fill: C.frame, stroke: C.line });
  b += eyebrow(px + 14, y + 24, "Next tax moment");
  b += heading(px + 14, y + 48, "June 15", 15);
  y += 86;
  b += rect(px, y, W - px * 2, 80, { r: 12, fill: C.frame, stroke: C.lineSoft });
  b += text(px + 14, y + 24, "Type your question", { size: 11, fill: C.inkSoft });
  y += 92;
  b += primary(px, y, W - px * 2, "Ask Advisor");
  b += bottomTabs(px, W - px * 2, H - 70, CLIENT_NAV, "Ask");
  b += note(px, y + 56, W - px * 2, "Fitts's law: full-width primary action sits in the thumb zone for one-handed phone use.");
  return svg(W, H, b);
};

/* 4. Ask answered (desktop) */
screens["04-ask-answered-desktop"] = () => {
  const W = 1280, H = 980;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/ask");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Ask");
  let y = top + 70;
  const mainW = W - px * 2 - 16 - 320 - 24;
  // answer card
  b += rect(px, y, mainW, 600, { r: 18, fill: C.frame, stroke: C.accentSoft });
  b += pill(px + 20, y + 20, 180, "Answer from approved sources", { fill: "#e0f4ee", stroke: "none", tcol: "#0a6b50" });
  b += rect(px + 20, y + 60, mainW - 40, 44, { r: 10, fill: C.fillStrong, stroke: "none" });
  b += text(px + 34, y + 87, "What should I do before estimated taxes are due?", { size: 12, fill: C.navy, weight: 500 });
  b += rect(px + 20, y + 118, mainW - 40, 36, { r: 8, fill: "#fbf1dc", stroke: "rgba(138,82,0,0.3)" });
  b += text(px + 34, y + 141, "Want Shona to review this personally? Usually within 4 hours.", { size: 11, fill: "#8a5200", weight: 500 });
  b += lines(px + 20, y + 176, mainW - 40, 4, { gap: 16, h: 8 });
  b += rect(px + 20, y + 250, mainW - 40, 36, { r: 8, fill: "#e8f2fb", stroke: "none" });
  b += text(px + 34, y + 273, "Built from the Beyond Freedom strategy library.", { size: 11, fill: C.navy });
  b += text(px + 20, y + 322, "Sources", { size: 13, weight: 700, fill: C.navy, family: "Montserrat, Arial" });
  for (let i = 0; i < 2; i++) {
    const bx = px + 20 + i * ((mainW - 40) / 2 + 8);
    b += rect(bx, y + 334, (mainW - 56) / 2, 70, { r: 8, fill: C.fill, stroke: C.lineSoft });
    b += rect(bx, y + 334, 3, 70, { r: 0, fill: C.accent, stroke: "none" });
  }
  b += text(px + 20, y + 440, "Next steps", { size: 13, weight: 700, fill: C.navy, family: "Montserrat, Arial" });
  b += lines(px + 44, y + 460, mainW - 80, 3, { gap: 20, h: 8, last: 0.7 });
  let fx = px + 20;
  for (const t of ["Follow-up A", "Follow-up B", "Follow-up C"]) { b += chip(fx, y + 530, t, { fill: C.frame, tcol: C.accent }); fx += 18 + t.length * 7; }
  b += line(px + 20, y + 568, px + mainW - 20, y + 568, { stroke: C.lineSoft });
  for (const t of ["Helpful", "Needs work", "Print"]) b += text(px + 24 + (t === "Helpful" ? 0 : t === "Needs work" ? 90 : 200), y + 588, t, { size: 12, fill: C.ink });
  // sidebar (sticky)
  const sx = px + mainW + 24;
  b += rect(sx, y, 320, 120, { r: 14, fill: C.frame, stroke: C.line });
  b += eyebrow(sx + 18, y + 28, "Next tax moment");
  b += heading(sx + 18, y + 54, "June 15", 18);
  b += rect(sx, y + 136, 320, 110, { r: 14, fill: C.frame, stroke: C.line });
  b += text(sx + 18, y + 170, "Tax readiness 91", { size: 12, weight: 600, fill: C.ink });
  b += note(px, y + 620, mainW, "Peak-end rule + trust signaling (§6/§7): provenance shown before the prose, and a human-review offer that confirms rather than vanishes, so the visit ends on reassurance.");
  return svg(W, H, b);
};

/* 4b Ask answered mobile */
screens["04-ask-answered-mobile"] = () => {
  const W = 390, H = 820;
  const f = phoneFrame(W, H);
  let b = f.out; const top = f.top; const px = f.padX;
  let y = top + 8;
  b += rect(px, y, W - px * 2, 640, { r: 16, fill: C.frame, stroke: C.accentSoft });
  b += pill(px + 14, y + 16, 170, "Answer from approved sources", { fill: "#e0f4ee", stroke: "none", tcol: "#0a6b50" });
  b += rect(px + 14, y + 52, W - px * 2 - 28, 40, { r: 8, fill: C.fillStrong, stroke: "none" });
  b += rect(px + 14, y + 104, W - px * 2 - 28, 34, { r: 8, fill: "#fbf1dc", stroke: "rgba(138,82,0,0.3)" });
  b += text(px + 24, y + 126, "Want Shona to review this?", { size: 10, fill: "#8a5200", weight: 500 });
  b += lines(px + 14, y + 158, W - px * 2 - 28, 4, { gap: 16, h: 7 });
  b += text(px + 14, y + 250, "Sources", { size: 12, weight: 700, fill: C.navy, family: "Montserrat, Arial" });
  b += rect(px + 14, y + 262, W - px * 2 - 28, 60, { r: 8, fill: C.fill, stroke: C.lineSoft });
  b += rect(px + 14, y + 262, 3, 60, { r: 0, fill: C.accent, stroke: "none" });
  b += text(px + 14, y + 360, "Next steps", { size: 12, weight: 700, fill: C.navy, family: "Montserrat, Arial" });
  b += lines(px + 34, y + 378, W - px * 2 - 50, 3, { gap: 18, h: 7 });
  b += bottomTabs(px, W - px * 2, H - 70, CLIENT_NAV, "Ask");
  return svg(W, H, b);
};

/* 5. Ask busy (skeleton) */
screens["05-ask-busy-desktop"] = () => {
  const W = 1280, H = 520;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/ask");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Ask");
  const y = top + 80;
  b += rect(px, y, W - px * 2 - 16, 340, { r: 18, fill: C.frame, stroke: C.line });
  b += rect(px + 24, y + 30, (W - px * 2 - 64) * 0.8, 14, { r: 7, fill: C.fillStrong, stroke: "none" });
  b += rect(px + 24, y + 64, W - px * 2 - 64, 14, { r: 7, fill: C.fill, stroke: "none" });
  b += rect(px + 24, y + 98, (W - px * 2 - 64) * 0.45, 14, { r: 7, fill: C.fill, stroke: "none" });
  b += text(px + 24, y + 200, "Searching approved sources…", { size: 13, fill: C.inkSoft });
  b += note(px, y + 250, 560, "Skeleton + progress label (§17 motion): a shimmer placeholder sets the expectation that an answer is forming, reducing perceived wait.");
  return svg(W, H, b);
};

/* 6. Learn vault (desktop) */
screens["06-learn-desktop"] = () => {
  const W = 1280, H = 760;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/learn");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Learn");
  let y = top + 78;
  b += pageHeader(px, y, "Learn", "Beyond Freedom strategy library.");
  y += 64;
  b += rect(px, y, W - px * 2 - 16 - 180, 44, { r: 22, fill: C.frame, stroke: C.lineSoft });
  b += `<circle cx="${px + 24}" cy="${y + 22}" r="7" fill="none" stroke="${C.inkSoft}"/>`;
  b += text(px + 42, y + 27, "Search strategy, training, or question", { size: 12, fill: C.inkSoft });
  b += text(px + W - px * 2 - 16 - 150, y + 27, "3 published pages", { size: 12, fill: C.inkSoft, anchor: "start" });
  y += 60;
  let tx = px;
  for (const t of ["All", "Tax Readiness", "Home & Office", "People"]) { b += chip(tx, y, t, t === "All" ? { fill: C.navy, tcol: "#fff" } : {}); tx += 18 + t.length * 7.2; }
  y += 44;
  const cardW = (W - px * 2 - 16 - 32) / 3;
  for (let i = 0; i < 3; i++) {
    const bx = px + i * (cardW + 16);
    b += rect(bx, y, cardW, 220, { r: 14, fill: C.frame, stroke: C.line });
    b += eyebrow(bx + 18, y + 30, ["Tax readiness", "Home & office", "People"][i]);
    b += pill(bx + cardW - 56, y + 16, 40, "New", { fill: "#e0f4ee", stroke: "none", tcol: "#0a6b50" });
    b += heading(bx + 18, y + 64, "Lesson title", 16);
    b += lines(bx + 18, y + 84, cardW - 36, 4, { gap: 13, h: 6, last: 0.5 });
    b += rect(bx + 18, y + 190, cardW - 36, 6, { r: 3, fill: C.fillStrong, stroke: "none" });
    b += rect(bx + 18, y + 190, (cardW - 36) * (i + 1) * 0.2, 6, { r: 3, fill: C.accent, stroke: "none" });
  }
  b += note(px, y + 244, cardW, "Endowed progress (§10): each card's reading bar starts seeded, moving users out of '0% / not started'.");
  b += note(px + cardW + 16, y + 244, cardW, "Hick's law: a short category filter row narrows choice without burying lessons in a deep menu.");
  return svg(W, H, b);
};

/* 6b Learn mobile */
screens["06-learn-mobile"] = () => {
  const W = 390, H = 800;
  const f = phoneFrame(W, H);
  let b = f.out; const top = f.top; const px = f.padX;
  b += pageHeader(px, top + 10, "Learn", "Strategy library.");
  let y = top + 60;
  b += rect(px, y, W - px * 2, 42, { r: 21, fill: C.frame, stroke: C.lineSoft });
  b += text(px + 36, y + 26, "Search lessons", { size: 11, fill: C.inkSoft });
  y += 56;
  let tx = px;
  for (const t of ["All", "Readiness", "People"]) { b += chip(tx, y, t, t === "All" ? { fill: C.navy, tcol: "#fff" } : {}); tx += 16 + t.length * 7; }
  y += 42;
  for (let i = 0; i < 2; i++) {
    b += rect(px, y, W - px * 2, 150, { r: 14, fill: C.frame, stroke: C.line });
    b += eyebrow(px + 16, y + 26, "Tax readiness");
    b += heading(px + 16, y + 54, "Lesson title", 15);
    b += lines(px + 16, y + 72, W - px * 2 - 32, 3, { gap: 13, h: 6 });
    b += rect(px + 16, y + 128, W - px * 2 - 32, 6, { r: 3, fill: C.fillStrong, stroke: "none" });
    y += 166;
  }
  b += bottomTabs(px, W - px * 2, H - 70, CLIENT_NAV, "Learn");
  return svg(W, H, b);
};

/* 7. Reader (desktop) */
screens["07-reader-desktop"] = () => {
  const W = 1280, H = 820;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/learn/estimated-tax");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Learn");
  const cw = 720;
  const cx = (W - cw) / 2;
  let y = top + 70;
  // sticky bar
  b += rect(cx, y, cw, 44, { r: 22, fill: C.frame, stroke: C.line });
  b += text(cx + 24, y + 28, "‹ Learn", { size: 12, fill: C.ink, weight: 600 });
  b += primary(cx + cw - 150, y + 2, 140, "Mark complete");
  y += 70;
  b += eyebrow(cx, y, "Tax readiness");
  b += heading(cx, y + 32, "Estimated Tax Reminder Email", 26);
  b += lines(cx, y + 56, cw, 2, { gap: 16, h: 9 });
  y += 110;
  // downloads panel
  b += rect(cx, y, cw, 90, { r: 14, fill: C.fill, stroke: C.line });
  b += eyebrow(cx + 20, y + 26, "Downloads");
  b += rect(cx + 20, y + 38, (cw - 56) / 2, 40, { r: 8, fill: C.frame, stroke: C.lineSoft });
  b += rect(cx + 28 + (cw - 56) / 2, y + 38, (cw - 56) / 2, 40, { r: 8, fill: C.frame, stroke: C.lineSoft });
  y += 112;
  b += lines(cx, y, cw, 7, { gap: 20, h: 9, last: 0.85 });
  b += note(cx, y + 170, cw, "Reading hygiene + progressive disclosure (§13): single ~700px column at a 60–75char measure; downloads (the action) sit above the prose, related links below.");
  return svg(W, H, b);
};

/* 7b Reader mobile */
screens["07-reader-mobile"] = () => {
  const W = 390, H = 800;
  const f = phoneFrame(W, H);
  let b = f.out; const top = f.top; const px = f.padX;
  let y = top + 6;
  b += rect(px, y, W - px * 2, 40, { r: 20, fill: C.frame, stroke: C.line });
  b += text(px + 16, y + 25, "‹ Learn", { size: 11, fill: C.ink, weight: 600 });
  b += primary(px + W - px * 2 - 116, y + 1, 110, "Mark complete");
  y += 58;
  b += eyebrow(px, y, "Tax readiness");
  b += heading(px, y + 28, "Estimated Tax", 20);
  b += lines(px, y + 48, W - px * 2, 2, { gap: 15, h: 8 });
  y += 96;
  b += rect(px, y, W - px * 2, 80, { r: 12, fill: C.fill, stroke: C.line });
  b += eyebrow(px + 14, y + 24, "Downloads");
  b += rect(px + 14, y + 34, W - px * 2 - 28, 34, { r: 8, fill: C.frame, stroke: C.lineSoft });
  y += 100;
  b += lines(px, y, W - px * 2, 8, { gap: 18, h: 8 });
  return svg(W, H, b);
};

/* 8. Plan (desktop) */
screens["08-plan-desktop"] = () => {
  const W = 1280, H = 680;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/my-plan");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Plan");
  let y = top + 78;
  b += pageHeader(px, y, "My Plan", "A focused checklist from your profile.");
  y += 70;
  // progress banner
  b += rect(px, y, W - px * 2 - 16, 70, { r: 14, fill: C.navy, stroke: "none" });
  b += text(px + 24, y + 30, "PROGRESS", { size: 9, fill: C.accent, weight: 700, spacing: 1.2 });
  b += heading(px + 24, y + 54, "1 of 1 complete", 16);
  b += text(px + W - px * 2 - 56, y + 48, "100%", { size: 26, fill: C.accent, weight: 700, anchor: "end", family: "Montserrat, Arial" });
  y += 90;
  for (let i = 0; i < 2; i++) {
    b += rect(px, y, W - px * 2 - 16, 96, { r: 14, fill: i === 0 ? C.fill : C.frame, stroke: C.line });
    b += `<circle cx="${px + 36}" cy="${y + 30}" r="14" fill="${i === 0 ? "#e0f4ee" : "none"}" stroke="${i === 0 ? "#0a6b50" : C.fillStrong}" stroke-width="2"/>`;
    b += heading(px + 66, y + 30, "Estimated Tax Payment System", 15);
    b += lines(px + 66, y + 44, 520, 2, { gap: 14, h: 6 });
    b += text(px + 66, y + 82, "When you're ready, gather profit + withholding.", { size: 11, fill: C.inkSoft });
    y += 112;
  }
  b += note(px, y + 6, 620, "Implementation intention + goal-gradient (§9): each item names a trigger ('when you're ready, gather X'); the meter climbs with every check.");
  return svg(W, H, b);
};

/* 8b Plan mobile */
screens["08-plan-mobile"] = () => {
  const W = 390, H = 760;
  const f = phoneFrame(W, H);
  let b = f.out; const top = f.top; const px = f.padX;
  b += pageHeader(px, top + 10, "Plan", "Your checklist.");
  let y = top + 64;
  b += rect(px, y, W - px * 2, 64, { r: 12, fill: C.navy, stroke: "none" });
  b += text(px + 14, y + 26, "PROGRESS", { size: 9, fill: C.accent, weight: 700 });
  b += heading(px + 14, y + 48, "1 of 1", 15);
  y += 80;
  for (let i = 0; i < 3; i++) {
    b += rect(px, y, W - px * 2, 84, { r: 12, fill: i === 0 ? C.fill : C.frame, stroke: C.line });
    b += `<circle cx="${px + 24}" cy="${y + 26}" r="12" fill="${i === 0 ? "#e0f4ee" : "none"}" stroke="${i === 0 ? "#0a6b50" : C.fillStrong}" stroke-width="2"/>`;
    b += heading(px + 48, y + 28, "Plan item", 14);
    b += lines(px + 48, y + 42, W - px * 2 - 70, 2, { gap: 13, h: 6 });
    y += 96;
  }
  b += bottomTabs(px, W - px * 2, H - 70, CLIENT_NAV, "Plan");
  return svg(W, H, b);
};

/* 9. History */
screens["09-history-desktop"] = () => {
  const W = 1280, H = 600;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/history");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Account");
  let y = top + 78;
  b += pageHeader(px, y, "History", "Recent questions on this device.");
  y += 70;
  for (let i = 0; i < 3; i++) {
    b += rect(px, y, W - px * 2 - 16, 78, { r: 12, fill: C.frame, stroke: C.line });
    b += `<circle cx="${px + 32}" cy="${y + 32}" r="12" fill="none" stroke="${C.accent}"/>`;
    b += heading(px + 60, y + 32, "What should I do before estimated taxes?", 15);
    b += text(px + 60, y + 56, "Answer from approved sources · 2 days ago", { size: 11, fill: C.inkSoft });
    y += 90;
  }
  b += note(px, y + 6, 560, "Recognition over recall (§11): on-device history lets clients resume a thread without remembering how they phrased it.");
  return svg(W, H, b);
};

/* 10. Account / More (desktop) */
screens["10-account-desktop"] = () => {
  const W = 1280, H = 640;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/more");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, CLIENT_NAV, "Account");
  let y = top + 78;
  b += pageHeader(px, y, "Account", "Your portal, settings, and history.");
  y += 70;
  b += rect(px, y, W - px * 2 - 16, 90, { r: 14, fill: C.navy, stroke: "none" });
  b += text(px + 24, y + 30, "ADVISOR TEAM", { size: 9, fill: C.accent, weight: 700, spacing: 1.2 });
  b += heading(px + 24, y + 56, "Shona Bell & Jay Moore", 16);
  y += 110;
  const gw = (W - px * 2 - 16 - 36) / 4;
  for (let i = 0; i < 4; i++) {
    b += rect(px + i * (gw + 12), y, gw, 70, { r: 12, fill: C.frame, stroke: C.line });
    b += text(px + i * (gw + 12) + 16, y + 26, ["EMAIL", "TIER", "ENTITY", "LIFECYCLE"][i], { size: 9, fill: C.inkSoft, weight: 600, spacing: 1 });
    b += heading(px + i * (gw + 12) + 16, y + 50, ["client@…", "Mid", "S corp", "Onboarding"][i], 14);
  }
  y += 90;
  for (let i = 0; i < 4; i++) {
    b += rect(px + i * (gw + 12), y, gw, 56, { r: 10, fill: C.frame, stroke: C.line });
    b += text(px + i * (gw + 12) + 16, y + 33, ["History", "Learn library", "My Plan", "Sign out"][i], { size: 12, fill: C.ink, weight: 500 });
  }
  b += note(px, y + 76, 620, "Miller's 7±2 (§1): four destinations keep the client surface inside working-memory limits; secondary actions live one layer down in Account.");
  return svg(W, H, b);
};

/* 11. Admin review (desktop) */
screens["11-admin-review-desktop"] = () => {
  const W = 1280, H = 760;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/admin/review");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, ADMIN_NAV, "Review");
  let y = top + 78;
  b += pageHeader(px, y, "Admin console", "Review Dashboard");
  y += 70;
  // metric grid (4x2)
  const colW = (640 - 3) / 4;
  b += rect(px, y, 640, 130, { r: 14, fill: C.frame, stroke: C.line });
  for (let r = 0; r < 2; r++) for (let cI = 0; cI < 4; cI++) {
    const bx = px + cI * colW, by = y + r * 65;
    if (cI > 0) b += line(bx, by + 8, bx, by + 57, { stroke: C.lineSoft });
    if (r > 0) b += line(px + 8, by, px + 632, by, { stroke: C.lineSoft });
    b += heading(bx + 16, by + 36, String([3, 0, 0, 0, 1, 0, 0, 0][r * 4 + cI]), 22);
    b += text(bx + 16, by + 54, ["Published", "Drafts", "Escalations", "Findings", "Convos", "Unanswered", "Low conf.", "To review"][r * 4 + cI], { size: 9, fill: C.inkSoft });
  }
  // actions card
  b += rect(px + 660, y, W - px * 2 - 16 - 660, 130, { r: 14, fill: C.frame, stroke: C.line });
  b += heading(px + 680, y + 34, "Review actions", 15);
  b += primary(px + 680, y + 76, 170, "Run review checks");
  y += 152;
  // review groups 2x
  const grpW = (W - px * 2 - 16 - 16) / 2;
  for (let i = 0; i < 4; i++) {
    const bx = px + (i % 2) * (grpW + 16);
    const by = y + Math.floor(i / 2) * 120;
    b += rect(bx, by, grpW, 104, { r: 14, fill: C.frame, stroke: C.line });
    b += heading(bx + 18, by + 30, ["Unanswered questions", "Low-confidence answers", "Repeated confusion", "Content gaps"][i], 14);
    b += pill(bx + grpW - 44, by + 14, 26, "0", { fill: "#e8f2fb", stroke: "none", tcol: C.accent });
    b += rect(bx + 18, by + 48, grpW - 36, 40, { r: 8, fill: C.fill, stroke: "none" });
  }
  b += note(px, y + 250, 640, "Mode-specific design (§16): admins scan and triage, so the console uses a dense metric grid and tight rows — the opposite of the airy client surface.");
  return svg(W, H, b);
};

/* 12. Admin sources */
screens["12-admin-sources-desktop"] = () => {
  const W = 1280, H = 640;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/admin/sources");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, ADMIN_NAV, "Sources");
  let y = top + 78;
  b += pageHeader(px, y, "Admin console", "Knowledge Ops");
  y += 70;
  const formW = (W - px * 2 - 16 - 20) / 2;
  b += rect(px, y, formW, 360, { r: 14, fill: C.frame, stroke: C.line });
  let fy = y + 24;
  for (const lbl of ["Title", "Source type", "Strategy key", "Effective year"]) {
    b += text(px + 20, fy + 10, lbl, { size: 11, fill: C.ink, weight: 600 });
    b += rect(px + 20, fy + 18, formW - 40, 34, { r: 8, fill: C.frame, stroke: C.lineSoft });
    fy += 64;
  }
  b += rect(px + 20, fy + 18, formW - 40, 50, { r: 8, fill: C.frame, stroke: C.lineSoft });
  b += primary(px + 20, fy + 80, 160, "Compile draft");
  // metric panel right
  b += rect(px + formW + 20, y, formW, 360, { r: 14, fill: C.frame, stroke: C.line });
  const colW = (formW - 2) / 4;
  for (let r = 0; r < 2; r++) for (let cI = 0; cI < 4; cI++) {
    const bx = px + formW + 20 + cI * colW, by = y + r * 90 + 20;
    b += heading(bx + 16, by + 30, "0", 22);
    b += text(bx + 16, by + 48, "metric", { size: 9, fill: C.inkSoft });
  }
  b += note(px, y + 380, 640, "Admin upload → compile → review → publish: drafts are never client-visible until an admin publishes (§Admin safeguards).");
  return svg(W, H, b);
};

/* generic admin list (wiki / questions / health) */
function adminList(active, title, sub) {
  const W = 1280, H = 620;
  const f = browserFrame(W, H, `ask.beyondfreedomfinancial.com/admin/${active.toLowerCase()}`);
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, ADMIN_NAV, active);
  let y = top + 78;
  b += pageHeader(px, y, "Admin console", title);
  b += text(px, y + 52, sub, { size: 12, fill: C.inkSoft });
  y += 80;
  if (active === "Wiki") {
    const cw = (W - px * 2 - 16 - 32) / 3;
    for (let i = 0; i < 3; i++) {
      const bx = px + i * (cw + 16);
      b += rect(bx, y, cw, 180, { r: 14, fill: C.frame, stroke: C.line });
      b += pill(bx + 18, y + 18, 70, i === 0 ? "published" : "draft", i === 0 ? { fill: "#e0f4ee", stroke: "none", tcol: "#0a6b50" } : { fill: "#fbf1dc", stroke: "none", tcol: "#8a5200" });
      b += heading(bx + 18, y + 70, "Draft page title", 14);
      b += lines(bx + 18, y + 84, cw - 36, 3, { gap: 13, h: 6 });
      b += rect(bx + 18, y + 140, 110, 30, { r: 15, fill: C.frame, stroke: C.lineSoft });
    }
    b += note(px, y + 200, 560, "Default-safe publishing: a draft sits visibly un-published until an admin acts — loss-averse gate against client-visible errors.");
  } else {
    for (let i = 0; i < 3; i++) {
      b += rect(px, y, W - px * 2 - 16, 80, { r: 12, fill: C.frame, stroke: C.line });
      b += `<circle cx="${px + 32}" cy="${y + 32}" r="12" fill="none" stroke="${C.accent}"/>`;
      b += heading(px + 60, y + 32, active === "Health" ? "Stale draft / source gap" : "Client-specific question", 15);
      b += lines(px + 60, y + 46, 540, 2, { gap: 13, h: 6 });
      y += 92;
    }
    b += note(px, y + 6, 560, active === "Health"
      ? "Health surfaces stale drafts and source gaps so content debt is visible before it reaches a client."
      : "Escalations route fact-specific questions to a human — the safety net behind every AI answer (§7).");
  }
  return svg(W, H, b);
}
screens["13-admin-wiki-desktop"] = () => adminList("Wiki", "Wiki Review", "Drafts are not client-visible until published by an admin.");
screens["14-admin-questions-desktop"] = () => adminList("Questions", "Questions & Escalations", "Client-specific questions are routed here for review.");
screens["15-admin-health-desktop"] = () => adminList("Health", "Knowledge Health", "Stale drafts, source gaps, and publication drift.");

/* 16. Admin settings */
screens["16-admin-settings-desktop"] = () => {
  const W = 1280, H = 520;
  const f = browserFrame(W, H, "ask.beyondfreedomfinancial.com/admin/settings");
  let b = f.out; const top = f.top; const px = f.padX;
  b += topNav(px, W - px * 2 - 16, top, ADMIN_NAV, "Settings");
  let y = top + 78;
  b += pageHeader(px, y, "Admin console", "Settings");
  y += 70;
  const gw = (W - px * 2 - 16 - 36) / 4;
  for (let i = 0; i < 4; i++) {
    b += rect(px + i * (gw + 12), y, gw, 90, { r: 12, fill: C.frame, stroke: C.line });
    b += text(px + i * (gw + 12) + 16, y + 26, ["CRM", "AI GATEWAY", "ADMIN ACCESS", "DOMAIN"][i], { size: 9, fill: C.inkSoft, weight: 600, spacing: 1 });
    b += lines(px + i * (gw + 12) + 16, y + 40, gw - 32, 3, { gap: 12, h: 6 });
  }
  b += note(px, y + 110, 620, "Read-only config view: production secrets live in Cloudflare bindings, not in the UI — least-privilege surface for admins.");
  return svg(W, H, b);
};

/* 17. States sheet — empty / loading / error */
screens["17-states-desktop"] = () => {
  const W = 1280, H = 420;
  let b = "";
  b += rect(0, 0, W, H, { r: 0, fill: C.page, stroke: "none" });
  const cw = (W - 24 * 4) / 3;
  const labels = ["EMPTY", "LOADING", "ERROR"];
  for (let i = 0; i < 3; i++) {
    const bx = 24 + i * (cw + 24);
    b += rect(bx, 24, cw, H - 48, { r: 16, fill: C.frame, stroke: C.line });
    b += eyebrow(bx + 24, 56, labels[i]);
    if (i === 0) {
      b += rect(bx + 24, 90, cw - 48, H - 200, { r: 12, fill: C.fill, stroke: C.line, dash: "5 5" });
      b += heading(bx + 44, 150, "No history yet", 16);
      b += text(bx + 44, 176, "Ask a question and it shows here.", { size: 11, fill: C.inkSoft });
      b += primary(bx + 44, 200, 160, "Ask a question");
      b += note(bx + 24, H - 96, cw - 48, "Modeling: empty states show the first action + a stub of what will appear, not a dead end.");
    } else if (i === 1) {
      for (let r = 0; r < 4; r++) b += rect(bx + 24, 100 + r * 28, (cw - 48) * (r === 3 ? 0.5 : 1), 12, { r: 6, fill: r % 2 ? C.fill : C.fillStrong, stroke: "none" });
      b += note(bx + 24, H - 96, cw - 48, "Shimmer skeletons mirror the real layout so the eye lands in the right place on arrival.");
    } else {
      b += rect(bx + 24, 100, cw - 48, 60, { r: 10, fill: "#fce5e9", stroke: "rgba(199,52,74,0.3)" });
      b += text(bx + 40, 136, "Unable to answer right now.", { size: 12, fill: "#a32a3c", weight: 500 });
      b += pill(bx + 24, 180, 90, "Try again", { fill: C.frame, stroke: C.lineSoft });
      b += note(bx + 24, H - 96, cw - 48, "Errors stay calm and recoverable: plain cause + one retry, never a stack trace or dead screen.");
    }
  }
  return svg(W, H, b);
};

/* ── emit ───────────────────────────────────────────────────────────────── */
let count = 0;
for (const [name, fn] of Object.entries(screens)) {
  const out = fn();
  writeFileSync(join(OUT, `${name}.svg`), out, "utf8");
  count++;
}
console.log(`Generated ${count} wireframe SVGs in ${OUT}`);
