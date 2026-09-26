// BroadcastChannel 跨标签页同步；不支持时降级为 localStorage storage 事件
export const Bus = {
  id: Math.random().toString(36).slice(2, 8),
  mode: 'none',
  handlers: new Set(),
  init() {
    if ('BroadcastChannel' in window) {
      this.mode = 'BroadcastChannel';
      this.bc = new BroadcastChannel('lc-lifecycle');
      this.bc.onmessage = (ev) => this.dispatch(ev.data);
    } else {
      this.mode = 'localStorage(降级)';
      window.addEventListener('storage', (ev) => {
        if (ev.key === 'lc-lifecycle-msg' && ev.newValue) {
          try { this.dispatch(JSON.parse(ev.newValue)); } catch { /* 忽略坏消息 */ }
        }
      });
    }
  },
  send(data) {
    const msg = { ...data, origin: this.id };
    try {
      if (this.bc) this.bc.postMessage(msg);
      else localStorage.setItem('lc-lifecycle-msg', JSON.stringify({ ...msg, t: Date.now() }));
    } catch { /* 降级发送失败不影响主流程 */ }
  },
  dispatch(msg) {
    if (!msg || msg.origin === this.id) return;
    this.handlers.forEach((fn) => fn(msg));
  },
  onMessage(fn) { this.handlers.add(fn); },
};
