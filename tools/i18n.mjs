// Engelsk version av appen. Källan (artifact/vN.html, tools/hosted/*.js) är på svenska; det här steget byter text till engelska.
//   node tools/i18n.mjs extract web/app.js web/index.html > /tmp/strings.json   – listar alla texter och hur de används
//   node tools/i18n.mjs apply   web/app.js web/index.html                        – skriver om filerna på plats
//   node tools/i18n.mjs artifact artifact/v10.html ut.html                       – samma sak för sandlådans enda fil
// tools/en.json har två delar:
//   "text":   svensk text i koden -> engelsk text (byts i koden)
//   "values": värden som sparas i databasen (status, kategori …) -> engelsk etikett. De byts ALDRIG i koden eller i datan,
//             bara när de visas (tv() i appen), så att gammal och ny data fungerar likadant.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import * as walk from "acorn-walk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EN = JSON.parse(readFileSync(join(ROOT, "tools", "en.json"), "utf8"));
const SWEDISH = /[åäöÅÄÖ]|\b(och|eller|inte|för|med|som|från|till|ingen|inga|alla|ny|nytt|nya|spara|avbryt|välj|lägg|saknas|klar|ändra|visa|sök|öppna|stäng|ta bort|skicka|redo|kan|ska|är|har|den|det|här|där|när|utan|efter|innan|per|mer|antal|datum|kommentar|namn|bild|bilder|plagg|tyg|pris|dag|dagar|vecka|sedan|ännu|redan|bara|också|eller|hos|på|av|att|en|ett)\b/i;
const looksLikeText = (s) => /[A-Za-zÅÄÖåäö]{2}/.test(s) && SWEDISH.test(s);

