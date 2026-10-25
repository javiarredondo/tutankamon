// Panel de información histórica (cartela de museo). Separa visualmente
// los datos documentados, las interpretaciones y lo que está por verificar.
import { SOURCES, BADGES } from '../data/sources.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class InfoPanel {
  constructor(root, body, closeBtn) {
    this.root = root; this.body = body;
    this.currentId = null;
    this.onClose = null;
    closeBtn.addEventListener('click', () => this.hide());
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.root.hidden) this.hide(); });
  }

  show(item, actions = []) {
    this.currentId = item.id;
    const rows = [
      ['Materiales', item.materiales],
      ['Función', item.funcion],
      ['Significado simbólico', item.simbolismo],
      ['Contexto arqueológico', item.contexto],
      ['Dimensiones', item.dimensiones],
      ['Ubicación actual', item.ubicacion],
    ].filter(([, v]) => v);
    const extra = item.protege && item.protege !== '—' ? `<dd>Protege a: <strong>${esc(item.protege)}</strong></dd>` : '';
    this.body.innerHTML = `
      <span class="p-kicker">${esc(item.carter || 'Ajuar funerario · KV62')}</span>
      <h2 id="panel-title">${esc(item.nombre)}</h2>
      <span class="p-model">${esc(item.modelo)}</span>
      <p class="p-model-note">${esc(item.modeloNota)}</p>
      <div class="p-actions" id="panel-actions"></div>
      <dl>
        ${extra ? `<div><dt>En la secuencia</dt>${extra}</div>` : ''}
        ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}
      </dl>
      <p class="p-section">Datos históricos</p>
      <ul class="facts">
        ${(item.datos || []).map((d) => `<li class="fact"><span class="badge ${BADGES[d.t].cls}">${BADGES[d.t].label}</span><span>${esc(d.x)}</span></li>`).join('')}
      </ul>
      <p class="p-section">Fuentes</p>
      <ol class="sources">
        ${(item.fuentes || []).map((k) => SOURCES[k]).filter(Boolean).map((s) =>
          `<li>${esc(s.text)}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">Enlace</a>` : ''}</li>`).join('')}
      </ol>
      <div class="legend">
        <span><span class="badge doc">Documentado</span> consta en el registro de la excavación o en fuentes institucionales.</span>
        <span><span class="badge int">Interpretación</span> propuesta de especialistas; puede estar debatida.</span>
        <span><span class="badge ver">Por verificar</span> procede de fuentes secundarias o falta contrastarlo.</span>
      </div>`;
    const act = this.body.querySelector('#panel-actions');
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      b.addEventListener('click', a.run);
      act.appendChild(b);
    }
    this.root.hidden = false;
    document.body.classList.add('panel-open');
    this.body.scrollTop = 0;
  }

  hide() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    document.body.classList.remove('panel-open');
    this.currentId = null;
    this.onClose && this.onClose();
  }
}
