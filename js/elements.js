// 自定义元素定义：演示全部生命周期回调、属性反射、Shadow DOM
import { Recorder } from './recorder.js';

const counters = new Map();
function nextId(tag) {
  const n = (counters.get(tag) || 0) + 1;
  counters.set(tag, n);
  return `${tag}#${n}`;
}

function where(el) {
  if (!el.isConnected) return '未连接';
  const root = el.getRootNode();
  if (root instanceof ShadowRoot) return `Shadow DOM (${root.host.id || root.host.tagName})`;
  if (root !== document) return '其他文档(iframe)';
  return '主文档';
}

/* ---------- lc-box：通用生命周期演示元素（Light DOM） ---------- */
export class LcBox extends HTMLElement {
  static observedAttributes = ['label', 'level', 'active'];

  constructor() {
    super();
    this.lcId = nextId('lc-box');
    Recorder.record('constructor', 'lc-box', this.lcId, {
      note: '构造函数：此时不能可靠读取属性/子节点',
    });
  }

  connectedCallback() {
    Recorder.record('connectedCallback', 'lc-box', this.lcId, { 位置: where(this) });
    this.render();
  }

  disconnectedCallback() {
    Recorder.record('disconnectedCallback', 'lc-box', this.lcId, { note: '已从文档移除' });
  }

  adoptedCallback(oldDoc, newDoc) {
    Recorder.record('adoptedCallback', 'lc-box', this.lcId, {
      从: oldDoc === document ? '主文档' : 'iframe 文档',
      到: newDoc === document ? '主文档' : 'iframe 文档',
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    Recorder.record('attributeChangedCallback', 'lc-box', this.lcId, {
      属性: name, 旧值: oldValue, 新值: newValue,
    });
    this.render();
  }

  // 属性反射：property -> attribute（setAttribute 自动触发 attributeChangedCallback）
  get label() { return this.getAttribute('label') ?? ''; }
  set label(v) { v == null ? this.removeAttribute('label') : this.setAttribute('label', v); }

  // 数值反射 + 校验：level 始终落在 [0, 5]
  get level() {
    const n = Number(this.getAttribute('level'));
    return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
  }
  set level(v) { this.setAttribute('level', String(this.constructor.clampLevel(v))); }
  static clampLevel(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(5, Math.max(0, Math.round(n))) : 0;
  }

  get active() { return this.hasAttribute('active'); }
  set active(v) { v ? this.setAttribute('active', '') : this.removeAttribute('active'); }

  render() {
    if (!this.isConnected && !this.ownerDocument) return;
    this.textContent = `[${this.lcId}] label=${this.label || '-'} level=${this.level} active=${this.active}`;
  }
}

/* ---------- lc-counter：Shadow DOM 封装演示元素 ---------- */
export class LcCounter extends HTMLElement {
  static observedAttributes = ['step'];

  constructor() {
    super();
    this.lcId = nextId('lc-counter');
    this.count = 0;
    Recorder.record('constructor', 'lc-counter', this.lcId, {});
  }

  connectedCallback() {
    Recorder.record('connectedCallback', 'lc-counter', this.lcId, { 位置: where(this) });
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { display: inline-block; padding: 6px 10px; border: 1px dashed #2dd4bf; border-radius: 6px; }
          button { background:#2dd4bf; border:none; border-radius:4px; padding:2px 8px; cursor:pointer; }
          /* Shadow 内样式不影响外部，外部样式也进不来 */
        </style>
        <span class="val">0</span>
        <button type="button">+step</button>
        <slot></slot>`;
      root.querySelector('button').addEventListener('click', () => {
        this.count += this.step;
        root.querySelector('.val').textContent = String(this.count);
      });
    }
  }

  disconnectedCallback() {
    Recorder.record('disconnectedCallback', 'lc-counter', this.lcId, {});
  }

  adoptedCallback(oldDoc, newDoc) {
    Recorder.record('adoptedCallback', 'lc-counter', this.lcId, {
      从: oldDoc === document ? '主文档' : 'iframe 文档',
      到: newDoc === document ? '主文档' : 'iframe 文档',
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    Recorder.record('attributeChangedCallback', 'lc-counter', this.lcId, {
      属性: name, 旧值: oldValue, 新值: newValue,
    });
  }

  get step() {
    const n = Number(this.getAttribute('step'));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  set step(v) { this.setAttribute('step', String(v)); }
}

/* ---------- lc-lazy：延迟定义 / 升级演示元素（类先导出，define 延后） ---------- */
export class LcLazy extends HTMLElement {
  static observedAttributes = ['label', 'level'];

  constructor() {
    super();
    this.lcId = nextId('lc-lazy');
    Recorder.record('constructor', 'lc-lazy', this.lcId, {
      note: '升级触发：定义后浏览器为已存在的未知元素补调构造函数',
    });
  }

  connectedCallback() {
    Recorder.record('connectedCallback', 'lc-lazy', this.lcId, { 位置: where(this) });
    this.render();
  }

  disconnectedCallback() {
    Recorder.record('disconnectedCallback', 'lc-lazy', this.lcId, {});
  }

  attributeChangedCallback(name, oldValue, newValue) {
    Recorder.record('attributeChangedCallback', 'lc-lazy', this.lcId, {
      属性: name, 旧值: oldValue, 新值: newValue,
      note: '升级时按属性排列顺序逐个补调',
    });
    this.render();
  }

  get label() { return this.getAttribute('label') ?? ''; }
  set label(v) { this.setAttribute('label', v); }

  render() {
    this.textContent = `[${this.lcId}] 已升级 label=${this.label || '-'}`;
  }
}

export const TAGS = { box: 'lc-box', counter: 'lc-counter', lazy: 'lc-lazy' };