// ---- JS ----
function scanJs(code) {
  const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  const out = [];
  const cmp = new Set();
  const mark = (n) => { if (n && n.type === "Literal" && typeof n.value === "string") cmp.add(n.start); if (n && n.type === "ArrayExpression") n.elements.forEach(mark); };
  walk.ancestor(ast, {
    BinaryExpression(n) { if (["===", "!==", "==", "!="].includes(n.operator)) { mark(n.left); mark(n.right); } },
    SwitchCase(n) { mark(n.test); },
    CallExpression(n) { const c = n.callee; if (c.type === "MemberExpression" && !c.computed && ["includes", "indexOf", "startsWith", "endsWith"].includes(c.property.name)) { n.arguments.forEach(mark); mark(c.object); } },
    Property(n) { if (n.key.type === "Literal") cmp.add(n.key.start); },
    MemberExpression(n) { if (n.computed) mark(n.property); },
  });
  // kod, inte text: klassnamn, id:n, taggar, händelsenamn, samlingsnamn och liknande
  const CODE_PROPS = new Set(["kalla", "from", "datumKalla", "lage", "idx", "bucket", "class", "type", "id", "style", "for", "role", "rel", "target", "src", "href", "method", "autocomplete", "inputmode", "name", "loading", "list", "step", "min", "max", "accept", "value", "key", "typ", "fas", "matris", "tab", "kind", "mode", "view", "status", "cls", "vid", "group", "sort", "dir", "align", "scope", "lang", "charset", "content", "behavior", "block", "position", "display", "tag0"]);
  const CODE_CALLS = { h: [0], $: [0], querySelector: [0], querySelectorAll: [0], closest: [0], matches: [0], addEventListener: [0], removeEventListener: [0], getElementById: [0], createElement: [0], setAttribute: [0, 1], getAttribute: [0], removeAttribute: [0], add: [0, 1, 2], remove: [0, 1], toggle: [0], contains: [0], create: [0], write: [0], sub: [0, 1], collection: [0], doc: [0], inp: [0], selectEl: [0], getItem: [0], setItem: [0], has: [0], get: [0], set: [0], delete: [0], dispatchEvent: [0], Event: [0], getContext: [0], toBlob: [1], toLocaleString: [0], toLocaleDateString: [0], localeCompare: [1], split: [0], join: [0], replace: [0, 1], padStart: [1], test: [0], match: [0], use: [0], from: [0], rpc: [0], fetch: [0], RegExp: [0, 1], slug: [0], sheetCell: [0], getElementsByTagName: [0], insertAdjacentHTML: [0], append: [], import: [0] };
  const codeSet = new Set();
  const lit = (n) => n && n.type === "Literal" && typeof n.value === "string";
  walk.ancestor(ast, {
    Property(n) { const k = n.key.type === "Identifier" ? n.key.name : n.key.value; if (!CODE_PROPS.has(k)) return; const v = n.value; const mk = (x) => { if (!x) return; if (lit(x)) codeSet.add(x.start); else if (x.type === "BinaryExpression") { mk(x.left); mk(x.right); } else if (x.type === "ConditionalExpression") { mk(x.consequent); mk(x.alternate); } else if (x.type === "TemplateLiteral") x.quasis.forEach((q) => codeSet.add(q.start)); else if (x.type === "LogicalExpression") { mk(x.left); mk(x.right); } }; if (k !== "status" && k !== "typ" || true) mk(v); },
    CallExpression(n) { const c = n.callee; const name = c.type === "Identifier" ? c.name : c.type === "MemberExpression" && !c.computed ? c.property.name : ""; let idx = Object.hasOwn(CODE_CALLS, name) ? CODE_CALLS[name] : null; if (!idx) return; if (["add", "remove", "toggle", "contains"].includes(name) && !(c.type === "MemberExpression" && c.object.type === "MemberExpression" && !c.object.computed && c.object.property.name === "classList")) return; for (const i of idx) { const x = n.arguments[i]; const mk = (y) => { if (!y) return; if (lit(y)) codeSet.add(y.start); else if (y.type === "BinaryExpression") { mk(y.left); mk(y.right); } else if (y.type === "ConditionalExpression") { mk(y.consequent); mk(y.alternate); } else if (y.type === "TemplateLiteral") y.quasis.forEach((q) => codeSet.add(q.start)); }; mk(x); } },
    NewExpression(n) { if (n.callee.type === "Identifier" && ["Event", "RegExp", "CustomEvent", "DragEvent"].includes(n.callee.name)) n.arguments.forEach((x) => { if (lit(x)) codeSet.add(x.start); }); },
  });
  walk.simple(ast, {
    Literal(n) { if (typeof n.value === "string") out.push({ kind: "str", start: n.start, end: n.end, value: n.value, cmp: cmp.has(n.start), code: codeSet.has(n.start) }); },
    TemplateElement(n) { if (n.value.cooked) out.push({ kind: "tpl", start: n.start, end: n.end, value: n.value.cooked, cmp: false, code: codeSet.has(n.start) }); },
  });
  return out.sort((a, b) => a.start - b.start);
}
const tplEscape = (s) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
// Slår upp på texten utan omgivande blanksteg och sätter tillbaka blankstegen, så att " bilder" och "bilder " delar översättning.
const lookup = (v) => { const t = v.trim(); if (!t) return null; const en = EN.text[t] ?? (v !== t ? EN.values[t] : undefined); if (en == null) return null; const i = v.indexOf(t); return v.slice(0, i) + en + v.slice(i + t.length); };
function applyJs(code, report) {
  const lits = scanJs(code); let out = "", pos = 0;
  const cmpValues = new Set(lits.filter((l) => l.cmp).map((l) => l.value));
  for (const l of lits) {
    // Rör aldrig kod (klassnamn, nycklar) eller värden som jämförs mot sparad data – de översätts vid visning i stället.
    if (l.code || cmpValues.has(l.value) || Object.hasOwn(EN.values, l.value)) continue;
    const en = EN.exact && Object.hasOwn(EN.exact, l.value) ? EN.exact[l.value] : lookup(l.value);
    if (en == null) { if (report && looksLikeText(l.value) && !EN.keep.includes(l.value.trim())) report.add(l.value.trim()); continue; }
    out += code.slice(pos, l.start) + (l.kind === "str" ? JSON.stringify(en) : tplEscape(en)); pos = l.end;
  }
  out += code.slice(pos);
  const hook = "const EN_VAL = {};";
  if (!out.includes(hook)) throw new Error("i18n: hittar inte EN_VAL-kroken i appen");
  return out.replace(hook, "const EN_VAL = " + JSON.stringify(EN.values) + ";");
}

