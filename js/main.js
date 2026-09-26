/* 演示编排：兼容性检测、MutationObserver 观察、各生命周期场景、降级方案 */
(function () {
  'use strict';

  var playground = document.getElementById('playground');
  var timelineEl = document.getElementById('timeline');
  var recorder = new LifecycleRecorder(timelineEl);
  CEL.recorder = recorder;

  var features = CECompat.detect();
  CECompat.render(document.getElementById('compat-list'), document.getElementById('compat-note'), features);

  var ceSupported = features.customElements && features.shadowDOM;
  if (ceSupported) {
    CEL.defineAll();
  } else {
    recorder.record('fallback', '(app)', 'Custom Elements 不可用，已进入降级模式：所有演示按钮将渲染普通元素');
  }
  recorder.init();

  /* ---------- 工具 ---------- */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3600);
  }

  function on(id, fn) { document.getElementById(id).addEventListener('click', fn); }

  /* ---------- MutationObserver：与生命周期回调对照观察 DOM 变化 ---------- */
  if (features.mutationObserver) {
    var mo = new MutationObserver(function (mutations) {
      if (!document.getElementById('chk-mutations').checked) return;
      mutations.forEach(function (m) {
        if (m.type === 'childList') {
          var added = [].map.call(m.addedNodes, function (n) { return n.tagName ? n.tagName.toLowerCase() : '#text'; }).join(', ');
          var removed = [].map.call(m.removedNodes, function (n) { return n.tagName ? n.tagName.toLowerCase() : '#text'; }).join(', ');
          var parts = [];
          if (added) parts.push('新增: ' + added);
          if (removed) parts.push('移除: ' + removed);
          if (parts.length) recorder.record('mutation', '(playground)', parts.join('；'));
        } else if (m.type === 'attributes') {
          recorder.record('mutation', m.target, '属性 ' + m.attributeName + ' 变为 "' + m.target.getAttribute(m.attributeName) + '"');
        }
      });
    });
    mo.observe(playground, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'name', 'lang'] });
  }

  /* ---------- 1. 基础生命周期：创建 / 断开 / 重连 ---------- */
  var counter = null;
  on('btn-create-counter', function () {
    if (!ceSupported) return degradeNotice();
    if (counter && counter.isConnected) return toast('x-counter 已在舞台中，可先断开再重连');
    if (!counter) {
      counter = document.createElement('x-counter'); // constructor 在此触发
      recorder.record('system', 'x-counter', 'document.createElement 完成（尚未连接）');
    }
    playground.appendChild(counter); // connectedCallback
  });
  on('btn-disconnect', function () {
    if (!counter || !counter.isConnected) return toast('没有已连接的 x-counter');
    counter.remove(); // disconnectedCallback
  });
  on('btn-reconnect', function () {
    if (!counter) return toast('请先创建 x-counter');
    if (counter.isConnected) return toast('已在文档中');
    playground.appendChild(counter); // connectedCallback 再次触发，状态保留
  });

  /* ---------- 2. 属性变化与反射 ---------- */
  on('btn-set-attr', function () {
    if (!counter) return toast('请先创建 x-counter');
    var v = Math.floor(Math.random() * 100);
    recorder.record('system', 'x-counter', '调用 setAttribute("value", "' + v + '")');
    counter.setAttribute('value', String(v)); // attribute -> property
  });
  on('btn-set-prop', function () {
    if (!counter) return toast('请先创建 x-counter');
    var v = Math.floor(Math.random() * 100);
    recorder.record('system', 'x-counter', '调用 counter.value = ' + v + '（property，应反射为 attribute）');
    counter.value = v; // property -> attribute（反射）
  });
  on('btn-greeter', function () {
    if (!ceSupported) return degradeNotice();
    var g = document.createElement('x-greeter');
    g.setAttribute('name', '世界'); // 升级前已存在的属性会在定义时回放；此处已定义则直接触发
    g.setAttribute('lang', Math.random() > 0.5 ? 'en' : 'zh');
    playground.appendChild(g);
  });

  /* ---------- 3. 延迟定义 / 重复定义 / whenDefined ---------- */
  var lazySeq = 0;
  on('btn-lazy', function () {
    if (!ceSupported) return degradeNotice();
    lazySeq++;
    var tag = 'x-lazy-' + lazySeq; // 每次用新标签名，保证是“未知元素”
    recorder.record('system', tag, '插入 3 个未定义的 <' + tag + '>（只是 HTMLElement），800ms 后再 define');
    for (var i = 0; i < 3; i++) {
      var el = document.createElement(tag);
      el.setAttribute('data-order', String(i));
      el.textContent = tag + ' #' + i;
      el.className = 'ce-card';
      playground.appendChild(el);
    }
    setTimeout(function () {
      var order = 0;
      var LazyClass = class extends HTMLElement {
        static get observedAttributes() { return ['data-order']; }
        constructor() {
          super();
          recorder.record('upgrade', this, '升级 #' + (order++) + '（按文档顺序）');
        }
        connectedCallback() {
          recorder.record('connected', this, '升级后连接，data-order=' + this.getAttribute('data-order'));
        }
        attributeChangedCallback(name, oldV, newV) {
          recorder.record('attribute', this, '升级时回放已有属性 ' + name + '=' + newV);
        }
      };
      customElements.define(tag, LazyClass); // 触发升级：constructor → attributeChanged → connected
      recorder.record('system', tag, 'customElements.define 完成，3 个未知元素已按文档顺序升级');
    }, 800);
  });

  on('btn-dup', function () {
    if (!ceSupported) return degradeNotice();
    try {
      customElements.define('x-counter', class extends HTMLElement {});
      recorder.record('system', 'x-counter', '意外：重复定义没有抛错？');
    } catch (err) {
      var msg = '重复定义被拒绝：' + err.name + ' — ' + err.message;
      recorder.record('system', 'x-counter', msg);
      toast(msg);
    }
  });

  on('btn-when-defined', function () {
    if (!ceSupported) return degradeNotice();
    var tag = 'x-when-' + (++lazySeq);
    var el = document.createElement(tag);
    el.textContent = tag + '（等待定义…）';
    el.className = 'ce-card';
    playground.appendChild(el);
    recorder.record('system', tag, '已插入未知元素，注册 whenDefined 回调，1s 后定义');
    customElements.whenDefined(tag).then(function () {
      recorder.record('upgrade', tag, 'customElements.whenDefined("' + tag + '") Promise 兑现');
      el.textContent = tag + '（已升级 ✔）';
    });
    setTimeout(function () {
      customElements.define(tag, class extends HTMLElement {});
    }, 1000);
  });

  /* ---------- 4. adoptedCallback：跨文档迁移 ---------- */
  var iframe = null;
  var adoptee = null;
  function ensureIframe() {
    if (iframe) return iframe;
    iframe = document.createElement('iframe');
    iframe.src = 'about:blank';
    document.getElementById('iframe-holder').appendChild(iframe);
    return iframe;
  }
  on('btn-adopt-out', function () {
    if (!ceSupported) return degradeNotice();
    if (!adoptee) {
      adoptee = document.createElement('x-greeter');
      adoptee.setAttribute('name', '迁移者');
      playground.appendChild(adoptee);
    }
    var doc = ensureIframe().contentDocument;
    recorder.record('system', 'x-greeter', '调用 iframeDoc.adoptNode(el) —— 先触发 disconnected，再触发 adopted，最后 connected');
    doc.body.appendChild(doc.adoptNode(adoptee)); // adoptedCallback 触发点
  });
  on('btn-adopt-back', function () {
    if (!adoptee) return toast('还没有可迁回的元素');
    playground.appendChild(document.adoptNode(adoptee));
  });

  /* ---------- 5. Shadow DOM 隔离 ---------- */
  on('btn-shadow-host', function () {
    if (!ceSupported) return degradeNotice();
    var host = document.createElement('x-shadow-host');
    var slotted = document.createElement('span');
    slotted.textContent = '（外部插槽内容）';
    host.appendChild(slotted);
    playground.appendChild(host);
  });
  on('btn-shadow-probe', function () {
    var viaDoc = document.querySelector('x-leaf');
    var host = document.querySelector('x-shadow-host');
    var viaShadow = host && host.shadowRoot ? host.shadowRoot.querySelector('x-leaf') : null;
    recorder.record('system', 'x-shadow-host',
      'document.querySelector("x-leaf") = ' + (viaDoc ? '找到（隔离失败!）' : 'null（隔离正确 ✔）') +
      '；host.shadowRoot.querySelector = ' + (viaShadow ? '找到 ✔' : 'null'));
    toast(viaDoc ? '隔离失败' : 'Shadow DOM 隔离验证通过：外部选择器无法穿透');
  });

  /* ---------- 6. 降级方案：普通元素 + 手动生命周期 ---------- */
  function degradeNotice() {
    recorder.record('fallback', '(app)', 'Custom Elements 不可用，按钮改走降级渲染');
    renderFallback();
  }
  function renderFallback() {
    var box = document.createElement('div');
    box.className = 'ce-card';
    box.innerHTML = '<b>降级版计数器</b> <button data-d="-1" style="width:auto;display:inline">-</button>' +
      '<span class="fv">0</span><button data-d="1" style="width:auto;display:inline">+</button>';
    var span = box.querySelector('.fv');
    var value = 0;
    box.addEventListener('click', function (e) {
      var d = e.target.getAttribute && e.target.getAttribute('data-d');
      if (!d) return;
      value += Number(d);
      span.textContent = String(value);
      recorder.record('fallback', 'div.ce-card', '手动模拟 attributeChanged：value → ' + value);
    });
    playground.appendChild(box);
    recorder.record('fallback', 'div.ce-card', '以普通 <div> + addEventListener 模拟 connectedCallback/属性反射（无 CE 时的回退）');
  }
  on('btn-degrade', renderFallback);

  /* ---------- 时间线控制 ---------- */
  var filterSel = document.getElementById('filter-callback');
  Object.keys(LifecycleRecorder.CALLBACK_LABELS).forEach(function (key) {
    var opt = document.createElement('option');
    opt.value = key;
    opt.textContent = LifecycleRecorder.CALLBACK_LABELS[key];
    filterSel.appendChild(opt);
  });
  filterSel.addEventListener('change', function () { recorder.setFilter(filterSel.value); });
  on('btn-clear', function () { recorder.clear(); });
})();
