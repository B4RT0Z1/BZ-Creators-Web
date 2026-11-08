// Pizarras BZ: lienzo infinito, edición tipo Miro, modo presentación por pasos, guardado y recarga en vivo.
import {iconSvg, ui, ICONS} from './icons.js';
import {api, toast, ask} from './app.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;

/* ---------- Estado ---------- */
let B = null, id = null, rev = null, catalog = {apps: {}, logos: {}};
let mode = 'edit', tool = 'select', color = '#FF6B35', step = 0, everything = false;
let sel = new Set(), undoStack = [], redoStack = [], sessionHist = [];
let saveT = null, saving = false, dirty = false, editing = null, act = null, spaceDown = false, justCreated = null, pendingExternal = null, inited = false, notesWin = null;
const cam = {x: 0, y: 0, s: .2};
const nodes = new Map(); // id → {node, sig}
let world, view;

const STICKY = [['#FDE68A', 'Amarilla'], ['#C4B5FD', 'Violeta'], ['#FDBA74', 'Naranja'], ['#86EFAC', 'Verde'], ['#F9A8D4', 'Rosa'], ['#F4F4F5', 'Blanca']];
const COLORS = [['#FF6B35', 'Naranja'], ['#A855F7', 'Violeta'], ['#22c55e', 'Verde'], ['#ffffff', 'Blanco']];
const TEXTC = [['#ffffff', 'Blanco'], ['#FF6B35', 'Naranja'], ['#A855F7', 'Violeta'], ['#22c55e', 'Verde'], ['#FDE68A', 'Amarillo']];
const ACCENT = [['', 'Sin color'], ['#FF6B35', 'Naranja'], ['#A855F7', 'Violeta'], ['#22c55e', 'Verde']];
const TOOLS = {
  edit: [['select', 'Seleccionar y mover (V)'], ['pen', 'Lápiz: queda guardado (P)'], ['marker', 'Marcador: se borra solo (M)'], ['text', 'Texto (T)'], ['sticky', 'Nota adhesiva (S)'], ['card', 'Tarjeta (R)'], ['frame', 'Marco o sección (G)'], ['arrow', 'Flecha: de una cosa a otra (K)'], ['media', 'Imagen o video (I)'], ['erase', 'Goma: trazos y textos (E)'], ['laser', 'Puntero láser (L)']],
  present: [['move', 'Mover la vista (V)'], ['pen', 'Lápiz (P)'], ['marker', 'Marcador: se borra solo (M)'], ['text', 'Texto (T)'], ['erase', 'Goma (E)'], ['laser', 'Puntero láser (L)']]
};
const KEYS = {v: 'select', p: 'pen', m: 'marker', t: 'text', s: 'sticky', r: 'card', g: 'frame', k: 'arrow', i: 'media', e: 'erase', l: 'laser'};

/* ---------- Utilidades ---------- */
const byId = i => B.elements.find(e => e.id === i);
const mediaSrc = s => s && s.startsWith('media/') ? `files/${s}` : s;
const sig = e => { const {x, y, w, h, ...rest} = e; return JSON.stringify(rest); };
function uid(prefix) { let i; do i = prefix + '-' + Math.random().toString(36).slice(2, 6); while (byId(i)); return i; }
const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
function setPath(o, p, v) { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; }
const ALLOWED = {B: 1, STRONG: 1, I: 1, EM: 1, BR: 1, SPAN: 1, CODE: 1, U: 1};
function clean(html) {
  const t = document.createElement('template'); t.innerHTML = html || '';
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 1) {
      walk(c);
      if (c.tagName === 'DIV' || c.tagName === 'P') { c.before(document.createElement('br')); c.replaceWith(...c.childNodes); return; }
      if (!ALLOWED[c.tagName]) { c.replaceWith(...c.childNodes); return; }
      const cls = [...c.classList].filter(k => k === 'tag' || k === 'mono'); [...c.attributes].forEach(a => c.removeAttribute(a.name)); if (cls.length) c.className = cls.join(' ');
    } else if (c.nodeType !== 3) c.remove();
  });
  walk(t.content); return t.innerHTML.replace(/^<br>/, '');
}
function logoHtml(name, opts = {}) {
  const o = catalog.logos[name]; if (!o) return '';
  const c = opts.dark && o.color === '#ffffff' ? '#111' : o.color;
  return `<i class="logo${o.img ? ' img' : ''}" style="--m:url('../assets/logos/${name}.svg');${c ? `--c:${c}` : ''}"></i>`;
}
const markHtml = (logo, icon, color = '#FF6B35') => logo && catalog.logos[logo] ? logoHtml(logo) : icon ? iconSvg(icon, color) : '';
const nameOf = i => { const e = byId(i); if (!e) return i; return (e.title || e.label || e.text || e.caption || ({link: 'Flecha', ink: 'Dibujo', image: 'Imagen', video: 'Video', youtube: 'YouTube'})[e.type] || e.type).toString().split('\n')[0].slice(0, 28); };

