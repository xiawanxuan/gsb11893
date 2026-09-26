// 主逻辑：演示场景调度、MutationObserver、兼容性面板、降级方案
import { COMPAT, KNOWN_DIFFERENCES } from './compat.js';
import { Recorder } from './recorder.js';
import { Bus } from './bus.js';
import { LcBox, LcCounter, LcLazy, TAGS } from './elements.js';
import { initTimeline, addEventToTimeline, resetTimeline } from './timeline.js';

const $ = (sel) => document.querySelector(sel);
const stage = () => $('#stage');

/* ---------- 兼容性面板 ---------- */
function renderCompat() {
  const ul = $('#compat-list');
  const rows = [
    ['Custom Elements v1', COMPAT.customElements],
    ['Shadow DOM', COMPAT.shadowDOM],
    ['MutationObserver', COMPAT.mutationObserver],
    ['BroadcastChannel', COMPAT.broadcastChannel],
    ['IndexedDB', COMPAT.indexedDB],
    ['adoptedCallback', COMPAT.adoptedCallback],
    [':defined 选择器', COMPAT.definedSelector],
  ];
  ul.innerHTML = rows
    .map(([name, ok]) => `<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${name}</li>`)
    .join('') + `<li class="ok">⇄ 跨页同步通道：${Bus.mode}</li>`;
  $('#diff-list').innerHTML = KNOWN_DIFFERENCES.map((d) => `<li>${d}</li>`).join('');
}

/* ---------- 元素定义（带重复定义保护） ---------- */
function safeDefine(tag, klass) {
  const existing = customElements.get(tag);
  if (existing) {
    Recorder.record('error', tag, '(注册表)', {
      场景: '重复定义',
      提示: `"${tag}" 已注册，customElements.get() 提前拦截；强行 define 会抛 NotSupportedError`,
    });
    try { customElements.define(tag, klass); } catch (e) {
      Recorder.record('error', tag, '(注册表)', { 异常: `${e.name}: ${e.message}` });
    }
    return false;
  }
  customElements.define(tag, klass);
  Recorder.record('define', tag, '(注册表)', { note: `已注册 ${tag}` });
  return true;
}

/* ---------- MutationObserver：观察主文档舞台与 Shadow 内部 ---------- */
function setupObservers() {
  if (!COMPAT.mutationObserver) return;
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      const added = [...m.addedNodes].filter((n) => n.nodeType === 1).map((n) => n.tagName || n.localName);
      const removed = [...m.removedNodes].filter((n) => n.nodeType === 1).map((n) => n.tagName || n.localName);
      if (!added.length && !removed.length) continue;
      Recorder.record('mutation', '(observer)', '主文档 observer', {
        新增: added.join(',') || '-', 移除: removed.join(',') || '-',
        note: '微任务异步触发，晚于同步生命周期回调',
      });
    }
  });
  mo.observe(stage(), { childList: true, subtree: true });
}

let shadowObserver = null;
function observeShadowRoot(root) {
  if (!COMPAT.mutationObserver || shadowObserver) return;
  shadowObserver = new MutationObserver((muts) => {
    for (const m of muts) {
      const added = [...m.addedNodes].filter((n) => n.nodeType === 1).map((n) => n.localName);
      const removed = [...m.removedNodes].filter((n) => n.nodeType === 1).map((n) => n.localName);
      if (!added.length && !removed.length) continue;
      Recorder.record('mutation', '(observer)', 'Shadow 内部 observer', {
        新增: added.join(',') || '-', 移除: removed.join(',') || '-',
        note: 'Shadow 内变更只有挂在 shadowRoot 上的 observer 才能看到（隔离）',
      });
    }
  });
  shadowObserver.observe(root, { childList: true, subtree: true });
}

/* ---------- 演示场景 ---------- */
let lastBox = null;

function demoCreate() {
  const el = new LcBox();
  el.setAttribute('label', '手动创建'); // 未连接时 setAttribute 也会触发 attributeChangedCallback
  el.level = 7; // 反射 + 钳制到 5
  stage().appendChild(el);
  lastBox = el;
}

function demoInnerHTML() {
  const wrap = document.createElement('div');
  wrap.className = 'group';
  wrap.innerHTML = `
    <lc-box label="甲" level="1"></lc-box>
    <lc-box label="乙" level="2" active></lc-box>
    <lc-box label="丙" level="3"></lc-box>`;
  stage().appendChild(wrap);
  Recorder.record('info', 'lc-box', '(批量)', {
    note: 'innerHTML 解析：每个元素 constructor→attributeChanged(逐个)，插入文档后再统一 connected（按树序）',
  });
  lastBox = wrap.querySelector('lc-box');
}

function demoDisconnectReconnect() {
  const el = lastBox && lastBox.isConnected ? lastBox : stage().querySelector('lc-box');
  if (!el) return hint('请先创建一个 lc-box');
  const parent = el.parentNode, next = el.nextSibling;
  el.remove();                       // disconnectedCallback（同步）
  Recorder.record('info', 'lc-box', el.lcId, { note: '已断开，isConnected=' + el.isConnected });
  parent.insertBefore(el, next);     // connectedCallback（同步）
  Recorder.record('info', 'lc-box', el.lcId, { note: '已重连，isConnected=' + el.isConnected });
}

