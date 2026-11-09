// Pizarras BZ: pantalla de proyectos, navegación, ventanas y avisos.
import {ui} from './icons.js';
import * as Board from './board.js';

const $ = id => document.getElementById(id);
export const api = async (url, opt = {}) => {
  const r = await fetch(url, {...opt, headers: opt.body && typeof opt.body === 'string' ? {'Content-Type': 'application/json'} : opt.headers});
  const data = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw new Error(data.error || r.statusText);
  return {status: r.status, data};
};

/* ---------- Avisos y ventanas ---------- */
let toastT = null;
export function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

// ask({title, text, fields: [{name, label, value, placeholder, options}], ok, danger}) → objeto con los valores o null
export function ask({title, text = '', fields = [], ok = 'Aceptar', danger = false}) {
  return new Promise(resolve => {
    const m = $('modal'), f = $('mForm'); $('mTitle').textContent = title; $('mText').textContent = text;
    $('mFields').innerHTML = fields.map((x, i) => `<label for="mf${i}">${x.label || ''}</label>` + (x.options
      ? `<select id="mf${i}" name="${x.name}">${x.options.map(o => `<option value="${o.value}"${o.value === x.value ? ' selected' : ''}>${o.label}</option>`).join('')}</select>`
      : `<input id="mf${i}" name="${x.name}" autocomplete="off" placeholder="${x.placeholder || ''}">`)).join('');
    fields.forEach((x, i) => { if (!x.options) $('mf' + i).value = x.value || ''; });
    $('mOk').textContent = ok; $('mOk').className = 'btn ' + (danger ? 'danger' : 'primary');
    m.hidden = false; setTimeout(() => (f.querySelector('input,select') || $('mOk')).focus(), 30);
    const done = v => { m.hidden = true; f.onsubmit = null; $('mCancel').onclick = null; m.onkeydown = null; resolve(v); };
    f.onsubmit = e => { e.preventDefault(); done(Object.fromEntries(new FormData(f))); };
    $('mCancel').onclick = () => done(null);
    m.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done(null); };
  });
}

/* ---------- Pantalla de proyectos ---------- */
const fmtDate = ms => { const d = new Date(ms), diff = (Date.now() - ms) / 1000;
  if (diff < 60) return 'hace un momento'; if (diff < 3600) return `hace ${Math.round(diff / 60)} min`; if (diff < 86400) return `hace ${Math.round(diff / 3600)} h`;
  return d.toLocaleDateString('es-AR', {day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined}); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function thumb(rects) {
  if (!rects.length) return '<svg viewBox="0 0 160 90"></svg>';
  const x0 = Math.min(...rects.map(r => r.x)), y0 = Math.min(...rects.map(r => r.y)), x1 = Math.max(...rects.map(r => r.x + r.w)), y1 = Math.max(...rects.map(r => r.y + r.h));
  const pad = Math.max(x1 - x0, y1 - y0) * .05, W = x1 - x0 + pad * 2, H = y1 - y0 + pad * 2, vb = W / H > 16 / 9 ? [W, W * 9 / 16] : [H * 16 / 9, H];
  const ox = x0 - pad - (vb[0] - W) / 2, oy = y0 - pad - (vb[1] - H) / 2, sw = vb[0] / 300;
  const fill = r => r.t === 'frame' ? 'none' : r.t === 'sticky' ? (r.c || '#FDE68A') : r.t === 'text' ? '#ffffff55' : r.t === 'card' ? '#2a2438' : '#3f3f46';
  return `<svg viewBox="${ox} ${oy} ${vb[0]} ${vb[1]}" preserveAspectRatio="xMidYMid meet">` + rects.sort((a, b) => (a.t === 'frame' ? -1 : 0) - (b.t === 'frame' ? -1 : 0)).map(r =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w, r.h) * .06}" fill="${fill(r)}" stroke="${r.t === 'frame' ? '#ffffff30' : r.t === 'card' ? '#a855f7' : 'none'}" stroke-width="${sw * (r.t === 'frame' ? 1.4 : 1.6)}" ${r.t === 'frame' ? `stroke-dasharray="${sw * 5} ${sw * 4}"` : ''}/>`).join('') + '</svg>';
}

async function loadHome() {
  const {data: list} = await api('/api/boards');
  $('grid').innerHTML = list.map(b => `<article class="pcard" tabindex="0" data-id="${b.id}">
      <div class="thumb">${thumb(b.rects)}</div>
      <div class="meta"><b>${esc(b.title)}</b>${b.subtitle ? `<span>${esc(b.subtitle)}</span>` : ''}<small>${fmtDate(b.updated)} · ${b.elements} elementos · ${b.steps} pasos</small></div>
      <div class="acts"><button data-a="dup" title="Duplicar">${ui('dup')}</button><button data-a="del" title="Mandar a la Papelera">${ui('trash')}</button></div>
    </article>`).join('') + `<article class="pcard new" tabindex="0" data-a="new"><div>${ui('plus')}Nueva pizarra</div></article>`;
  $('empty').hidden = list.length > 0;
  return list;
}
async function newBoard(from) {
  const {data: list} = await api('/api/boards');
  const v = await ask({title: 'Nueva pizarra', text: 'Por ejemplo, una por capítulo del curso.', ok: 'Crear', fields: [
    {name: 'title', label: 'Nombre', placeholder: 'Capítulo 2 · Instalamos todo', value: ''},
    {name: 'from', label: 'Empezar desde', value: from || '', options: [{value: '', label: 'Pizarra vacía'}, ...list.map(b => ({value: b.id, label: 'Copia de ' + b.title}))]}]});
  if (!v || !v.title.trim()) return;
  const {data} = await api('/api/boards', {method: 'POST', body: JSON.stringify({title: v.title.trim(), from: v.from || undefined})});
  location.hash = '#/p/' + data.id;
}
$('newBoard').onclick = () => newBoard();
$('grid').addEventListener('click', async e => {
  const c = e.target.closest('.pcard'); if (!c) return;
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'new') return newBoard();
  const id = c.dataset.id, title = c.querySelector('b').textContent;
  if (a === 'dup') return newBoard(id);
  if (a === 'del') {
    const ok = await ask({title: `¿Eliminar «${title}»?`, text: 'La carpeta del proyecto, con sus imágenes y videos, va a la Papelera de reciclaje de Windows. Desde ahí la podés restaurar.', ok: 'Mandar a la Papelera', danger: true});
    if (ok) { await api('/api/boards/' + id, {method: 'DELETE'}); toast('Enviada a la Papelera de reciclaje'); loadHome(); }
    return;
  }
  location.hash = '#/p/' + id;
});
$('grid').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('pcard')) e.target.click(); });

/* ---------- Navegación ---------- */
async function route() {
  const m = location.hash.match(/^#\/p\/([a-z0-9-]+)/);
  if (m) { $('home').hidden = true; $('board').hidden = false; try { await Board.open(m[1]); } catch (e) { toast('No se pudo abrir: ' + e.message); location.hash = '#/'; } }
  else { Board.close(); $('board').hidden = true; $('home').hidden = false; document.title = 'Pizarras BZ'; loadHome(); }
}
addEventListener('hashchange', route);

/* ---------- Recarga en vivo ---------- */
function events() {
  const es = new EventSource('/api/events');
  es.onmessage = e => { const msg = JSON.parse(e.data); if (msg.type === 'list' && !$('home').hidden) loadHome(); if (msg.type === 'board') Board.external(msg.id, msg.rev); };
  es.onerror = () => { es.close(); setTimeout(events, 2000); };
}
events();
route();