/* ---------- Dibujar cada elemento ---------- */
function cardHtml(e) {
  let h = '';
  const ic = e.logo && catalog.logos[e.logo] ? logoHtml(e.logo) : e.icon ? iconSvg(e.icon, e.iconColor || '#FF6B35') : '';
  if (ic) h += `<div class="ico">${ic}</div>`;
  if (e.title != null) h += `<h3 data-f="title" class="${e.titleMono ? 'mono' : ''}" style="${e.titleSize ? `font-size:${e.titleSize}px` : ''}">${esc(e.title)}</h3>`;
  if (e.what != null) h += `<div class="what" data-f="what">${esc(e.what)}</div>`;
  (e.body || []).forEach((b, i) => {
    if (b.t === 'p') h += `<div class="ex" data-f="body.${i}.html">${clean(b.html)}</div>`;
    else if (b.t === 'code') h += b.html != null ? `<div class="ex mono" data-f="body.${i}.html">${clean(b.html.replace(/\n/g, '<br>'))}</div>` : `<div class="ex mono" data-f="body.${i}.text">${esc(b.text)}</div>`;
    else if (b.t === 'subs') h += `<div class="row">${b.items.map((s, j) => `<div class="sub"${s.app ? ` data-app="${esc(s.app)}"` : ''} style="${s.border ? `border-color:${s.border}` : ''}">${markHtml(s.logo, s.icon, s.color)}<h4 data-f="body.${i}.items.${j}.title" style="${s.color ? `color:${s.color}` : ''}">${esc(s.title)}</h4><p data-f="body.${i}.items.${j}.text">${esc(s.text)}</p>${s.chips ? `<div class="chips">${s.chips.map(c => `<div class="chip"${c.app ? ` data-app="${esc(c.app)}"` : ''}>${markHtml(c.logo, c.icon, c.iconColor)}<h4>${esc(c.label)}</h4></div>`).join('')}</div>` : ''}</div>`).join('')}</div>`;
    else if (b.t === 'facts') h += `<div class="facts">${b.items.map((f, j) => `<div class="fact"><b data-f="body.${i}.items.${j}.k">${esc(f.k)}</b><p data-f="body.${i}.items.${j}.v">${esc(f.v)}</p></div>`).join('')}</div>`;
    else if (b.t === 'chips') h += `<div class="chips">${b.items.map(c => `<div class="chip"${c.app ? ` data-app="${esc(c.app)}"` : ''}>${markHtml(c.logo, c.icon, c.iconColor)}<h4>${esc(c.label)}</h4></div>`).join('')}</div>`;
    else if (b.t === 'commits') h += `<div class="commits">${b.items.map((c, k) => (k ? '<div class="bar"></div>' : '') + `<div class="commit${c === 'bad' ? ' bad' : ''}"></div>`).join('')}</div>`;
  });
  return h;
}
function build(e) {
  const n = document.createElement('div'); n.dataset.id = e.id;
  const cap = e.caption ? `<div class="cap">${esc(e.caption)}</div>` : '';
  if (e.type === 'frame') { n.className = 'el frame'; n.innerHTML = `<h2 data-f="label">${esc(e.label)}</h2>`; if (e.color) n.style.setProperty('--fc', e.color); }
  else if (e.type === 'card') { n.className = 'el node'; n.innerHTML = cardHtml(e); if (e.app) n.dataset.app = e.app; if (e.accent) n.style.borderColor = e.accent; }
  else if (e.type === 'sticky') { n.className = 'el sticky'; n.dataset.f = 'text'; n.textContent = e.text || ''; n.style.background = e.color || STICKY[0][0]; n.style.fontSize = (e.size || 40) + 'px'; }
  else if (e.type === 'text') { n.className = 'el txt'; n.dataset.f = 'text'; n.textContent = e.text || ''; n.style.fontSize = (e.size || 56) + 'px'; n.style.color = e.color || '#fff'; }
  else if (e.type === 'image') { n.className = 'el media'; n.innerHTML = `<img src="${esc(mediaSrc(e.src))}" draggable="false" alt="">${cap}<div class="shield"></div>`; }
  else if (e.type === 'video') {
    n.className = 'el media'; n.innerHTML = `<video src="${esc(mediaSrc(e.src))}" preload="metadata" playsinline controls${e.loop ? ' loop' : ''}${e.muted ? ' muted' : ''}></video><div class="pbtn"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></div>${cap}<div class="shield"></div>`;
    const v = n.querySelector('video'); v.addEventListener('play', () => n.classList.add('playing')); v.addEventListener('pause', () => n.classList.remove('playing'));
  }
  else if (e.type === 'youtube') { n.className = 'el media'; n.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(e.vid)}?rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>${cap}<div class="shield"></div>`; }
  if (e.url) n.dataset.url = e.url;
  ro.observe(n);
  return n;
}
function geom(n, e) {
  n.style.left = e.x + 'px'; n.style.top = e.y + 'px'; n.style.width = e.w ? e.w + 'px' : '';
  if (e.type === 'card') { n.style.minHeight = e.h ? e.h + 'px' : ''; n.style.height = ''; } else n.style.height = e.h ? e.h + 'px' : '';
}
let roPending = false;
const ro = new ResizeObserver(() => { if (roPending) return; roPending = true; requestAnimationFrame(() => { roPending = false; if (B) { renderLinks(); renderSel(); } }); });

function renderEls() {
  const seen = new Set(), order = {frames: [], els: []};
  for (const e of B.elements) {
    if (e.type === 'link' || e.type === 'ink') continue;
    const s = sig(e); let r = nodes.get(e.id);
    if (!r || r.sig !== s) { const n = build(e); if (r) { ro.unobserve(r.node); r.node.replaceWith(n); } r = {node: n, sig: s}; nodes.set(e.id, r); }
    geom(r.node, e); seen.add(e.id); order[e.type === 'frame' ? 'frames' : 'els'].push(r.node);
  }
  for (const [k, r] of nodes) if (!seen.has(k)) { ro.unobserve(r.node); r.node.remove(); nodes.delete(k); }
  for (const [parent, list] of [[$('frames'), order.frames], [$('els'), order.els]]) {
    let prev = null; for (const n of list) { const want = prev ? prev.nextSibling : parent.firstChild; if (n !== want) parent.insertBefore(n, want); prev = n; }
  }
}
function renderInk() {
  $('ink').innerHTML = B.elements.filter(e => e.type === 'ink').map(e => `<g data-id="${e.id}" transform="translate(${e.x || 0} ${e.y || 0})"><path class="hit" d="${e.d}" stroke-width="${Math.max(30, e.w * 4)}"/><path d="${e.d}" stroke="${e.color}" stroke-width="${e.w}" style="filter:drop-shadow(0 0 ${r1(e.w * .8)}px ${e.color}aa)"/></g>`).join('');
}
function rectOf(i) {
  const e = byId(i); if (!e || e.type === 'link') return null;
  if (e.type === 'ink') { const g = $('ink').querySelector(`[data-id="${i}"] path:not(.hit)`); if (!g) return null; const b = g.getBBox(), p = e.w / 2; return {x: b.x + (e.x || 0) - p, y: b.y + (e.y || 0) - p, w: b.width + e.w, h: b.height + e.w}; }
  const r = nodes.get(i); if (!r) return null; return {x: e.x, y: e.y, w: r.node.offsetWidth, h: r.node.offsetHeight};
}
function linkPath(A, Bb) {
  const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = Bb.x + Bb.w / 2, by = Bb.y + Bb.h / 2, h = Math.abs(bx - ax) > Math.abs(by - ay);
  const x1 = h ? ax + Math.sign(bx - ax) * A.w / 2 : ax, y1 = h ? ay : ay + Math.sign(by - ay) * A.h / 2, x2 = h ? bx - Math.sign(bx - ax) * Bb.w / 2 : bx, y2 = h ? by : by - Math.sign(by - ay) * Bb.h / 2;
  const d = `M${r1(x1)} ${r1(y1)} C ${r1(h ? (x1 + x2) / 2 : x1)} ${r1(h ? y1 : (y1 + y2) / 2)}, ${r1(h ? (x1 + x2) / 2 : x2)} ${r1(h ? y2 : (y1 + y2) / 2)}, ${r1(x2)} ${r1(y2)}`;
  const ang = h ? (x2 > x1 ? 0 : Math.PI) : (y2 > y1 ? Math.PI / 2 : -Math.PI / 2), L = 30;
  const head = `M${r1(x2 - L * Math.cos(ang - .5))} ${r1(y2 - L * Math.sin(ang - .5))} L${r1(x2)} ${r1(y2)} L${r1(x2 - L * Math.cos(ang + .5))} ${r1(y2 - L * Math.sin(ang + .5))}`;
  return {d, head, lx: (x1 + x2) / 2 + (h ? 0 : 70), ly: (y1 + y2) / 2 + (h ? -26 : 10)};
}
function renderLinks() {
  const vis = visFn(); let h = '';
  for (const e of B.elements) {
    if (e.type !== 'link') continue; const A = rectOf(e.from), Bb = rectOf(e.to); if (!A || !Bb) continue;
    const p = linkPath(A, Bb);
    h += `<g data-id="${e.id}" class="${vis(e.id) ? '' : 'off'}${sel.has(e.id) ? ' sel' : ''}"><path class="hit" d="${p.d}"/><path class="ln" d="${p.d}"/>${e.arrow ? `<path class="hd" d="${p.head}"/>` : ''}${e.label ? `<text x="${r1(p.lx)}" y="${r1(p.ly)}">${esc(e.label)}</text>` : ''}</g>`;
  }
  $('links').innerHTML = h;
  $('links').querySelectorAll('path.ln').forEach(p => { const L = Math.ceil(p.getTotalLength()) + 2; p.style.setProperty('--len', L); p.style.strokeDasharray = L; p.style.strokeDashoffset = 0; });
}

/* ---------- Visibilidad por pasos ---------- */
function staged() { const s = new Set(); B.steps.forEach(st => (st.show || []).forEach(i => s.add(i))); return s; }
function visFn() {
  if (mode === 'edit' || everything || !B.steps.length) return () => true;
  const stg = staged(), v = new Set(); B.steps.slice(0, step + 1).forEach(st => (st.show || []).forEach(i => v.add(i)));
  const vis = i => { if (stg.has(i)) return v.has(i); const e = byId(i); if (e && e.type === 'link') return vis(e.from) && vis(e.to); return true; };
  return vis;
}
function applyVis() {
  const vis = visFn(), st = mode === 'present' ? B.steps[step] : null, f = new Set(st && st.focus || []);
  for (const [k, r] of nodes) { r.node.classList.toggle('hid', !vis(k)); r.node.classList.toggle('focus', f.has(k)); }
  $('links').querySelectorAll('g').forEach(g => g.classList.toggle('off', !vis(g.dataset.id)));
  $('ink').querySelectorAll('g').forEach(g => g.style.display = vis(g.dataset.id) ? '' : 'none');
  const cv = B.cover || {}; $('cover').querySelector('.k').textContent = cv.kicker || ''; $('cover').querySelector('h1').textContent = cv.title || B.title; $('cover').querySelector('p').textContent = cv.subtitle || '';
  $('cover').classList.toggle('on', !!(st && st.cover) && !overlayHidden && !zoomedIn);
  const ov = st && st.overlay && (B.overlays || {})[st.overlay];
  if (ov) { $('overlay').querySelector('h2').textContent = ov.title || ''; $('overlay').querySelector('.logos').innerHTML = (ov.logos || []).map(l => typeof l === 'string' ? logoHtml(l) : markHtml(l.logo, l.icon, '#ffffff')).join(''); $('overlay').querySelector('.names').textContent = ov.names || ''; }
  $('overlay').classList.toggle('on', !!ov && !overlayHidden && !zoomedIn);
  if (mode === 'present' && B.steps.length) {
    const where = stepWhere(); [...$('dots').children].forEach((d, i) => { d.classList.toggle('cur', i === step); d.classList.toggle('done', i < step); });
    $('where').innerHTML = `<b>${esc(where[step] || '')}</b> · ${step + 1}/${B.steps.length}`;
  }
  mini();
}
function stepWhere() {
  const frames = Object.fromEntries(B.elements.filter(e => e.type === 'frame').map(e => [e.id, e.label]));
  let cur = 'Inicio'; return B.steps.map(s => { const f = (s.show || []).find(i => frames[i]); cur = s.cover ? 'Inicio' : s.overview ? 'Mapa completo' : f ? frames[f] : cur; return cur; }).map(w => w === w.toUpperCase() ? w.toLowerCase().split(' · ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ').replace(/\b(ia|ai|api|db)\b/gi, m => m.toUpperCase()) : w);
}
function renderDots() {
  document.body.classList.toggle('has-steps', B.steps.length > 0);
  const where = stepWhere();
  $('dots').innerHTML = B.steps.map((s, i) => `<i title="${i + 1}. ${esc(where[i])}" class="${i && where[i] !== where[i - 1] ? 'gap' : ''}" data-i="${i}"></i>`).join('');
}
function setStep(i, move = true) {
  if (!B.steps.length) return; step = clamp(i, 0, B.steps.length - 1); overlayHidden = false; zoomedIn = false; overlayBase = null; applyVis(); syncNotes(); renderPanel();
  const s = B.steps[step];
  if (move) { if (s.cover || s.overview || !(s.focus || s.show || []).length) fly(contentBounds(), 60); else fly(boundsOf(s.focus && s.focus.length ? s.focus : s.show), 160); }
  overlayBase = cam.s;
  if (s.play) { const v = nodes.get(s.play)?.node.querySelector('video'); if (v) { v.currentTime = 0; v.play().catch(() => {}); } }
}
const go = d => setStep(step + d);
// La portada y el cartel final se van cuando movés o acercás la vista (o con clic / Esc); vuelven al regresar a ese paso.
let overlayHidden = false, overlayBase = null, zoomedIn = false;
function overlayZoomCheck() {
  if (!B || mode !== 'present' || !B.steps.length || overlayBase == null) return; const st = B.steps[step]; if (!(st.cover || st.overlay)) return;
  const inNow = cam.s > overlayBase * 1.2; if (zoomedIn && !inNow) overlayHidden = false; zoomedIn = inNow;
  const show = !inNow && !overlayHidden; $('cover').classList.toggle('on', !!st.cover && show); $('overlay').classList.toggle('on', !!(st.overlay && (B.overlays || {})[st.overlay]) && show);
}
function dismissOverlays() { if (overlayHidden || !($('overlay').classList.contains('on') || $('cover').classList.contains('on'))) return; overlayHidden = true; $('overlay').classList.remove('on'); $('cover').classList.remove('on'); }

/* ---------- Cámara ---------- */
function apply(anim) {
  world.classList.toggle('anim', !!anim); $('grid-bg').style.transition = anim ? 'background-size 1s cubic-bezier(.65,0,.25,1), background-position 1s cubic-bezier(.65,0,.25,1)' : 'none';
  world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`;
  const g = 60 * cam.s, bg = $('grid-bg'); bg.style.backgroundSize = `${g}px ${g}px`; bg.style.backgroundPosition = `${cam.x}px ${cam.y}px`; bg.style.opacity = clamp((cam.s - .06) / .12, 0, 1);
  document.documentElement.style.setProperty('--is', 1 / cam.s);
  $('zoomlvl').textContent = Math.round(cam.s * 100) + '%'; mini(); hideCard(); renderSel(); overlayZoomCheck();
}
function fly(b, pad = 160, anim = true) {
  if (!b) return; const top = mode === 'edit' ? 70 : 0, vw = innerWidth - ($('panel').classList.contains('on') && mode === 'edit' ? 384 : 0), vh = innerHeight - top;
  const s = Math.min(vw / (b.w + pad * 2), vh / (b.h + pad * 2), 1.15); Object.assign(cam, {s, x: vw / 2 - (b.x + b.w / 2) * s, y: top + vh / 2 - (b.y + b.h / 2) * s}); apply(anim);
}
function zoomAt(px, py, f, anim = false) { const s = clamp(cam.s * f, .03, 3); cam.x = px - (px - cam.x) * s / cam.s; cam.y = py - (py - cam.y) * s / cam.s; cam.s = s; apply(anim); }
const toWorld = (x, y) => ({x: (x - cam.x) / cam.s, y: (y - cam.y) / cam.s});
function boundsOf(ids) {
  const rs = [].concat(ids || []).map(rectOf).filter(Boolean); if (!rs.length) return null;
  const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return {x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y};
}
function contentBounds(onlyVisible = true) { const vis = visFn(); return boundsOf(B.elements.filter(e => e.type !== 'link' && (!onlyVisible || mode === 'edit' || vis(e.id) || !staged().size)).map(e => e.id)) || {x: 0, y: 0, w: 1600, h: 900}; }

