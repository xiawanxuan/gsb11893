/* 自定义元素定义：x-counter（属性反射）、x-greeter（多属性观察）、x-shadow-host（Shadow DOM 隔离）、x-leaf（影子内子元素） */
(function (global) {
  'use strict';

  var CEL = global.CEL = global.CEL || {};
  function log(callback, el, detail) {
    if (CEL.recorder) CEL.recorder.record(callback, el, detail);
  }

  /* ---------- x-counter：演示属性 <-> 属性值双向反射 ---------- */
  class XCounter extends HTMLElement {
    static get observedAttributes() { return ['value']; }

    constructor() {
      super();
      this._value = 0;
      log('constructor', this, 'this._value 初始化为 0；此时不能读写属性/子节点之外的状态');
      if (this.attachShadow) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML =
          '<style>:host{display:inline-block;font-family:inherit}' +
          '.card{border:1px solid #35466b;border-radius:8px;padding:8px 12px;background:#1f2940}' +
          'button{width:auto;display:inline;margin:0 4px;padding:2px 10px}</style>' +
          '<span class="card"><button data-d="-1">-</button><b id="v">0</b><button data-d="1">+</button></span>';
        var self = this;
        this.shadowRoot.addEventListener('click', function (e) {
          var d = e.target.getAttribute && e.target.getAttribute('data-d');
          if (d) self.value = self._value + Number(d); // 走 property setter -> 反射到 attribute
        });
      }
    }

    connectedCallback() {
      log('connected', this, '插入文档；parent=' + (this.parentElement ? this.parentElement.tagName.toLowerCase() : 'null'));
      this._render();
    }

    disconnectedCallback() {
      log('disconnected', this, '从文档移除；内部状态保留，重连后恢复');
    }

    adoptedCallback(oldDoc, newDoc) {
      log('adopted', this, '跨文档迁移：' + (oldDoc === document ? '主文档' : 'iframe') + ' → ' + (newDoc === document ? '主文档' : 'iframe'));
    }

    attributeChangedCallback(name, oldVal, newVal) {
      if (oldVal === newVal) return; // 避免反射造成的重复触发
      log('attribute', this, name + ': "' + oldVal + '" → "' + newVal + '"' + (this.isConnected ? '' : '（升级时回放，先于 connectedCallback）'));
      var n = Number(newVal);
      this._value = isNaN(n) ? 0 : n;
      this._render();
    }

    /* 属性反射：property -> attribute；attribute -> property 由 attributeChangedCallback 完成 */
    get value() { return this._value; }
    set value(v) {
      var next = Number(v) || 0;
      if (String(next) !== this.getAttribute('value')) {
        this.setAttribute('value', String(next)); // 反射到 attribute，触发 attributeChangedCallback
      }
    }

    _render() {
      var v = this.shadowRoot && this.shadowRoot.getElementById('v');
      if (v) v.textContent = String(this._value);
    }
  }

  /* ---------- x-greeter：观察多个属性，演示 old/new 值 ---------- */
  class XGreeter extends HTMLElement {
    static get observedAttributes() { return ['name', 'lang']; }
    constructor() {
      super();
      log('constructor', this, '');
    }
    connectedCallback() {
      log('connected', this, 'name=' + this.getAttribute('name') + ' lang=' + this.getAttribute('lang'));
      this.classList.add('ce-card');
      this._render();
    }
    disconnectedCallback() { log('disconnected', this, ''); }
    adoptedCallback() { log('adopted', this, '被 adoptNode 迁移'); }
    attributeChangedCallback(name, oldVal, newVal) {
      log('attribute', this, name + ': "' + oldVal + '" → "' + newVal + '"');
      this._render();
    }
    _render() {
      var name = this.getAttribute('name') || '匿名';
      var lang = this.getAttribute('lang') || 'zh';
      this.textContent = (lang === 'en' ? 'Hello, ' : '你好，') + name + '！';
    }
  }

  /* ---------- x-leaf：放置在 shadow root 内部，验证自定义元素可跨 Shadow 边界工作 ---------- */
  class XLeaf extends HTMLElement {
    constructor() {
      super();
      log('constructor', this, '（定义于 shadow root 内部的元素）');
    }
    connectedCallback() {
      var root = this.getRootNode();
      log('connected', this, 'getRootNode() 是 ' + (root instanceof ShadowRoot ? 'ShadowRoot（被影子隔离）' : 'Document'));
      this.textContent = '我是影子 DOM 里的 <x-leaf>';
      this.style.color = '#4dd0e1';
    }
    disconnectedCallback() { log('disconnected', this, ''); }
  }

  /* ---------- x-shadow-host：带 shadow root 的宿主，演示样式与选择器隔离 ---------- */
  class XShadowHost extends HTMLElement {
    constructor() {
      super();
      log('constructor', this, '');
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' +
        ':host{display:inline-block;border:2px solid #f06292;border-radius:8px;padding:10px;background:#241a2e}' +
        'p{color:#f06292;margin:0 0 6px;font-size:13px}' +
        '::slotted(span){color:#aeea00}' +
        '</style>' +
        '<p>Shadow Host（影子内样式不影响外部）</p>' +
        '<x-leaf></x-leaf>' +
        '<div>插槽内容 → <slot></slot></div>';
    }
    connectedCallback() { log('connected', this, 'shadowRoot 内已含 <x-leaf>'); }
    disconnectedCallback() { log('disconnected', this, ''); }
  }

  CEL.defineAll = function () {
    if (!('customElements' in global)) return false;
    var defs = [
      ['x-counter', XCounter],
      ['x-greeter', XGreeter],
      ['x-leaf', XLeaf],
      ['x-shadow-host', XShadowHost]
    ];
    defs.forEach(function (d) {
      if (!customElements.get(d[0])) customElements.define(d[0], d[1]);
    });
    return true;
  };

  CEL.XCounter = XCounter;
  CEL.XGreeter = XGreeter;
})(window);
