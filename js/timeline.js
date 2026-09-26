// 时间线可视化：按元素实例分泳道，事件按 seq 顺序渲染
import { EVENT_TYPES } from './recorder.js';

const lanes = new Map(); // elId -> track element
let lanesEl, logEl, countEl;

export function initTimeline() {
  lanesEl = document.getElementById('lanes');
  logEl = document.getElementById('event-log');
  countEl = document.getElementById('event-count');
}

function laneFor(elId) {
  if (lanes.has(elId)) return lanes.get(elId);
  const lane = document.createElement('div');
  lane.className = 'lane';
  const label = document.createElement('div');
  label.className = 'lane-label';
  label.textContent = elId;
  label.title = elId;
  const track = document.createElement('div');
  track.className = 'lane-track';
  lane.append(label, track);
  lanesEl.appendChild(lane);
  lanes.set(elId, track);
  return track;
}

function fmtDetail(detail) {
  const parts = Object.entries(detail || {}).map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join('  ') : '';
}

export function addEventToTimeline(e) {
  const meta = EVENT_TYPES[e.type] || { label: e.type, color: '#999' };
  const track = laneFor(e.elId || '(全局)');

  const dot = document.createElement('div');
  dot.className = 'evt' + (e.remote ? ' remote' : '');
  dot.style.setProperty('--c', meta.color);
  dot.innerHTML = `<span class="seq">${e.seq}</span>`;
  dot.title = `#${e.seq} ${meta.label}\n${e.tag} ${e.elId}\n+${e.offset}ms\n${fmtDetail(e.detail)}${e.remote ? '\n(来自其他标签页)' : ''}`;
  track.appendChild(dot);
  track.scrollLeft = track.scrollWidth;

  const li = document.createElement('li');
  li.style.setProperty('--c', meta.color);
  li.innerHTML =
    `<span class="log-seq">#${e.seq}</span>` +
    `<span class="log-type">${meta.label}</span>` +
    `<span class="log-el">${e.elId || ''}</span>` +
    `<span class="log-detail">${fmtDetail(e.detail)}</span>` +
    `<span class="log-time">+${e.offset}ms${e.remote ? ' · 远程' : ''}</span>`;
  logEl.prepend(li);
  while (logEl.children.length > 300) logEl.lastChild.remove();

  countEl.textContent = String(Number(countEl.textContent) + 1);
}

export function resetTimeline() {
  lanes.clear();
  lanesEl.innerHTML = '';
  logEl.innerHTML = '';
  countEl.textContent = '0';
}