/* ---------- Minimapa ---------- */
function mini() {
  const M = $('mini'); if (!B) return; const all = contentBounds(false), pad = Math.max(all.w, all.h) * .06;
  const bx = all.x - pad, by = all.y - pad, bw = all.w + pad * 2, bh = all.h + pad * 2, W = M.clientWidth, H = M.clientHeight, k = Math.min(W / bw, H / bh), ox = (W - bw * k) / 2, oy = (H - bh * k) / 2;
  M.dataset.k = JSON.stringify({bx, by, k, ox, oy});
  const vis = visFn(), st = mode === 'present' ? B.steps[step] : null, f = new Set(st && st.focus || []);
  M.querySelectorAll('.m').forEach(d => d.remove());
  for (const e of B.elements) {
    if (e.type === 'link' || e.type === 'ink' || !vis(e.id)) continue; const r = rectOf(e.id); if (!r) continue;
    const d = document.createElement('div'); d.className = 'm' + (e.type === 'frame' ? ' fr' : '') + (f.has(e.id) || sel.has(e.id) ? ' f' : '');
    Object.assign(d.style, {left: ox + (r.x - bx) * k + 'px', top: oy + (r.y - by) * k + 'px', width: Math.max(2, r.w * k) + 'px', height: Math.max(2, r.h * k) + 'px'}); M.appendChild(d);
  }
  const a = toWorld(0, 0), b = toWorld(innerWidth, innerHeight);
  Object.assign($('vp').style, {left: ox + (a.x - bx) * k + 'px', top: oy + (a.y - by) * k + 'px', width: (b.x - a.x) * k + 'px', height: (b.y - a.y) * k + 'px'});
}

/* ---------- Render general ---------- */
function renderAll() {
  if (!B) return;
  renderEls(); renderInk(); renderLinks(); renderDots(); applyVis(); renderSel(); renderPanel();
  const t = $('title'); if (document.activeElement !== t) t.value = B.title || '';
  document.title = (B.title || 'Pizarra') + ' · Pizarras BZ';
}

/* ---------- Deshacer y guardar ---------- */
const snapshot = () => JSON.stringify({title: B.title, subtitle: B.subtitle, cover: B.cover, overlays: B.overlays, elements: B.elements, steps: B.steps});
function pushUndo(s) { undoStack.push(s); if (undoStack.length > 200) undoStack.shift(); redoStack = []; }
function mutate(fn) { pushUndo(snapshot()); fn(); renderAll(); scheduleSave(); }
function restore(s) { Object.assign(B, JSON.parse(s)); sel = new Set([...sel].filter(byId)); step = clamp(step, 0, Math.max(0, B.steps.length - 1)); renderAll(); scheduleSave(); }
function undo() {
  if (mode === 'present' || (sessionHist.length && tool !== 'select')) { const h = sessionHist.pop(); if (h) { if (h.type === 'add') h.g.remove(); else h.parent.appendChild(h.g); return; } if (mode === 'present') return; }
  const s = undoStack.pop(); if (!s) return toast('No hay nada para deshacer'); redoStack.push(snapshot()); restore(s);
}
function redo() { const s = redoStack.pop(); if (!s) return; undoStack.push(snapshot()); restore(s); }
function setSave(t, err = false) { const s = $('saveState'); s.textContent = t; s.classList.toggle('err', err); }
function scheduleSave() { dirty = true; setSave('Guardando…'); clearTimeout(saveT); saveT = setTimeout(save, 450); }
async function save() {
  if (saving || !dirty || !id) return; saving = true; dirty = false; const myId = id;
  try {
    const {status, data} = await api(`/api/boards/${id}`, {method: 'PUT', body: JSON.stringify({board: B, baseRev: rev})});
    if (myId !== id) return;
    if (status === 409) { B = normalize(data.board); rev = data.rev; undoStack = []; redoStack = []; renderAll(); toast('La pizarra cambió en el archivo: cargué esa versión'); }
    else rev = data.rev;
    setSave(dirty ? 'Guardando…' : 'Guardado');
  } catch (e) { dirty = true; setSave('Sin guardar', true); toast('No se pudo guardar: ' + e.message); }
  finally { saving = false; if (dirty) { clearTimeout(saveT); saveT = setTimeout(save, 800); } }
}
async function flush() { clearTimeout(saveT); if (dirty) await save(); }
addEventListener('pagehide', () => { if (dirty && id) fetch(`/api/boards/${id}`, {method: 'PUT', keepalive: true, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({board: B, baseRev: rev})}); });
const normalize = b => ({version: 1, elements: [], steps: [], ...b});

