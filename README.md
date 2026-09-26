# 自定义元素生命周期实验室

纯静态、零依赖的 Custom Elements 生命周期演示应用。
直接用任意静态服务器打开即可（ES Module 需要 http 协议）：

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
```

## 技术栈

- **Custom Elements v1**：`lc-box`（Light DOM 全回调）、`lc-counter`（Shadow DOM 封装）、`lc-lazy`（延迟定义/升级演示）
- **Shadow DOM**：`lc-counter` 内部封装；`#shadow-host` 演示跨 Shadow 边界移动与样式/查询隔离
- **MutationObserver**：主文档 observer + shadowRoot 独立 observer，对比隔离性与异步时序
- **BroadcastChannel**：跨标签页同步生命周期事件（不支持时降级 localStorage storage 事件）
- **IndexedDB**：事件持久化，刷新后恢复时间线

## 验收标准对照

| 验收项 | 实现 |
| --- | --- |
| 生命周期回调顺序正确 | 事件在回调内同步记录，全局单调 `seq` 排序；泳道按 seq 渲染 |
| 延迟定义和升级正确 | 按钮⑥先插入未知 `<lc-lazy>`（普通 HTMLElement），按钮⑦ `define` 后按树序同步升级：constructor → attributeChanged（按属性顺序）→ connected |
| 重复定义有提示 | `customElements.get()` 预检拦截 + 捕获 `NotSupportedError`，均记录到时间线 |
| 属性反射正确 | `label`/`level`/`active` 实现 property ↔ attribute 双向反射，`level` 钳制 [0,5]，无死循环 |
| 断开重连正确 | 按钮④ `remove()` + `insertBefore()`，同步触发 disconnected → connected |
| Shadow DOM 隔离正确 | 移入 shadowRoot 后主文档 `querySelector` 不可达、主文档 observer 观察不到、shadow 内样式不外泄 |
| 兼容性差异有处理 | 启动时检测 7 项能力并展示；BroadcastChannel 自动降级 localStorage；面板列出已知浏览器差异 |
| 降级方案可用 | 不支持 Custom Elements 时整体降级为普通元素模式；按钮⑬ 可将单个元素降级为 `<div>` 并保留属性 |
| 时间线可视化准确 | 按元素实例分泳道，事件按 seq 着色渲染（颜色区分回调类型），附时间偏移与详情 tooltip，远程事件有标记 |

## 文件结构

```
index.html        页面结构
css/style.css     样式（泳道时间线、日志、面板）
js/compat.js      能力检测 + 已知差异清单
js/store.js       IndexedDB 持久化
js/bus.js         BroadcastChannel（含 localStorage 降级）
js/recorder.js    事件记录中心（排序/持久化/广播/分发）
js/elements.js    三个自定义元素类（全部生命周期回调 + 反射）
js/timeline.js    泳道时间线渲染
js/main.js        演示场景调度、MutationObserver、降级方案
```

## 关键时序备忘

- `new LcBox()` 后、插入前 `setAttribute` 也会触发 `attributeChangedCallback`
- `innerHTML` 解析：每个元素 constructor → attributeChanged（逐个），插入文档后按树序 connected
- 同文档移动：仅 disconnected → connected（同步），不触发 adoptedCallback
- `document.adoptNode` 跨文档：先 adoptedCallback，插入新文档后再 connectedCallback
- MutationObserver 回调是微任务，晚于同步生命周期回调