function demoAttrReflection() {
  const el = lastBox && lastBox.isConnected ? lastBox : stage().querySelector('lc-box');
  if (!el) return hint('请先创建一个 lc-box');
  el.label = '反射-' + Math.floor(Math.random() * 100); // property → attribute 反射
  el.level = Math.floor(Math.random() * 10);            // 超界会被钳制到 [0,5]
  el.active = !el.active;                               // 布尔属性反射
  el.setAttribute('label', el.label + '!');             // attribute → property 方向
}

function demoLazyInsert() {
  if (customElements.get(TAGS.lazy)) return hint('lc-lazy 已定义，请先刷新页面重置');
  const wrap = document.createElement('div');
  wrap.className = 'group';
  wrap.innerHTML = `
    <lc-lazy label="懒甲" level="1"></lc-lazy>
    <lc-lazy label="懒乙" level="2"></lc-lazy>
    <lc-lazy label="懒丙" level="3"></lc-lazy>`;
  stage().appendChild(wrap);
  const first = wrap.querySelector('lc-lazy');
  Recorder.record('info', 'lc-lazy', '(未知元素)', {
    状态: `已插入 3 个未定义的 <lc-lazy>，浏览器按普通 HTMLElement 处理`,
    'matches(:defined)': String(first.matches(':defined')),
    constructor: first.constructor.name,
  });
}

function demoLazyDefine() {
  if (customElements.get(TAGS.lazy)) return hint('lc-lazy 已定义过了');
  Recorder.record('info', 'lc-lazy', '(升级前)', { note: '即将 define，已存在的未知元素将按树序同步升级' });
  customElements.define(TAGS.lazy, LcLazy);
  Recorder.record('define', 'lc-lazy', '(注册表)', { note: 'define 完成，升级已同步发生' });
  customElements.whenDefined(TAGS.lazy).then(() => {
    Recorder.record('upgrade', 'lc-lazy', '(whenDefined)', { note: 'whenDefined Promise 已兑现' });
  });
  const first = stage().querySelector('lc-lazy');
  if (first) {
    Recorder.record('upgrade', 'lc-lazy', first.lcId, {
      'matches(:defined)': String(first.matches(':defined')),
      constructor: first.constructor.name,
    });
  }
}

function demoManualUpgrade() {
  // 手动 upgrade：对动态插入的未定义节点调用 customElements.upgrade
  const host = document.createElement('div');
  host.innerHTML = '<lc-box label="手动upgrade"></lc-box>';
  const el = host.firstChild; // 此时未经过升级流程（createElement 于已定义标签会自动升级，innerHTML 在已定义时也会）
  stage().appendChild(host);
  customElements.upgrade(el); // 已升级则空操作；演示 API 存在性
  Recorder.record('upgrade', 'lc-box', el.lcId || '(未知)', { note: 'customElements.upgrade() 手动触发（幂等）' });
  lastBox = el;
}

function demoDuplicateDefine() {
  Recorder.record('info', 'lc-box', '(注册表)', { note: '尝试重复定义 lc-box…' });
  safeDefine('lc-box', class extends HTMLElement {});
}