/* ---------- Selección y barra contextual ---------- */
const resizable = e => e && ['frame', 'card', 'sticky', 'text', 'image', 'video', 'youtube'].includes(e.type);
function renderSel() {
  if (!B) return; const c = $('sel'); c.innerHTML = '';
  $('links').querySelectorAll('g').forEach(g => g.classList.toggle('sel', sel.has(g.dataset.id)));
  for (const [k, r] of nodes) r.node.classList.toggle('selected', sel.has(k));
  if (mode !== 'edit' || !sel.size) { $('ctx').classList.remove('on'); return; }
  const pad = 8 / cam.s;
  for (const i of sel) { const r = rectOf(i); if (!r) continue; const d = document.createElement('div'); d.className = 'box'; Object.assign(d.style, {left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px'}); c.appendChild(d); }
  if (sel.size === 1) { const i = [...sel][0], e = byId(i), r = rectOf(i); if (r && resizable(e) && !editing) { const h = document.createElement('div'); h.className = 'handle'; Object.assign(h.style, {left: r.x + r.w + pad + 'px', top: r.y + r.h + pad + 'px'}); c.appendChild(h); } }
  placeCtx();
}
function buildCtx() {
  const ctx = $('ctx'); if (mode !== 'edit' || !sel.size) { ctx.classList.remove('on'); return; }
  const els = [...sel].map(byId).filter(Boolean), types = new Set(els.map(e => e.type)), one = types.size === 1 ? [...types][0] : null, e0 = els[0];
  const sw = (list, key, cur) => list.map(([c, t]) => `<button class="ib${(cur || '') === c ? ' on' : ''}" data-c="${key}:${c}" data-tip="${t}"><span class="sw" style="background:${c || 'transparent'};${c ? '' : 'border-style:dashed'}"></span></button>`).join('');
  let h = '';
  if (one === 'sticky') h += sw(STICKY, 'color', e0.color || STICKY[0][0]) + '<hr>' + `<button class="ib" data-a="smaller" data-tip="Letra más chica">${ui('minus')}</button><button class="ib" data-a="bigger" data-tip="Letra más grande">${ui('plus')}</button><hr>`;
  if (one === 'text') h += sw(TEXTC, 'color', e0.color || '#ffffff') + '<hr>' + `<button class="ib" data-a="smaller" data-tip="Más chico">${ui('minus')}</button><button class="ib" data-a="bigger" data-tip="Más grande">${ui('plus')}</button><hr>`;
  if (one === 'frame') h += sw(COLORS, 'color', e0.color || '#A855F7') + '<hr>';
  if (one === 'card') h += `<button class="ib" data-a="icon" data-tip="Ícono o logo">${ui('shape')}</button>` + sw(ACCENT, 'accent', e0.accent || '') + '<hr>';
  if (one === 'link') h += `<button class="ib" data-a="label" data-tip="Texto de la flecha">${ui('text')}</button><button class="ib${e0.arrow ? ' on' : ''}" data-a="head" data-tip="Punta de flecha">${ui('arrow')}</button><hr>`;
  if (one && ['image', 'video', 'youtube'].includes(one)) h += `<button class="ib" data-a="caption" data-tip="Texto sobre el video o imagen">${ui('text')}</button>` + (one === 'video' ? `<button class="ib${e0.loop ? ' on' : ''}" data-a="loop" data-tip="Repetir en bucle">${ui('redo')}</button>` : '') + '<hr>';
  if (!types.has('link') && !types.has('ink')) h += `<button class="ib${els.length === 1 && e0.url ? ' on' : ''}" data-a="url" data-tip="Enlace (aparece al hacer clic)">${ui('link')}</button>`;
  if (!types.has('link')) h += `<button class="ib" data-a="front" data-tip="Traer al frente">${ui('front')}</button><button class="ib" data-a="back" data-tip="Mandar atrás">${ui('backz')}</button><button class="ib" data-a="dup" data-tip="Duplicar (Ctrl+D)">${ui('dup')}</button>`;
  h += `<button class="ib" data-a="del" data-tip="Eliminar (Supr)">${ui('trash')}</button>`;
  ctx.innerHTML = h; ctx.classList.add('on'); placeCtx();
}
function placeCtx() {
  const ctx = $('ctx'); if (!ctx.classList.contains('on')) return; const b = boundsOf([...sel].filter(i => byId(i)?.type !== 'link')) || boundsOf([byId([...sel][0])?.from, byId([...sel][0])?.to]); if (!b) return;
  const x = cam.x + (b.x + b.w / 2) * cam.s, y1 = cam.y + b.y * cam.s, y2 = cam.y + (b.y + b.h) * cam.s, w = ctx.offsetWidth, h = ctx.offsetHeight;
  let top = y1 - h - 18; if (top < 70) top = y2 + 18; if (top > innerHeight - h - 70) top = Math.max(70, Math.min(innerHeight - h - 70, y1 + 18));
  ctx.style.left = clamp(x - w / 2, 10, innerWidth - w - 10) + 'px'; ctx.style.top = top + 'px';
}
function setSel(ids) { sel = new Set(ids); renderSel(); buildCtx(); mini(); }

/* ---------- Acciones sobre elementos ---------- */
function removeIds(ids) {
  const kill = new Set(ids); B.elements.forEach(e => { if (e.type === 'link' && (kill.has(e.from) || kill.has(e.to))) kill.add(e.id); });
  B.elements = B.elements.filter(e => !kill.has(e.id));
  B.steps.forEach(s => { if (s.show) s.show = s.show.filter(i => !kill.has(i)); if (s.focus) s.focus = s.focus.filter(i => !kill.has(i)); if (s.play && kill.has(s.play)) delete s.play; });
  sel = new Set([...sel].filter(i => !kill.has(i)));
}
function cloneEls(list, dx, dy) {
  const map = {}, out = [];
  for (const e of list) { if (e.type === 'link') continue; const c = structuredClone(e); c.id = uid(e.type); map[e.id] = c.id; c.x = Math.round((c.x || 0) + dx); c.y = Math.round((c.y || 0) + dy); out.push(c); }
  for (const e of list) if (e.type === 'link' && map[e.from] && map[e.to]) out.push({...structuredClone(e), id: uid('link'), from: map[e.from], to: map[e.to]});
  return out;
}
function selectedWithLinks() { const ids = new Set(sel); return B.elements.filter(e => ids.has(e.id) || (e.type === 'link' && ids.has(e.from) && ids.has(e.to))); }
function duplicate() { if (!sel.size) return; const out = cloneEls(selectedWithLinks(), 60, 60); mutate(() => B.elements.push(...out)); setSel(out.filter(e => e.type !== 'link').map(e => e.id)); }
async function ctxAction(a) {
  const els = [...sel].map(byId).filter(Boolean), e0 = els[0];
  if (a === 'del') { mutate(() => removeIds([...sel])); setSel([]); }
  else if (a === 'dup') duplicate();
  else if (a === 'front' || a === 'back') mutate(() => { const ids = new Set(sel), moving = B.elements.filter(e => ids.has(e.id)), rest = B.elements.filter(e => !ids.has(e.id)); B.elements = a === 'front' ? [...rest, ...moving] : [...moving, ...rest]; });
  else if (a === 'bigger' || a === 'smaller') mutate(() => els.forEach(e => { const base = e.size || (e.type === 'sticky' ? 40 : 56); e.size = Math.max(10, Math.round(base * (a === 'bigger' ? 1.2 : 1 / 1.2))); }));
  else if (a === 'head') mutate(() => { e0.arrow = !e0.arrow; });
  else if (a === 'loop') mutate(() => { e0.loop = !e0.loop; });
  else if (a === 'label') editLinkLabel(e0);
  else if (a === 'caption') { const v = await ask({title: 'Texto sobre el medio', fields: [{name: 'v', label: 'Texto (vacío para quitarlo)', value: e0.caption || ''}]}); if (v) mutate(() => { if (v.v.trim()) e0.caption = v.v.trim(); else delete e0.caption; }); }
  else if (a === 'url') { const v = await ask({title: 'Enlace', text: 'Aparece en el recuadro al hacer clic en este elemento.', fields: [{name: 'v', label: 'Dirección (vacío para quitarlo)', value: e0.url || '', placeholder: 'https://'}]}); if (v) mutate(() => els.forEach(e => { if (/^https?:\/\//.test(v.v.trim())) e.url = v.v.trim(); else delete e.url; })); }
  else if (a === 'icon') openIconPicker(e0);
  buildCtx();
}
async function editLinkLabel(e) { const v = await ask({title: 'Texto de la flecha', fields: [{name: 'v', label: 'Texto', value: e.label || '', placeholder: 'por ejemplo: usa'}]}); if (v) mutate(() => { e.label = v.v.trim(); }); }
function openIconPicker(e) {
  const p = $('picker'), logos = Object.keys(catalog.logos);
  p.innerHTML = `<h6>Logos oficiales</h6><div class="pg">${logos.map(l => `<button data-logo="${l}" title="${l}">${logoHtml(l)}</button>`).join('')}</div><h6>Íconos</h6><div class="pg"><button data-icon=""><span class="none">Nada</span></button>${Object.keys(ICONS).map(i => `<button data-icon="${i}" title="${i}">${iconSvg(i, e.iconColor || '#FF6B35')}</button>`).join('')}</div>`;
  const c = $('ctx').getBoundingClientRect(); p.style.left = clamp(c.left, 10, innerWidth - 350) + 'px'; p.style.top = (c.bottom + 8 + 360 > innerHeight ? Math.max(10, c.top - 368) : c.bottom + 8) + 'px'; p.classList.add('on');
  p.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; mutate(() => { if (b.dataset.logo !== undefined) { e.logo = b.dataset.logo; } else { delete e.logo; if (b.dataset.icon) e.icon = b.dataset.icon; else delete e.icon; } }); p.classList.remove('on'); };
}
function openMediaMenu() {
  const p = $('picker'), t = document.querySelector('[data-tool="media"]').getBoundingClientRect();
  p.innerHTML = `<button class="btn" style="width:100%;margin-bottom:8px" data-m="file">${ui('image')}Subir imagen o video de tu compu</button><button class="btn" style="width:100%" data-m="yt">${ui('playp')}Video de YouTube</button><p style="font:600 12px/1.45 Arial;color:#a1a1aa;margin:10px 2px 0">También podés arrastrar archivos a la pizarra o pegarlos con Ctrl+V.</p>`;
  p.style.left = clamp(t.left - 150, 10, innerWidth - 350) + 'px'; p.style.top = t.bottom + 10 + 'px'; p.classList.add('on');
  p.onclick = async ev => { const b = ev.target.closest('[data-m]'); if (!b) return; p.classList.remove('on'); setTool('select');
    if (b.dataset.m === 'file') $('filePick').click();
    else { const v = await ask({title: 'Video de YouTube', fields: [{name: 'v', label: 'Enlace', placeholder: 'https://www.youtube.com/watch?v=…'}]}); if (v) addYouTube(v.v, centerWorld()) || toast('Ese enlace no parece de YouTube'); } };
}
const centerWorld = () => toWorld(innerWidth / 2, innerHeight / 2);
function addYouTube(url, at) {
  const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/); if (!m) return false;
  const vert = /shorts\//.test(url), w = vert ? 540 : 1280, h = vert ? 960 : 720, e = {id: uid('youtube'), type: 'youtube', vid: m[1], x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2), w, h};
  mutate(() => B.elements.push(e)); setSel([e.id]); return true;
}
function mediaSize(type, src) {
  return new Promise(res => {
    if (type === 'image') { const im = new Image(); im.onload = () => res({w: im.naturalWidth, h: im.naturalHeight}); im.onerror = () => res({w: 1600, h: 900}); im.src = src; }
    else { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res({w: v.videoWidth || 1600, h: v.videoHeight || 900}); v.onerror = () => res({w: 1600, h: 900}); v.src = src; }
  });
}
async function uploadFiles(files, at) {
  const added = [];
  for (const [i, f] of [...files].entries()) {
    const type = f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : null; if (!type) { toast(`«${f.name}» no es imagen ni video`); continue; }
    toast(`Subiendo ${f.name || 'imagen'}…`);
    try {
      const r = await fetch(`/api/boards/${id}/media?name=${encodeURIComponent(f.name || 'pegado.png')}`, {method: 'POST', body: f}), d = await r.json();
      if (!r.ok) { toast(d.error || 'No se pudo subir'); continue; }
      const dims = await mediaSize(type, mediaSrc(d.src)), w = Math.round(Math.min(dims.w, clamp(640 / cam.s, 400, 2400))), h = Math.round(w * dims.h / dims.w);
      const e = {id: uid(type), type, src: d.src, x: Math.round(at.x - w / 2 + i * 50), y: Math.round(at.y - h / 2 + i * 50), w, h};
      mutate(() => B.elements.push(e)); added.push(e.id);
    } catch (err) { toast('No se pudo subir: ' + err.message); }
  }
  if (added.length) { setSel(added); toast(added.length === 1 ? 'Listo, quedó en la pizarra' : `Listo: ${added.length} archivos`); }
}

/* ---------- Crear elementos ---------- */
function create(kind, p) {
  let e;
  if (kind === 'sticky') { const w = Math.round(clamp(230 / cam.s, 240, 1600)); e = {type: 'sticky', w, h: w, color: lastSticky, text: '', size: Math.round(w * .095)}; }
  if (kind === 'card') e = {type: 'card', w: 640, icon: 'star', title: 'Título', what: 'Para qué sirve', body: [{t: 'p', html: 'Un ejemplo concreto.'}]};
  if (kind === 'frame') { const w = Math.round(clamp(900 / cam.s, 800, 6000)); e = {type: 'frame', w, h: Math.round(w * .62), label: 'NUEVA SECCIÓN'}; }
  e.id = uid(kind); e.x = Math.round(p.x - e.w / 2); e.y = Math.round(p.y - (e.h || 440) / 2);
  mutate(() => B.elements.push(e)); justCreated = e.id; setTool('select'); setSel([e.id]);
  const n = nodes.get(e.id).node; startEdit(kind === 'sticky' ? n : n.querySelector(kind === 'card' ? '[data-f="title"]' : '[data-f="label"]'), e.id, kind !== 'sticky');
}
let lastSticky = STICKY[0][0];
function createText(p) {
  const e = {id: uid('text'), type: 'text', x: Math.round(p.x), y: Math.round(p.y - 34 / cam.s), size: Math.round(clamp(44 / cam.s, 24, 600)), color: color === '#ffffff' || COLORS.some(c => c[0] === color) ? color : '#ffffff', text: ''};
  mutate(() => B.elements.push(e)); justCreated = e.id; setSel([e.id]); startEdit(nodes.get(e.id).node, e.id);
}

/* ---------- Edición de textos en el lugar ---------- */
function startEdit(field, eid, selectAll = false) {
  if (!field) return; endEdit(); editing = {node: field, eid, field: field.dataset.f};
  field.contentEditable = 'true'; field.focus(); hideCard();
  const r = document.createRange(); r.selectNodeContents(field); if (!selectAll) r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  renderSel();
}
function endEdit() {
  if (!editing) return; const {node, eid, field} = editing; editing = null; node.contentEditable = 'false'; getSelection().removeAllRanges();
  const e = byId(eid); if (!e) return;
  const val = field.endsWith('html') ? clean(node.innerHTML) : node.innerText.replace(/\n+$/, '');
  if (e.type === 'text' && !val.trim()) {
    if (justCreated === eid) { undoStack.pop(); B.elements = B.elements.filter(x => x.id !== eid); sel.delete(eid); renderAll(); scheduleSave(); }
    else mutate(() => removeIds([eid]));
  } else if (val !== (getPath(e, field) ?? '')) { if (justCreated === eid) { setPath(e, field, val); renderAll(); scheduleSave(); } else mutate(() => setPath(e, field, val)); }
  else renderSel();
  justCreated = null; buildCtx();
  if (pendingExternal) { const p = pendingExternal; pendingExternal = null; external(id, p); }
}
function primaryField(e) { const n = nodes.get(e.id)?.node; if (!n) return null; if (e.type === 'sticky' || e.type === 'text') return n; return n.querySelector('[data-f]'); }

/* ---------- Dibujo de la sesión (presentación) ---------- */
function newSessionText(p) {
  const t = document.createElement('div'); t.className = 'txt'; Object.assign(t.style, {left: p.x + 'px', top: p.y - 30 / cam.s + 'px', fontSize: 44 / cam.s + 'px', color});
  $('stexts').appendChild(t); sessionHist.push({type: 'add', g: t, parent: $('stexts')}); editSession(t);
}
function editSession(t) { t.contentEditable = 'true'; t.focus(); const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
function clearSession() { $('sink').innerHTML = ''; $('stexts').innerHTML = ''; sessionHist = []; }
function eraseAt(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return;
  const sg = el.closest('#sink g') || el.closest('#stexts .txt'); if (sg) { sessionHist.push({type: 'del', g: sg, parent: sg.parentNode}); sg.remove(); return; }
  if (mode !== 'edit') return;
  const n = el.closest('[data-id]'), e = n && byId(n.dataset.id); if (e && (e.type === 'ink' || e.type === 'text')) mutate(() => removeIds([e.id]));
}

/* ---------- Puntero ---------- */
function onDown(ev) {
  if (ev.target.closest('a')) return;
  $('picker').classList.remove('on');
  if (editing) { if (ev.target.closest('[contenteditable="true"]')) return; endEdit(); }
  if (ev.target.closest('#stexts [contenteditable="true"]')) return;
  const p = toWorld(ev.clientX, ev.clientY);
  downAt = (tool === 'select' || tool === 'move') && ev.button === 0 && !spaceDown ? {x: ev.clientX, y: ev.clientY, t: ev.target} : null;
  if (ev.button === 1 || (ev.button === 0 && spaceDown)) { ev.preventDefault(); return startPan(ev); }
  if (ev.button !== 0) return;
  const elNode = ev.target.closest('[data-id]'), eid = elNode && elNode.dataset.id, stx = ev.target.closest('#stexts .txt');
  if (tool === 'pen' || tool === 'marker') return startStroke(p);
  if (tool === 'erase') { act = {type: 'erase'}; return eraseAt(ev.clientX, ev.clientY); }
  if (tool === 'laser') return;
  if (tool === 'text') {
    ev.preventDefault();
    if (mode === 'present') return stx ? editSession(stx) : newSessionText(p);
    const e = eid && byId(eid); if (e && e.type === 'text') { setSel([eid]); return startEdit(nodes.get(eid).node, eid); }
    return createText(p);
  }
  if (tool === 'sticky' || tool === 'card' || tool === 'frame') { ev.preventDefault(); return create(tool, p); }
  if (tool === 'arrow') { if (eid && byId(eid) && !['link', 'ink'].includes(byId(eid).type)) { act = {type: 'link', from: eid}; $('rubber').style.display = 'block'; } return; }
  if (mode === 'present') {
    if (stx) { act = {type: 'sdrag', t: stx, sx: ev.clientX, sy: ev.clientY, l: parseFloat(stx.style.left), tp: parseFloat(stx.style.top)}; return; }
    if (ev.target.closest('video, iframe')) return;
    return startPan(ev);
  }
  if (ev.target.classList.contains('handle')) return startResize(ev);
  if (eid && byId(eid)) {
    const e = byId(eid);
    if (ev.shiftKey) { sel.has(eid) ? sel.delete(eid) : sel.add(eid); return setSel([...sel]); }
    if (!sel.has(eid)) setSel([eid]);
    else if ((e.type === 'video' || e.type === 'youtube') && ev.target.closest('video, iframe')) return;
    return startMove(ev);
  }
  if (ev.shiftKey) { act = {type: 'marquee', sx: ev.clientX, sy: ev.clientY}; return; }
  if (sel.size) setSel([]);
  startPan(ev);
}
function startPan(ev) { act = {type: 'pan', sx: ev.clientX, sy: ev.clientY, cx: cam.x, cy: cam.y}; view.classList.add('pan'); }
function startMove(ev) {
  const ids = [...sel].filter(i => byId(i) && byId(i).type !== 'link');
  for (const i of [...ids]) { const f = byId(i); if (f.type !== 'frame') continue;
    for (const o of B.elements) { if (o.type === 'link' || o.type === 'frame' || ids.includes(o.id)) continue; const r = rectOf(o.id); if (r && r.x >= f.x && r.y >= f.y && r.x + r.w <= f.x + f.w && r.y + r.h <= f.y + f.h) ids.push(o.id); } }
  act = {type: 'move', sx: ev.clientX, sy: ev.clientY, orig: ids.map(i => { const e = byId(i); return [e, e.x || 0, e.y || 0]; }), moved: false, snap: snapshot()};
}
function startResize(ev) {
  const e = byId([...sel][0]), r = rectOf(e.id);
  act = {type: 'resize', e, sx: ev.clientX, sy: ev.clientY, w0: r.w, h0: r.h, size0: e.size || 56, snap: snapshot(), moved: false};
}
function startStroke(p) {
  const temp = tool === 'marker', session = temp || mode === 'present', w = r1((temp ? 12 : 7) / cam.s), c = color;
  const g = document.createElementNS(NS, 'g'); g.innerHTML = `<path class="hit" stroke-width="${r1(36 / cam.s)}"/><path stroke="${c}" stroke-width="${w}" style="filter:drop-shadow(0 0 ${r1(6 / cam.s)}px ${c}aa)"/>`;
  (session ? $('sink') : $('ink')).appendChild(g);
  act = {type: 'stroke', g, d: `M${r1(p.x)} ${r1(p.y)}`, lx: p.x, ly: p.y, temp, session, c, w};
  g.querySelectorAll('path').forEach(q => q.setAttribute('d', act.d + ' l0.1 0'));
}
function onMove(ev) {
  const l = $('laser'); l.style.left = ev.clientX + 'px'; l.style.top = ev.clientY + 'px';
  if (!act) return;
  if (act.type === 'pan') { cam.x = act.cx + ev.clientX - act.sx; cam.y = act.cy + ev.clientY - act.sy; return apply(false); }
  if (act.type === 'stroke') { const p = toWorld(ev.clientX, ev.clientY); if (Math.hypot(p.x - act.lx, p.y - act.ly) < 2 / cam.s) return; act.lx = p.x; act.ly = p.y; act.d += ` L${r1(p.x)} ${r1(p.y)}`; act.g.querySelectorAll('path').forEach(q => q.setAttribute('d', act.d)); return; }
  if (act.type === 'erase') return eraseAt(ev.clientX, ev.clientY);
  if (act.type === 'sdrag') { act.t.style.left = act.l + (ev.clientX - act.sx) / cam.s + 'px'; act.t.style.top = act.tp + (ev.clientY - act.sy) / cam.s + 'px'; return; }
  if (act.type === 'move') {
    const dx = (ev.clientX - act.sx) / cam.s, dy = (ev.clientY - act.sy) / cam.s; if (!act.moved && Math.hypot(ev.clientX - act.sx, ev.clientY - act.sy) < 4) return;
    if (!act.moved) { act.moved = true; hideCard(); $('ctx').classList.remove('on'); }
    for (const [e, x, y] of act.orig) { e.x = Math.round(x + dx); e.y = Math.round(y + dy);
      if (e.type === 'ink') $('ink').querySelector(`[data-id="${e.id}"]`)?.setAttribute('transform', `translate(${e.x} ${e.y})`); else { const n = nodes.get(e.id)?.node; if (n) geom(n, e); } }
    renderLinks(); renderSel(); return;
  }
  if (act.type === 'resize') {
    const {e} = act, dw = (ev.clientX - act.sx) / cam.s, dh = (ev.clientY - act.sy) / cam.s; act.moved = true;
    if (e.type === 'text') e.size = Math.max(10, Math.round(act.size0 * (act.w0 + dw) / act.w0));
    else if (['image', 'video', 'youtube'].includes(e.type) && !ev.shiftKey) { e.w = Math.max(120, Math.round(act.w0 + dw)); e.h = Math.round(e.w * act.h0 / act.w0); }
    else { e.w = Math.max(e.type === 'card' ? 320 : 120, Math.round(act.w0 + dw)); e.h = Math.max(e.type === 'card' ? 200 : 100, Math.round(act.h0 + dh)); }
    const n = nodes.get(e.id).node; if (e.type === 'text') n.style.fontSize = e.size + 'px'; geom(n, e); renderLinks(); renderSel(); return;
  }
  if (act.type === 'marquee') { const m = $('marquee'); Object.assign(m.style, {display: 'block', left: Math.min(act.sx, ev.clientX) + 'px', top: Math.min(act.sy, ev.clientY) + 'px', width: Math.abs(ev.clientX - act.sx) + 'px', height: Math.abs(ev.clientY - act.sy) + 'px'}); return; }
  if (act.type === 'link') { const r = rectOf(act.from), x1 = cam.x + (r.x + r.w / 2) * cam.s, y1 = cam.y + (r.y + r.h / 2) * cam.s; $('rubber').querySelector('path').setAttribute('d', `M${x1} ${y1} L${ev.clientX} ${ev.clientY}`); }
}
function onUp(ev) {
  if (!act) return; const a = act; act = null; view.classList.remove('pan');
  if (downAt && (a.type === 'pan' || a.type === 'move') && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 5) clickCard(downAt.t);
  downAt = null;
  if (a.type === 'stroke') {
    if (a.temp) { setTimeout(() => { a.g.classList.add('fade'); setTimeout(() => a.g.remove(), 950); }, 1400); }
    else if (a.session) sessionHist.push({type: 'add', g: a.g});
    else { a.g.remove(); mutate(() => B.elements.push({id: uid('ink'), type: 'ink', d: a.d, color: a.c, w: a.w})); }
  }
  else if (a.type === 'move' || a.type === 'resize') { if (a.moved) { pushUndo(a.snap); scheduleSave(); renderSel(); buildCtx(); mini(); } else if (a.type === 'move') buildCtx(); }
  else if (a.type === 'marquee') {
    $('marquee').style.display = 'none'; const p1 = toWorld(Math.min(a.sx, ev.clientX), Math.min(a.sy, ev.clientY)), p2 = toWorld(Math.max(a.sx, ev.clientX), Math.max(a.sy, ev.clientY));
    setSel(B.elements.filter(e => { const r = rectOf(e.id); return r && r.x < p2.x && r.x + r.w > p1.x && r.y < p2.y && r.y + r.h > p1.y; }).map(e => e.id));
  }
  else if (a.type === 'link') {
    $('rubber').style.display = 'none'; const n = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-id]'), to = n && n.dataset.id;
    if (to && to !== a.from && byId(to) && !['link', 'ink'].includes(byId(to).type)) { const e = {id: uid('link'), type: 'link', from: a.from, to, label: '', arrow: true}; mutate(() => B.elements.push(e)); setTool('select'); setSel([e.id]); editLinkLabel(e); }
  }
}
function onWheel(ev) {
  ev.preventDefault(); const pinch = ev.ctrlKey, mouse = ev.deltaMode !== 0 || (Math.abs(ev.deltaY) >= 50 && ev.deltaX === 0 && Number.isInteger(ev.deltaY));
  if (pinch || mouse) zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * (pinch ? .012 : .0018))); else { cam.x -= ev.deltaX; cam.y -= ev.deltaY; apply(false); }
}
function onDbl(ev) {
  if (tool !== 'select' && tool !== 'move') return;
  const n = ev.target.closest('[data-id]');
  if (mode === 'edit') {
    if (!n) return; const e = byId(n.dataset.id); if (!e) return;
    if (e.type === 'link') return editLinkLabel(e);
    const f = ev.target.closest('[data-f]'); if (f && n.contains(f)) { setSel([e.id]); return startEdit(f, e.id); }
    return fly(rectOf(e.id), 160);
  }
  const stx = ev.target.closest('#stexts .txt'); if (stx) return editSession(stx);
  const c = ev.target.closest('.el.node:not(.hid), .el.media:not(.hid), .el.sticky:not(.hid)'); fly(c ? rectOf(c.dataset.id) : contentBounds(), c ? 160 : 60);
}

/* ---------- Recuadro con tipos y enlaces: aparece al hacer clic ---------- */
let cardFor = null, cardTimer = null, hoverTimer = null;
const host = u => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
function showCard(target, elNode) {
  clearTimeout(cardTimer); const e = byId(elNode.dataset.id); if (!e) return hideCard(); cardFor = target;
  const appKey = target.dataset.app, app = appKey && catalog.apps[appKey], inf = target === elNode ? e.info : null, url = target === elNode ? e.url : null;
  if (!app && !inf && !url) return hideCard();
  const title = app ? app.name : (e.title || e.label || e.text || e.caption || 'Enlace'), link = app ? app.url : url;
  const groups = inf ? (inf.groups || []).map(g => Array.isArray(g) ? {title: g[0], items: g[1]} : g) : [];
  const c = $('card');
  c.innerHTML = `<div class="hd">${app && app.logo ? logoHtml(app.logo, {dark: true}) : ''}<div><b>${esc(title.split('\n')[0])}</b><small>${esc(app ? app.what : inf ? inf.sub : '')}</small>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(host(link))} ↗</a>` : ''}</div></div>` +
    groups.map(g => `<h5>${esc(g.title)}</h5>` + g.items.map(i => `<div class="it"><div><b>${i.logo && catalog.logos[i.logo] ? logoHtml(i.logo, {dark: true}) : ''}${esc(i.n)}</b><span>${esc(i.d)}</span></div>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(host(i.url))} ↗</a>` : ''}</div>`).join('')).join('');
  // Se ubica fuera de la tarjeta entera (no sobre sus subtarjetas): derecha, izquierda, abajo o arriba, donde entre.
  c.classList.add('on'); const r = elNode.getBoundingClientRect(), cw = c.offsetWidth, ch = c.offsetHeight, g = 16, W = innerWidth, H = innerHeight;
  const cy = clamp(r.top, 10, H - ch - 10), cx = clamp(r.left + r.width / 2 - cw / 2, 10, W - cw - 10);
  const spots = [[r.right + g, cy, r.right + g + cw <= W - 10], [r.left - g - cw, cy, r.left - g - cw >= 10], [cx, r.bottom + g, r.bottom + g + ch <= H - 10], [cx, r.top - g - ch, r.top - g - ch >= 10]];
  const [x, y] = spots.find(s => s[2]) || [clamp(r.right + g, 10, W - cw - 10), cy];
  c.style.left = x + 'px'; c.style.top = y + 'px';
}
function hideCard() { $('card').classList.remove('on'); cardFor = null; clearTimeout(hoverTimer); }
function hoverTarget(t) { const elNode = t.closest('.el:not(.hid)'); if (!elNode) return null; const app = t.closest('[data-app]'); return {target: app && elNode.contains(app) ? app : elNode, elNode}; }
function clickCard(t) { const h = hoverTarget(t); if (!h || h.target === cardFor) return hideCard(); showCard(h.target, h.elNode); }
let downAt = null;