// ---- HTML: text mellan taggar och i attribut som visas ----
function scanHtml(html) {
  const out = [];
  const body = html.replace(/<style[\s\S]*?<\/style>/g, (m) => " ".repeat(m.length)).replace(/<script[\s\S]*?<\/script>/g, (m) => " ".repeat(m.length)).replace(/<svg[\s\S]*?<\/svg>/g, (m) => " ".repeat(m.length));
  for (const m of body.matchAll(/>([^<>]+)</g)) { const raw = m[1]; const t = raw.trim(); if (t && /[A-Za-zÅÄÖåäö]{2}/.test(t)) out.push({ start: m.index + 1 + raw.indexOf(t), end: m.index + 1 + raw.indexOf(t) + t.length, value: t }); }
  for (const m of body.matchAll(/\b(placeholder|aria-label|title|alt)="([^"]+)"/g)) out.push({ start: m.index + m[1].length + 2, end: m.index + m[1].length + 2 + m[2].length, value: m[2] });
  return out.sort((a, b) => a.start - b.start);
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const encode = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function applyHtml(html, report) {
  let out = "", pos = 0;
  for (const l of scanHtml(html)) {
    const key = decode(l.value); const en = EN.text[key] ?? EN.values[key];
    if (en == null) { if (report && looksLikeText(key) && !EN.keep.includes(key)) report.add(key); continue; }
    out += html.slice(pos, l.start) + encode(en); pos = l.end;
  }
  out = (out + html.slice(pos)).replace('<html lang="sv">', '<html lang="en">');
  for (const [sv, en] of Object.entries(EN.css || {})) out = out.split(sv).join(en);
  return out;
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "extract") {
  const js = readFileSync(a, "utf8"); const m = new Map();
  for (const l of scanJs(js)) { const e = m.get(l.value) || { n: 0, cmp: 0, code: 0, kind: l.kind, ctx: "" }; e.n++; if (l.cmp) e.cmp++; if (l.code) e.code++; if (!e.ctx) e.ctx = js.slice(Math.max(0, l.start - 60), Math.min(js.length, l.end + 40)).replace(/\s+/g, " "); m.set(l.value, e); }
  const html = b ? scanHtml(readFileSync(b, "utf8")).map((x) => decode(x.value)) : [];
  process.stdout.write(JSON.stringify({ js: [...m.entries()].map(([value, e]) => Object.assign({ value }, e)), html: [...new Set(html)] }, null, 1));
} else if (mode === "apply") {
  const report = new Set();
  writeFileSync(a, applyJs(readFileSync(a, "utf8"), report));
  if (b) writeFileSync(b, applyHtml(readFileSync(b, "utf8"), report));
  if (report.size) { console.error("i18n: " + report.size + " texter saknar översättning i tools/en.json:"); for (const s of [...report].slice(0, 400)) console.error("  " + JSON.stringify(s)); process.exitCode = process.argv.includes("--strict") ? 1 : 0; }
  else console.log("i18n: allt översatt.");
} else if (mode === "artifact") {
  const src = readFileSync(a, "utf8"); const report = new Set();
  const s0 = src.indexOf("<script>\n(() => {"), s1 = src.lastIndexOf("</script>");
  const js = applyJs(src.slice(s0 + "<script>\n".length, s1), report);
  const head = applyHtml(src.slice(0, s0), report), tail = applyHtml(src.slice(s1), report);
  writeFileSync(b, head + "<script>\n" + js + tail);
  if (report.size) { console.error("i18n: " + report.size + " texter saknar översättning:"); for (const s of [...report].slice(0, 400)) console.error("  " + JSON.stringify(s)); }
  else console.log("i18n: allt översatt.");
} else { console.error("extract | apply | artifact"); process.exit(1); }