function demoShadowMove() {
  const host = $('#shadow-host');
  if (!host.shadowRoot) {
    host.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        .zone { border: 2px dashed #f472b6; padding: 8px; border-radius: 6px; min-height: 30px; }
        .zone::before { content: 'Shadow 内部区域（外部 querySelector 不可达）'; display:block; font-size:11px; color:#f472b6; }
        lc-box { color: #f472b6; } /* 只影响 shadow 内的 lc-box */
      </style>
      <div class="zone" id="inner-zone"></div>
      <div style="margin-top:6px">插槽区：<slot></slot></div>`;
    observeShadowRoot(host.shadowRoot);
    Recorder.record('info', 'shadow-host', '(shadow)', { note: '已创建 open ShadowRoot，并挂载独立 observer' });
  }
  const el = lastBox && lastBox.isConnected ? lastBox : stage().querySelector('lc-box');
  if (!el) return hint('请先创建一个 lc-box');
  const zone = host.shadowRoot.getElementById('inner-zone');
  if (el.getRootNode() === host.shadowRoot) {
    stage().appendChild(el); // 移回主文档
    Recorder.record('info', 'lc-box', el.lcId, {
      note: '移回主文档，document.querySelector 可再次找到: ' + !!document.querySelector(`lc-box`),
    });
  } else {
    zone.appendChild(el); // 移入 Shadow DOM：disconnected → connected
    Recorder.record('info', 'lc-box', el.lcId, {
      note: '已移入 Shadow DOM；主文档 querySelector 找不到它，主文档 observer 也观察不到 shadow 内变化',
      '主文档可查询到': String(!!document.querySelector('lc-box')),
    });
  }
}

function demoCrossContainer() {
  const el = lastBox && lastBox.isConnected ? lastBox : stage().querySelector('lc-box');
  if (!el) return hint('请先创建一个 lc-box');
  const target = el.parentElement.id === 'zone-b' ? $('#zone-a') : $('#zone-b');
  target.appendChild(el); // 同文档移动：disconnected → connected（同步、无 adopted）
  Recorder.record('info', 'lc-box', el.lcId, { note: `同文档迁移到 #${target.id}：仅 disconnected→connected，无 adoptedCallback` });
}

let iframeEl = null;
function demoAdopt() {
  const el = lastBox && lastBox.isConnected ? lastBox : stage().querySelector('lc-box');
  if (!el) return hint('请先创建一个 lc-box');
  if (!iframeEl) {
    iframeEl = document.createElement('iframe');
    iframeEl.id = 'adopt-frame';
    iframeEl.srcdoc = '<body style="background:#1e293b;color:#f472b6;font:13px monospace"></body>';
    $('#iframe-wrap').appendChild(iframeEl);
  }
  const doAdopt = () => {
    const doc = iframeEl.contentDocument;
    if (el.ownerDocument === document) {
      const adopted = doc.adoptNode(el); // adoptedCallback（同步）
      doc.body.appendChild(adopted);     // connectedCallback
      Recorder.record('info', 'lc-box', el.lcId, { note: '已 adopt 进 iframe 文档' });
    } else {
      const adopted = document.adoptNode(el);
      stage().appendChild(adopted);
      Recorder.record('info', 'lc-box', el.lcId, { note: '已 adopt 回主文档' });
    }
  };
  if (iframeEl.contentDocument && iframeEl.contentDocument.body) doAdopt();
  else iframeEl.addEventListener('load', doAdopt, { once: true });
}

/* ---------- 降级方案 ---------- */
function downgradeElement(el) {
  const div = document.createElement('div');
  div.className = 'downgraded';
  for (const attr of el.attributes) div.setAttribute(attr.name, attr.value);
  div.textContent = `[降级] ${el.localName} → 普通 div（保留属性与内容）`;
  el.replaceWith(div);
  Recorder.record('fallback', el.localName, el.lcId || '(实例)', {
    note: '自定义元素已降级为普通 <div>，保留全部属性；回调不再触发',
  });
}

function demoDowngrade() {
  const el = lastBox && lastBox.isConnected ? lastBox : stage().querySelector('lc-box');
  if (!el) return hint('请先创建一个 lc-box');
  downgradeElement(el);
}

// 完全不支持 Custom Elements 时的整体降级：用普通元素 + 手动调度模拟生命周期
function installFullFallback() {
  $('#fallback-banner').hidden = false;
  document.querySelectorAll('.needs-ce').forEach((b) => (b.disabled = true));
  Recorder.record('fallback', '(环境)', '(全局)', {
    note: '当前浏览器不支持 Custom Elements，已切换为普通元素降级模式',
  });
  window.__fallbackCreate = () => {
    const div = document.createElement('div');
    div.className = 'downgraded';
    div.setAttribute('label', '降级元素');
    div.textContent = '[降级模式] 普通 div（无生命周期回调）';
    stage().appendChild(div);
    Recorder.record('fallback', 'div', '(降级实例)', { note: '模拟 constructor + connected' });
  };
}

/* ---------- 工具 ---------- */
function hint(msg) {
  Recorder.record('info', '(提示)', '(用户)', { note: msg });
}

function bind(id, fn) { $(id).addEventListener('click', fn); }

/* ---------- 启动 ---------- */
async function start() {
  initTimeline();
  Recorder.onEvent(addEventToTimeline);
  await Recorder.init();
  renderCompat();
  setupObservers();

  if (!COMPAT.customElements) {
    installFullFallback();
    bind('#btn-create', () => window.__fallbackCreate());
    return;
  }

  // 注册基础元素（lc-lazy 故意延迟定义）
  safeDefine(TAGS.box, LcBox);
  safeDefine(TAGS.counter, LcCounter);

  bind('#btn-create', demoCreate);
  bind('#btn-innerhtml', demoInnerHTML);
  bind('#btn-counter', () => {
    const c = new LcCounter();
    c.step = 2;
    stage().appendChild(c);
  });
  bind('#btn-disconnect', demoDisconnectReconnect);
  bind('#btn-attr', demoAttrReflection);
  bind('#btn-lazy-insert', demoLazyInsert);
  bind('#btn-lazy-define', demoLazyDefine);
  bind('#btn-manual-upgrade', demoManualUpgrade);
  bind('#btn-dup-define', demoDuplicateDefine);
  bind('#btn-shadow', demoShadowMove);
  bind('#btn-cross-container', demoCrossContainer);
  bind('#btn-adopt', demoAdopt);
  bind('#btn-downgrade', demoDowngrade);
  bind('#btn-clear', async () => {
    await Recorder.clear();
    resetTimeline();
    stage().innerHTML = '';
    $('#iframe-wrap').innerHTML = '';
    iframeEl = null;
    Recorder.record('info', '(系统)', '(全局)', { note: '时间线与舞台已清空' });
  });
}

start();