/* ---------- Notas en otra ventana ---------- */
function syncNotes() {
  if (!notesWin || notesWin.closed || !B.steps.length) return; const s = B.steps[step], n = B.steps[step + 1];
  notesWin.document.body.innerHTML = `<div style="color:#888;font:600 22px Arial">Paso ${step + 1} de ${B.steps.length}</div>` + (s.clip ? `<div style="color:#FF6B35;font:900 26px Arial;margin-top:18px">● CLIP · aplaudí</div><div style="font:800 46px/1.3 Arial;margin:8px 0 18px">${esc(s.clip)}</div>` : '') + `<div style="font:700 40px/1.35 Arial;color:${s.clip ? '#bbb' : '#fff'};margin-top:18px">${esc(s.note || '')}</div>` + (n ? `<div style="margin-top:40px;color:#666;font:600 24px/1.4 Arial">Después: ${esc((n.clip || n.note || '').slice(0, 90))}…</div>` : '');
}

/* ---------- Panel de pasos (modo edición) ---------- */
function renderPanel() {
  if (!$('panel').classList.contains('on') || mode !== 'edit') return;
  const where = stepWhere(), list = $('stepList'), keep = document.activeElement && list.contains(document.activeElement); if (keep) return;
  list.innerHTML = B.steps.map((s, i) => `<div class="st${i === step ? ' cur' : ''}" data-i="${i}">
    <div class="sh"><b data-a="go" title="Ver este paso">${i + 1}. ${esc(where[i])} <em>${s.cover ? '· portada' : s.overview ? '· mapa completo' : ''}</em></b>
      <button class="ib" data-a="up" data-tip="Subir">${ui('prev').replace('<svg', '<svg style="transform:rotate(90deg)"')}</button><button class="ib" data-a="down" data-tip="Bajar">${ui('next').replace('<svg', '<svg style="transform:rotate(90deg)"')}</button><button class="ib" data-a="del" data-tip="Quitar paso">${ui('trash')}</button></div>
    ${(s.show || []).length ? `<div class="chipsel">${s.show.map(x => `<span class="${(s.focus || []).includes(x) ? 'f' : ''}" data-x="${esc(x)}" title="Seleccionarlo en la pizarra">${esc(nameOf(x))}</span>`).join('')}</div>` : ''}
    <textarea data-k="note" rows="3" placeholder="Qué decís en este paso">${esc(s.note || '')}</textarea>
    <input data-k="clip" placeholder="Frase de [CLIP] (opcional)" value="${esc(s.clip || '')}">
    ${s.cover || s.overview ? '' : '<button class="use" data-a="use">Usar lo seleccionado en la pizarra</button>'}</div>`).join('') || '<p style="color:#a1a1aa;font:600 13px/1.5 Arial;padding:6px">Todavía no hay pasos. Seleccioná tarjetas en la pizarra y tocá «Paso con lo seleccionado». En modo Presentar aparecen de a una.</p>';
  $('stepAdd').innerHTML = `<button class="btn primary" data-a="addSel">+ Paso con lo seleccionado</button><button class="btn" data-a="addCover">+ Portada</button><button class="btn" data-a="addAll">+ Mapa completo</button>`;
  const cur = list.querySelector('.st.cur'); if (cur) cur.scrollIntoView({block: 'nearest'});
}
function panelClick(ev) {
  const a = ev.target.closest('[data-a]')?.dataset.a, chip = ev.target.closest('[data-x]'), st = ev.target.closest('.st'), i = st ? Number(st.dataset.i) : -1;
  if (chip) { setSel([chip.dataset.x]); return fly(rectOf(chip.dataset.x), 200); }
  if (!a) return; const nonFF = () => [...sel].filter(x => !['frame', 'link'].includes(byId(x)?.type));
  if (a === 'go') { step = i; const s = B.steps[i]; renderPanel(); if (s.cover || s.overview) { setSel([]); fly(contentBounds(), 60); } else { setSel(s.focus && s.focus.length ? s.focus : s.show || []); fly(boundsOf(s.focus && s.focus.length ? s.focus : s.show), 160); } return; }
  if (a === 'up' && i > 0) mutate(() => { [B.steps[i - 1], B.steps[i]] = [B.steps[i], B.steps[i - 1]]; step = i - 1; });
  if (a === 'down' && i < B.steps.length - 1) mutate(() => { [B.steps[i + 1], B.steps[i]] = [B.steps[i], B.steps[i + 1]]; step = i + 1; });
  if (a === 'del') mutate(() => { B.steps.splice(i, 1); step = clamp(step, 0, Math.max(0, B.steps.length - 1)); });
  if (a === 'use') { if (!sel.size) return toast('Primero seleccioná algo en la pizarra'); mutate(() => { B.steps[i].show = [...sel]; B.steps[i].focus = nonFF(); }); }
  const at = B.steps.length ? step + 1 : 0;
  if (a === 'addSel') { if (!sel.size) return toast('Seleccioná en la pizarra lo que aparece en este paso (Shift+clic para varios)'); mutate(() => { B.steps.splice(at, 0, {show: [...sel], focus: nonFF(), note: ''}); step = at; }); }
  if (a === 'addCover') mutate(() => { B.steps.splice(0, 0, {cover: true, note: ''}); step = 0; });
  if (a === 'addAll') mutate(() => { B.steps.push({overview: true, note: ''}); step = B.steps.length - 1; });
}
let panelSnap = null;

