// 兼容性检测与降级支持
export function detectCompat() {
  const result = {
    customElements: 'customElements' in window,
    shadowDOM: 'attachShadow' in Element.prototype,
    mutationObserver: 'MutationObserver' in window,
    broadcastChannel: 'BroadcastChannel' in window,
    indexedDB: 'indexedDB' in window,
    adoptedCallback: false,
    definedSelector: false,
  };
  // :defined 选择器支持检测
  try {
    document.createElement('div').matches(':defined');
    result.definedSelector = true;
  } catch { result.definedSelector = false; }
  // adoptedCallback 无法直接探测，随 Custom Elements v1 一起提供；
  // Safari 10.1+ / Chrome 54+ / Firefox 63+ 均支持，这里以 customElements 为准
  result.adoptedCallback = result.customElements;
  return result;
}

export const COMPAT = detectCompat();

// 已知浏览器差异说明（用于兼容性面板展示）
export const KNOWN_DIFFERENCES = [
  'Safari < 15.4 不支持 BroadcastChannel，本应用自动降级为 localStorage 事件同步',
  'Safari 不支持自定义内置元素（customized built-in），本应用仅使用自治自定义元素',
  '升级（upgrade）时 attributeChangedCallback 按属性在元素上的排列顺序逐个触发，先于 connectedCallback',
  '解析器创建元素时：constructor → attributeChangedCallback（解析到属性即触发）→ connectedCallback（插入文档时）',
  'document.adoptNode 跨文档迁移会触发 adoptedCallback；同文档内移动只触发 disconnected → connected',
  'MutationObserver 回调是微任务异步触发，晚于同步的生命周期回调',
  'Shadow DOM 内部的 DOM 变更不会被观察 document 的 MutationObserver 捕获（隔离性）',
];
