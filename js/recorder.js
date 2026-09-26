// 生命周期事件记录中心：排序、持久化、广播、分发
import { Store } from './store.js';
import { Bus } from './bus.js';

export const EVENT_TYPES = {
  constructor:              { label: 'constructor',              color: '#a78bfa' },
  connectedCallback:        { label: 'connectedCallback',        color: '#34d399' },
  disconnectedCallback:     { label: 'disconnectedCallback',     color: '#fb923c' },
  attributeChangedCallback: { label: 'attributeChangedCallback', color: '#60a5fa' },
  adoptedCallback:          { label: 'adoptedCallback',          color: '#f472b6' },
  upgrade:                  { label: 'upgrade(升级)',            color: '#2dd4bf' },
  define:                   { label: 'customElements.define',    color: '#14b8a6' },
  mutation:                 { label: 'MutationObserver',         color: '#94a3b8' },
  error:                    { label: '冲突/错误',                color: '#f87171' },
  fallback:                 { label: '降级方案',                 color: '#facc15' },
  info:                     { label: '信息',                     color: '#cbd5e1' },
};

export const Recorder = {
  seq: 0,
  t0: Date.now(),
  listeners: new Set(),

  async init() {
    Bus.init();
    const saved = await Store.all();
    saved.sort((a, b) => a.seq - b.seq);
    for (const e of saved) {
      this.seq = Math.max(this.seq, e.seq);
      this.emit(e, { persist: false, broadcast: false });
    }
    Bus.onMessage((msg) => {
      this.emit({ ...msg, remote: true }, { persist: false, broadcast: false });
    });
  },

  record(type, tag, elId, detail = {}) {
    const entry = {
      seq: ++this.seq,
      time: Date.now(),
      offset: Date.now() - this.t0,
      type, tag, elId, detail,
      origin: Bus.id,
    };
    this.emit(entry, { persist: true, broadcast: true });
    return entry;
  },

  emit(entry, { persist, broadcast }) {
    if (persist) Store.add(entry);
    if (broadcast) Bus.send(entry);
    this.listeners.forEach((fn) => fn(entry));
  },

  onEvent(fn) { this.listeners.add(fn); },

  async clear() {
    this.seq = 0;
    this.t0 = Date.now();
    await Store.clear();
  },
};