/* ---------- Herramientas y modos ---------- */
function setTool(t) {
  tool = t; document.body.className = document.body.className.replace(/\bt-\w+/g, '').trim() + ' t-' + t;
  document.querySelectorAll('#tools [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  document.querySelectorAll('#tools .col').forEach(b => b.hidden = mode === 'edit' && !['pen', 'marker', 'text'].includes(t));
  document.querySelectorAll('#tools hr.chr').forEach(b => b.hidden = mode === 'edit' && !['pen', 'marker', 'text'].includes(t));
  hideCard(); if (t !== 'select' && t !== 'move') { if (sel.size && t !== 'media') setSel([]); }
  $('hint').textContent = mode === 'edit'
    ? ({select: 'Arrastrá el fondo para moverte · rueda para zoom · clic en una tarjeta para ver sus enlaces · doble clic para escribir · Shift+arrastrar para elegir varios · soltá imágenes o videos acá', pen: 'Dibujá: queda guardado en la pizarra', marker: 'Marcá algo: se borra solo en un segundo', text: 'Clic donde quieras escribir', sticky: 'Clic para pegar una nota', card: 'Clic para crear una tarjeta', frame: 'Clic para crear una sección', arrow: 'Arrastrá desde una cosa hasta otra', erase: 'Pasá por encima de un trazo o un texto', laser: 'Puntero para señalar'})[t] || ''
    : 'Arrastrá para moverte · rueda o pellizco para zoom · doble clic en una tarjeta para acercarte · clic en una tarjeta para ver opciones y enlaces';
  const h = $('hint'); h.style.opacity = ''; clearTimeout(hintT); hintT = setTimeout(() => { h.style.opacity = '0'; }, 7000);
}
let hintT = null;
function buildTools() {
  const acts = mode === 'edit'
    ? [['undo', 'Deshacer (Ctrl+Z)'], ['redo', 'Rehacer (Ctrl+Shift+Z)'], '|', ['zout', 'Alejar (−)'], ['zin', 'Acercar (+)'], ['fit', 'Ver todo (O)'], '|', ['steps', 'Pasos de la presentación'], ['full', 'Pantalla completa (F)']]
    : [['undo', 'Deshacer dibujo (Ctrl+Z)'], ['clear', 'Borrar los dibujos (C)'], '|', ['zin', 'Acercar (+)'], ['zout', 'Alejar (−)'], ['fit', 'Ver el mapa entero (O)'], ['all', 'Mostrar todas las tarjetas (A)'], '|', ['notes', 'Notas en otra ventana (N)'], ['clean', 'Ocultar los controles (H)'], ['full', 'Pantalla completa (F)']];
  $('tools').innerHTML = TOOLS[mode].map(([k, t]) => `<button class="ib" data-tool="${k}" data-tip="${t}">${ui(k)}</button>`).join('') + '<hr class="chr">' +
    COLORS.map(([c, t]) => `<button class="ib col${c === color ? ' on' : ''}" data-color="${c}" data-tip="${t}"><span class="sw" style="background:${c}"></span></button>`).join('') + '<hr>' +
    acts.map(a => a === '|' ? '<hr>' : `<button class="ib${a[0] === 'steps' && $('panel').classList.contains('on') ? ' on' : ''}${a[0] === 'all' && everything ? ' on' : ''}" data-act="${a[0]}" data-tip="${a[1]}">${ui(a[0])}</button>`).join('');
  setTool(tool);
}
function setMode(m) {
  endEdit(); mode = m; try { localStorage.setItem('pizarra-mode', m); } catch {}
  document.body.classList.toggle('m-edit', m === 'edit'); document.body.classList.toggle('m-present', m === 'present'); document.body.classList.remove('clean');
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  sel.clear(); $('ctx').classList.remove('on'); $('picker').classList.remove('on'); everything = false; clearSession();
  tool = m === 'edit' ? 'select' : 'move'; buildTools(); renderDots();
  if (m === 'present') { if (B.steps.length) setStep(step); else { applyVis(); fly(contentBounds(), 60); } }
  else { applyVis(); renderPanel(); }
  renderSel();
}
const ACT = {
  undo, redo, prev: () => go(-1), next: () => go(1),
  zin: () => (zoomAt(innerWidth / 2, innerHeight / 2, 1.3, true)), zout: () => (zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.3, true)), fit: () => fly(contentBounds(), 60),
  all: () => { everything = !everything; document.querySelector('[data-act="all"]')?.classList.toggle('on', everything); applyVis(); renderLinks(); },
  clean: () => document.body.classList.toggle('clean'),
  full: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(),
  clear: () => { if (mode === 'present') return clearSession(); const ink = B.elements.filter(e => e.type === 'ink'); if (!ink.length) return; mutate(() => removeIds(ink.map(e => e.id))); toast('Dibujos borrados · Ctrl+Z para deshacer'); },
  steps: () => { $('panel').classList.toggle('on'); document.querySelector('[data-act="steps"]')?.classList.toggle('on', $('panel').classList.contains('on')); renderPanel(); },
  notes: () => { notesWin = open('', 'notas-pizarra', 'width=760,height=640'); if (notesWin) { notesWin.document.title = 'Notas · ' + B.title; notesWin.document.body.style.cssText = 'margin:0;padding:36px;background:#000;color:#fff'; syncNotes(); } }
};

