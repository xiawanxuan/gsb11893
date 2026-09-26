/* 兼容性检测：Custom Elements / Shadow DOM / 各回调与相关 API 的支持情况，并给出差异说明 */
(function (global) {
  'use strict';

  function detectCustomizedBuiltIn() {
    try {
      var Probe = global.customElements ? class extends HTMLButtonElement {} : null;
      if (!Probe) return false;
      global.customElements.define('x-compat-probe-builtin', Probe, { extends: 'button' });
      var el = document.createElement('button', { is: 'x-compat-probe-builtin' });
      return el instanceof Probe;
    } catch (e) {
      return false;
    }
  }

  function detectDefinedPseudo() {
    try { return CSS.supports('selector(:defined)'); } catch (e) { return false; }
  }

  function detect() {
    return {
      customElements: 'customElements' in global,
      shadowDOM: 'attachShadow' in Element.prototype,
      adoptedCallback: 'adoptNode' in document,
      mutationObserver: 'MutationObserver' in global,
      broadcastChannel: 'BroadcastChannel' in global,
      indexedDB: 'indexedDB' in global,
      definedPseudo: detectDefinedPseudo(),
      customizedBuiltIn: detectCustomizedBuiltIn()
    };
  }

  var NOTES = {
    customizedBuiltIn: '自定义内置元素（is= 扩展 button 等）在 Safari/WebKit 中不受支持 —— 本演示只使用自治自定义元素（autonomous），这是跨浏览器最稳妥的方式。',
    definedPseudo: ':defined 伪类可用于给未升级元素设置占位样式（如 visibility:hidden），避免升级时闪烁。',
    adoptedCallback: 'adoptedCallback 仅在通过 document.adoptNode 跨文档移动时触发；同一文档内 appendChild 移动不会触发。旧 Edge(EdgeHTML) 不支持该回调。',
    broadcastChannel: 'BroadcastChannel 用于把生命周期事件同步到其他标签页；不支持时仅本页可见。',
    customElements: '当前浏览器不支持 Custom Elements V1 —— 演示将自动走降级路径（普通元素 + 手动初始化）。'
  };

  function render(listEl, noteEl, features) {
    var rows = [
      ['Custom Elements V1', features.customElements],
      ['Shadow DOM (attachShadow)', features.shadowDOM],
      ['adoptedCallback / adoptNode', features.adoptedCallback],
      ['MutationObserver', features.mutationObserver],
      ['BroadcastChannel', features.broadcastChannel],
      ['IndexedDB', features.indexedDB],
      [':defined 伪类', features.definedPseudo],
      ['自定义内置元素 (is=)', features.customizedBuiltIn]
    ];
    listEl.innerHTML = '';
    rows.forEach(function (row) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="' + (row[1] ? 'ok' : 'bad') + '">' + (row[1] ? '✔' : '✘') + '</span> ' + row[0];
      listEl.appendChild(li);
    });
    var notes = [];
    Object.keys(NOTES).forEach(function (key) {
      if (key in features && !features[key]) notes.push(NOTES[key]);
    });
    if (!features.customizedBuiltIn && features.customElements) notes.push(NOTES.customizedBuiltIn);
    noteEl.textContent = notes.length ? notes.join(' ') : '全部特性可用，无兼容性降级。';
  }

  global.CECompat = { detect: detect, render: render, NOTES: NOTES };
})(window);
