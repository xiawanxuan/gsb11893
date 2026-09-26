/* LifecycleRecorder：记录生命周期事件，IndexedDB 持久化，BroadcastChannel 跨标签页同步，渲染时间线 */
(function (global) {
  'use strict';

  var DB_NAME = 'ce-lifecycle-db';
  var STORE = 'events';
  var CHANNEL = 'ce-lifecycle-demo';
  var MAX_DOM_ITEMS = 300;
  var MAX_LOAD = 200;

  var CALLBACK_LABELS = {
    constructor: 'constructor',
    connected: 'connectedCallback',
    disconnected: 'disconnectedCallback',
    attribute: 'attributeChangedCallback',
    adopted: 'adoptedCallback',
    upgrade: 'upgrade（升级）',
    mutation: 'MutationObserver',
    system: '系统',
    fallback: '降级'
  };

  function LifecycleRecorder(timelineEl) {
    this.timelineEl = timelineEl;
    this.seq = 0;
    this.t0 = performance.now();
    this.db = null;
    this.channel = null;
    this.filterCallback = '';
    this.events = [];
  }

  LifecycleRecorder.prototype.init = function () {
    var self = this;
    this._openDB().then(function (db) {
      self.db = db;
      return self._loadAll();
    }).then(function (rows) {
      rows.forEach(function (row) { self._append(row, false); });
      if (rows.length) {
        self._system('从 IndexedDB 恢复 ' + rows.length + ' 条历史事件');
      }
    }).catch(function (err) {
      self._system('IndexedDB 不可用（' + err.message + '），事件仅保存在内存');
    });

    if ('BroadcastChannel' in global) {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = function (msg) {
        var ev = msg.data;
        ev.remote = true;
        self._append(ev, false);
        var hint = document.getElementById('remote-hint');
        if (hint) hint.classList.remove('hidden');
      };
    }
  };

  LifecycleRecorder.prototype._openDB = function () {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in global)) return reject(new Error('浏览器不支持'));
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE, { keyPath: 'seq' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('打开失败')); };
    });
  };

  LifecycleRecorder.prototype._loadAll = function () {
    var self = this;
    return new Promise(function (resolve) {
      if (!self.db) return resolve([]);
      var tx = self.db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).getAll();
      req.onsuccess = function () {
        var rows = req.result || [];
        resolve(rows.slice(-MAX_LOAD));
      };
      req.onerror = function () { resolve([]); };
    });
  };

  LifecycleRecorder.prototype._persist = function (ev) {
    if (!this.db) return;
    try {
      this.db.transaction(STORE, 'readwrite').objectStore(STORE).put(ev);
    } catch (e) { /* 忽略持久化失败 */ }
  };

  LifecycleRecorder.prototype.clear = function () {
    var self = this;
    this.events = [];
    this.timelineEl.innerHTML = '';
    if (this.db) {
      this.db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
    }
    this._system('时间线已清空');
  };

  LifecycleRecorder.prototype.setFilter = function (callback) {
    this.filterCallback = callback;
    this.timelineEl.innerHTML = '';
    var self = this;
    this.events.forEach(function (ev) { self._render(ev); });
  };

  /* 记录一条事件。element 可为元素实例或字符串标签。 */
  LifecycleRecorder.prototype.record = function (callback, element, detail) {
    var tag = typeof element === 'string'
      ? element
      : (element && element.tagName ? element.tagName.toLowerCase() : '(unknown)');
    var ev = {
      seq: ++this.seq,
      t: Math.round(performance.now() - this.t0),
      wall: Date.now(),
      callback: callback,
      tag: tag,
      detail: detail || '',
      remote: false
    };
    this._append(ev, true);
    return ev;
  };

  LifecycleRecorder.prototype._system = function (detail) {
    this.record('system', '(app)', detail);
  };

  LifecycleRecorder.prototype._append = function (ev, broadcast) {
    this.events.push(ev);
    this._render(ev);
    if (!ev.remote) {
      this._persist(ev);
      if (broadcast && this.channel) {
        try { this.channel.postMessage(ev); } catch (e) { /* 跨标签广播失败可忽略 */ }
      }
    }
  };

  LifecycleRecorder.prototype._render = function (ev) {
    if (this.filterCallback && ev.callback !== this.filterCallback) return;
    var li = document.createElement('li');
    li.className = 'ev-' + ev.callback;
    var label = CALLBACK_LABELS[ev.callback] || ev.callback;
    li.innerHTML =
      '<span class="t">+' + ev.t + 'ms</span>' +
      '<span class="cb">' + label + (ev.remote ? '<span class="badge-remote">远程</span>' : '') + '</span>' +
      '<span class="el">&lt;' + ev.tag + '&gt;</span>' +
      '<span class="detail"></span>';
    li.querySelector('.detail').textContent = ev.detail;
    this.timelineEl.insertBefore(li, this.timelineEl.firstChild);
    while (this.timelineEl.children.length > MAX_DOM_ITEMS) {
      this.timelineEl.removeChild(this.timelineEl.lastChild);
    }
  };

  LifecycleRecorder.CALLBACK_LABELS = CALLBACK_LABELS;
  global.LifecycleRecorder = LifecycleRecorder;
})(window);