/* ---------- Teclado y portapapeles ---------- */
function onKey(ev) {
  if (!B || $('board').hidden || !$('modal').hidden) return;
  const k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
  if (editing) {
    if (k === 'escape' || (k === 'enter' && !ev.shiftKey && (byId(editing.eid)?.type !== 'sticky' || mod))) { ev.preventDefault(); endEdit(); }
    return;
  }
  if (ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]')) { if (ev.target.closest('#stexts') && (k === 'escape' || (k === 'enter' && !ev.shiftKey))) { ev.preventDefault(); ev.target.blur(); } return; }
  if (mod && k === 'z') { ev.preventDefault(); return ev.shiftKey ? redo() : undo(); }
  if (mod && k === 'y') { ev.preventDefault(); return redo(); }
  if (mode === 'edit') {
    if (mod && k === 'c') { if (sel.size) { const data = selectedWithLinks(); clipboard = data; try { navigator.clipboard.writeText('PIZARRA-BZ:' + JSON.stringify(data)); } catch {} toast(`Copiado: ${sel.size}`); } return; }
    if (mod && k === 'd') { ev.preventDefault(); return duplicate(); }
    if (mod && k === 'a') { ev.preventDefault(); return setSel(B.elements.filter(e => e.type !== 'link').map(e => e.id)); }
    if ((k === 'delete' || k === 'backspace') && sel.size) { ev.preventDefault(); mutate(() => removeIds([...sel])); return setSel([]); }
    if (k.startsWith('arrow') && sel.size) { ev.preventDefault(); const d = ev.shiftKey ? 50 : 5, dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0; return mutate(() => [...sel].map(byId).forEach(e => { if (e && e.type !== 'link') { e.x = (e.x || 0) + dx; e.y = (e.y || 0) + dy; } })); }
    if (k === ' ') { ev.preventDefault(); spaceDown = true; view.style.cursor = 'grab'; return; }
    if (k === 'enter' && sel.size === 1) { const e = byId([...sel][0]); if (e.type === 'link') return editLinkLabel(e); const f = primaryField(e); if (f) { ev.preventDefault(); return startEdit(f, e.id); } }
  } else {
    if (['arrowright', ' ', 'pagedown', 'enter'].includes(k)) { ev.preventDefault(); return go(1); }
    if (['arrowleft', 'pageup'].includes(k)) { ev.preventDefault(); return go(-1); }
  }
  if (mod || ev.altKey) return;
  if (k === 'escape') { if ($('overlay').classList.contains('on') || $('cover').classList.contains('on')) return dismissOverlays(); if ($('card').classList.contains('on')) return hideCard(); if ($('picker').classList.contains('on')) return $('picker').classList.remove('on'); if (sel.size) return setSel([]); return setTool(mode === 'edit' ? 'select' : 'move'); }
  let t = KEYS[k]; if (t === 'select' && mode === 'present') t = 'move';
  if (t && TOOLS[mode].some(x => x[0] === t)) { if (t === 'media') return openMediaMenu(); return setTool(t); }
  if (k === '+' || k === '=') ACT.zin(); else if (k === '-') ACT.zout(); else if (k === 'o' || k === '0') ACT.fit();
  else if (k === 'a' && mode === 'present') ACT.all(); else if (k === 'c' && mode === 'present') ACT.clear();
  else if (k === 'h') ACT.clean(); else if (k === 'f') ACT.full(); else if (k === 'n' && mode === 'present') ACT.notes();
}
let clipboard = null;
async function onPaste(ev) {
  if (!B || $('board').hidden || !$('modal').hidden || mode !== 'edit') return;
  if (editing) { ev.preventDefault(); const t = ev.clipboardData.getData('text/plain'); document.execCommand('insertText', false, t); return; }
  if (ev.target.closest && ev.target.closest('input, textarea')) return;
  const at = lastPointer ? toWorld(lastPointer.x, lastPointer.y) : centerWorld();
  const files = [...ev.clipboardData.files]; if (files.length) { ev.preventDefault(); return uploadFiles(files, at); }
  const text = ev.clipboardData.getData('text/plain').trim(); if (!text) return; ev.preventDefault();
  if (text.startsWith('PIZARRA-BZ:') || (clipboard && !text)) {
    let data; try { data = JSON.parse(text.slice(11)); } catch { data = clipboard; } if (!data || !data.length) return;
    const b = data.filter(e => e.type !== 'link' && e.x != null), x0 = Math.min(...b.map(e => e.x)), y0 = Math.min(...b.map(e => e.y));
    const out = cloneEls(data, at.x - x0 - 100, at.y - y0 - 100); mutate(() => B.elements.push(...out)); return setSel(out.filter(e => e.type !== 'link').map(e => e.id));
  }
  if (addYouTube(text, at)) return;
  const e = {id: uid('text'), type: 'text', x: Math.round(at.x), y: Math.round(at.y), size: Math.round(clamp(40 / cam.s, 24, 600)), color: '#ffffff', text: text.slice(0, 2000)};
  mutate(() => B.elements.push(e)); setSel([e.id]);
}
let lastPointer = null;

