import { PLAYER_COLORS, PLAYER_NAMES } from './player.js';

const fmt = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};
export { fmt };

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.innerHTML = html;
  return e;
};

export class Hud {
  constructor() {
    const root = (this.root = document.getElementById('hud'));
    this.top = el('div', 'top');
    this.levelName = el('div', 'level-name');
    this.progress = el('div', 'progress');
    this.progressFill = el('div', 'fill');
    this.progressRaft = el('div', 'raft-marker', '🛶');
    this.progress.append(this.progressFill, this.progressRaft);
    this.timer = el('div', 'timer');
    this.top.append(this.levelName, this.progress, this.timer);
    root.append(this.top);

    this.cards = PLAYER_COLORS.map((c, i) => {
      const card = el('div', `card c${i}`);
      card.style.setProperty('--pc', c);
      card.innerHTML = `<div class="badge">${PLAYER_NAMES[i]}</div>
        <div class="info"><div class="tank"><div class="tank-fill"></div></div><div class="status"></div></div>`;
      root.append(card);
      return { card, fill: card.querySelector('.tank-fill'), status: card.querySelector('.status') };
    });

    this.center = el('div', 'center-msg');
    root.append(this.center);
    this.toast = el('div', 'toast');
    root.append(this.toast);

    this.title = el('div', 'panel title');
    this.title.innerHTML = `
      <div class="logo"><span>J</span><span>e</span><span>t</span>&nbsp;<span>R</span><span>a</span><span>f</span><span>t</span></div>
      <div class="sub">Co-op rafting down the magical sky rivers</div>
      <div class="select"><span class="arrow">◀</span><div class="lvl"><div class="lvl-num"></div><div class="lvl-name"></div><div class="lvl-best"></div></div><span class="arrow">▶</span></div>
      <div class="joined"></div>
      <div class="go"></div>
      <div class="spacer"></div>
      <div class="controls">
        <div><b>Left stick</b> walk</div><div><b>Right stick</b> aim</div>
        <div><b>RT</b> blast rear jet</div><div><b>LT</b> suck water (front pump)</div>
        <div><b>A</b> jump</div><div><b>START</b> join / leave</div>
      </div>
      <div class="kb">Keyboard: WASD walk · IJKL aim · E blast · Q suck · Space jump · Enter join · ←/→ level · Esc pause</div>`;
    root.append(this.title);

    this.pause = el('div', 'panel pause', `<div class="big">Paused</div><div>A / Space — resume<br>B / Backspace — back to title</div>`);
    root.append(this.pause);

    this.hint = el('div', 'hint');
    root.append(this.hint);
    this.msgT = 0; this.toastT = 0;
  }

  showCenter(html, dur = 1.5, cls = '') {
    this.center.innerHTML = html;
    this.center.className = 'center-msg show ' + cls;
    this.msgT = dur;
  }
  showToast(html, dur = 2) {
    this.toast.innerHTML = html;
    this.toast.classList.add('show');
    this.toastT = dur;
  }

  update(dt, g) {
    this.msgT -= dt;
    if (this.msgT <= 0 && this.center.classList.contains('show') && g.state !== 'win') this.center.classList.remove('show');
    this.toastT -= dt;
    if (this.toastT <= 0) this.toast.classList.remove('show');

    const r = g.river;
    const onTitle = g.state === 'title';
    this.title.classList.toggle('show', onTitle);
    this.top.classList.toggle('show', !onTitle);
    this.pause.classList.toggle('show', g.paused);

    if (onTitle) {
      this.title.querySelector('.lvl-num').textContent = `Level ${g.level}`;
      this.title.querySelector('.lvl-name').textContent = r.name;
      const best = g.bestTime(g.level);
      this.title.querySelector('.lvl-best').textContent = best ? `Best: ${fmt(best)}` : g.level > g.unlocked - 1 ? 'Not cleared yet' : '';
      const arrows = this.title.querySelectorAll('.arrow');
      arrows[0].classList.toggle('off', g.level <= 1);
      arrows[1].classList.toggle('off', g.level >= g.unlocked);
      this.title.querySelector('.joined').innerHTML = g.players.length
        ? `${g.players.length} player${g.players.length > 1 ? 's' : ''} aboard — more can press <b>START</b>`
        : `Press <b>START</b> (or <b>Enter</b>) to join`;
      this.title.querySelector('.go').innerHTML = g.players.length ? `Press <b>A</b> (or <b>Space</b>) to launch!` : '';
      this.title.querySelector('.go').classList.toggle('pulse', g.players.length > 0);
    } else {
      this.levelName.textContent = `Level ${g.level} · ${r.name}`;
      const s = Math.max(0, Math.min(1, (g.raft.info.s - r.startIndex) / (r.endS - r.startIndex)));
      this.progressFill.style.width = `${s * 100}%`;
      this.progressRaft.style.left = `${s * 100}%`;
      if (!this.ticks || this.ticksFor !== r) {
        this.progress.querySelectorAll('.tick').forEach((t) => t.remove());
        for (const c of r.checkpoints) {
          const t = el('div', 'tick');
          t.style.left = `${((c - r.startIndex) / (r.endS - r.startIndex)) * 100}%`;
          this.progress.append(t);
        }
        this.ticks = true; this.ticksFor = r;
      }
      this.timer.textContent = fmt(g.time);
    }

    for (let i = 0; i < 4; i++) {
      const c = this.cards[i];
      const p = g.players.find((q) => q.slot === i);
      c.card.classList.toggle('empty', !p);
      if (!p) { c.status.textContent = 'press START'; c.fill.style.width = '0%'; continue; }
      c.fill.style.width = `${p.tank * 100}%`;
      c.fill.classList.toggle('low', p.tank < 0.15);
      c.fill.classList.toggle('sipping', p.sipping);
      let st = '';
      if (p.state === 'respawn') st = '☁ falling…';
      else if (p.state === 'water') st = '🌊 swimming!';
      else if (p.sipping) st = '💧 slurp';
      else if (p.blast > 0.05) st = '💨 whoosh';
      else if (p.tank < 0.05) st = 'empty! suck at the edge';
      c.status.textContent = st;
    }

    let hint = '';
    if (g.level === 1 && (g.state === 'play' || g.state === 'countdown')) {
      hint = g.time < 15
        ? 'Face forward & hold <b>RT</b> to jet the raft · Stand at the edge, face the water & hold <b>LT</b> to refill'
        : g.time < 30 ? 'Blast your friends to push them around · Catch their spray with <b>LT</b> to chain water!' : '';
    }
    this.hint.innerHTML = hint;
    this.hint.classList.toggle('show', !!hint);
  }
}