/* ---------- Inicio, apertura y cambios desde el archivo ---------- */
function init() {
  inited = true; world = $('world'); view = $('view');
  view.addEventListener('pointerdown', onDown); addEventListener('pointermove', ev => { lastPointer = {x: ev.clientX, y: ev.clientY}; onMove(ev); }); addEventListener('pointerup', onUp);
  view.addEventListener('wheel', onWheel, {passive: false}); view.addEventListener('dblclick', onDbl);
  view.addEventListener('focusout', ev => { if (editing && ev.target === editing.node) setTimeout(() => { if (editing && document.activeElement !== editing.node) endEdit(); }, 0); if (ev.target.closest && ev.target.closest('#stexts .txt')) { const t = ev.target; t.contentEditable = 'false'; if (!t.textContent.trim()) t.remove(); } });
  addEventListener('keydown', onKey); addEventListener('keyup', ev => { if (ev.key === ' ') { spaceDown = false; view.style.cursor = ''; } });
  document.addEventListener('paste', onPaste);
  addEventListener('resize', () => { if (B) { apply(false); } });
  $('tools').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.tool) { if (b.dataset.tool === 'media') { setTool('media'); return openMediaMenu(); } return setTool(b.dataset.tool); }
    if (b.dataset.color) { color = b.dataset.color; document.querySelectorAll('#tools .col').forEach(x => x.classList.toggle('on', x === b)); if (!['pen', 'marker', 'text'].includes(tool)) setTool('pen'); return; }
    if (b.dataset.act) ACT[b.dataset.act]();
  });
  $('steps').querySelector('[data-act="prev"]').innerHTML = ui('prev'); $('steps').querySelector('[data-act="next"]').innerHTML = ui('next');
  $('steps').querySelectorAll('[data-act]').forEach(b => { b.classList.add('ib'); b.onclick = () => ACT[b.dataset.act](); });
  $('dots').addEventListener('click', ev => { const d = ev.target.closest('[data-i]'); if (d) setStep(Number(d.dataset.i)); });
  $('ctx').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.c) { const [k, v] = b.dataset.c.split(/:(.*)/); mutate(() => [...sel].map(byId).forEach(e => { if (v) e[k] = v; else delete e[k]; if (e.type === 'sticky' && k === 'color') lastSticky = v; })); return buildCtx(); }
    if (b.dataset.a) ctxAction(b.dataset.a); });
  $('overlay').addEventListener('click', dismissOverlays); $('cover').addEventListener('click', dismissOverlays);
  $('mini').addEventListener('pointerdown', ev => { const k = JSON.parse($('mini').dataset.k || 'null'); if (!k) return; const r = $('mini').getBoundingClientRect(), wx = k.bx + (ev.clientX - r.left - k.ox) / k.k, wy = k.by + (ev.clientY - r.top - k.oy) / k.k; cam.x = innerWidth / 2 - wx * cam.s; cam.y = innerHeight / 2 - wy * cam.s; apply(true); });
  $('zoomlvl').addEventListener('click', () => zoomAt(innerWidth / 2, innerHeight / 2, 1 / cam.s, true));
  $('modeSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-mode]'); if (b && b.dataset.mode !== mode) setMode(b.dataset.mode); });
  $('toHome').onclick = async () => { await flush(); location.hash = '#/'; };
  $('title').addEventListener('change', () => { const v = $('title').value.trim(); if (v && v !== B.title) mutate(() => { B.title = v; }); $('title').blur(); });
  $('title').addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { if (ev.key === 'Escape') $('title').value = B.title; $('title').blur(); } ev.stopPropagation(); });
  $('panel').addEventListener('click', panelClick); $('panelClose').onclick = ACT.steps;
  $('stepList').addEventListener('focusin', ev => { if (ev.target.dataset.k) panelSnap = snapshot(); });
  $('stepList').addEventListener('input', ev => { const k = ev.target.dataset.k; if (!k) return; const i = Number(ev.target.closest('.st').dataset.i); if (panelSnap) { pushUndo(panelSnap); panelSnap = null; } const v = ev.target.value; if (v.trim()) B.steps[i][k] = v; else delete B.steps[i][k]; scheduleSave(); syncNotes(); });
  $('filePick').addEventListener('change', ev => { const f = ev.target.files; if (f && f.length) uploadFiles(f, centerWorld()); ev.target.value = ''; });
  let dragDepth = 0; const hint = () => document.getElementById('dropHint');
  addEventListener('dragenter', ev => { if (!B || $('board').hidden || mode !== 'edit' || ![...ev.dataTransfer.types].includes('Files')) return; dragDepth++; if (!hint()) { const d = document.createElement('div'); d.id = 'dropHint'; d.textContent = 'Soltá para agregar a la pizarra'; document.body.appendChild(d); } });
  addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; hint()?.remove(); } });
  addEventListener('dragover', ev => { if (B && !$('board').hidden) ev.preventDefault(); });
  addEventListener('drop', ev => { ev.preventDefault(); dragDepth = 0; hint()?.remove(); if (!B || $('board').hidden || mode !== 'edit') return; const f = ev.dataTransfer.files; if (f && f.length) uploadFiles(f, toWorld(ev.clientX, ev.clientY)); else { const t = ev.dataTransfer.getData('text/plain'); if (t) addYouTube(t, toWorld(ev.clientX, ev.clientY)); } });
}

export async function open(bid) {
  if (!inited) init();
  if (id && id !== bid) await flush();
  if (id === bid && B) return;
  const [{data}, cat] = await Promise.all([api('/api/boards/' + bid), api('/api/catalog')]);
  catalog = cat.data; id = bid; B = normalize(data.board); rev = data.rev;
  undoStack = []; redoStack = []; sel = new Set(); step = 0; everything = false;
  for (const r of nodes.values()) { ro.unobserve(r.node); r.node.remove(); } nodes.clear(); clearSession(); setSave('Guardado');
  let m = 'edit'; try { m = localStorage.getItem('pizarra-mode') || 'edit'; } catch {}
  mode = m; document.body.classList.toggle('m-edit', m === 'edit'); document.body.classList.toggle('m-present', m === 'present');
  renderAll(); await document.fonts.ready; renderLinks();
  setMode(m); if (m === 'edit') fly(contentBounds(), 60, false);
}
export function close() { if (!id) return; flush(); id = null; B = null; for (const r of nodes.values()) r.node.remove(); nodes.clear(); $('links').innerHTML = ''; $('ink').innerHTML = ''; clearSession(); hideCard(); $('ctx').classList.remove('on'); $('panel').classList.remove('on'); }
export async function external(bid, newRev) {
  if (bid !== id || newRev === rev) return;
  if (editing || act) { pendingExternal = newRev; return; }
  const {data} = await api('/api/boards/' + bid); if (bid !== id) return;
  B = normalize(data.board); rev = data.rev; undoStack = []; redoStack = []; sel = new Set([...sel].filter(byId)); step = clamp(step, 0, Math.max(0, B.steps.length - 1));
  renderAll(); if (mode === 'present') applyVis(); toast('Actualizado desde el archivo');
}
