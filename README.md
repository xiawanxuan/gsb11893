# Custom Elements 生命周期实验室

一个零依赖、纯静态的自定义元素（Custom Elements V1）生命周期演示与可视化工具。

## 运行

```bash
cd B
python3 -m http.server 8080
# 打开 http://localhost:8080
```

直接双击 `index.html`（file://）也可以运行（未使用 ES modules）。

## 覆盖的生命周期场景

| 场景 | 操作入口 | 验证点 |
|---|---|---|
| 构造 / 连接 | 「创建 x-counter」 | `constructor` → `connectedCallback` 顺序 |
| 断开 / 重连 | 「断开」「重连」 | `disconnectedCallback`，重连后状态保留 |
| 属性变化 | 「setAttribute」「property 赋值」 | `attributeChangedCallback` 的 old/new 值；property ↔ attribute 双向反射（带防循环） |
| 延迟定义 / 升级 | 「先插入未知元素，800ms 后再 define」 | 未知元素先是 `HTMLElement`，define 后按**文档顺序**升级；升级时回放已有属性（attributeChanged 先于 connected） |
| 重复定义 | 「重复定义 x-counter」 | 捕获 `NotSupportedError` 并弹出提示 |
| whenDefined | 「whenDefined 演示」 | Promise 在定义时兑现 |
| 跨文档采用 | 「adoptNode 迁移到 iframe」 | `adoptedCallback`（顺序：disconnected → adopted → connected） |
| Shadow DOM 隔离 | 「创建 x-shadow-host」「探测隔离」 | 影子内样式不外泄；`document.querySelector` 无法穿透 shadow root；影子内部可使用自定义元素（`x-leaf`） |
| 降级方案 | 「渲染普通元素降级版」 | 无 Custom Elements 时用普通 `<div>` + 事件监听模拟同等交互 |

## 技术栈

- **Custom Elements V1**：`x-counter`（属性反射）、`x-greeter`（多属性观察）、`x-shadow-host` / `x-leaf`（Shadow DOM）、动态标签 `x-lazy-N`（升级演示）
- **Shadow DOM**：open 模式 shadow root，样式/选择器隔离，`::slotted`
- **MutationObserver**：观察 playground 的 childList/attributes 变化，与生命周期回调在时间线上对照
- **BroadcastChannel**：`ce-lifecycle-demo` 频道，生命周期事件跨标签页实时同步（远程事件带「远程」徽标）
- **IndexedDB**：`ce-lifecycle-db.events` 持久化事件，刷新后恢复最近 200 条

## 兼容性处理（js/compat.js）

启动时检测并在页面顶部展示：Custom Elements V1、Shadow DOM、`adoptedCallback`/`adoptNode`、MutationObserver、BroadcastChannel、IndexedDB、`:defined` 伪类、自定义内置元素（`is=`，Safari 不支持）。任一关键能力缺失时自动切换到降级路径，并给出差异说明（如 Safari 不支持 customized built-in、旧 Edge 无 `adoptedCallback`）。

## 文件结构

```
index.html      演示页面与控制面板
css/style.css   样式（时间线按回调类型着色）
js/recorder.js  LifecycleRecorder：时间线渲染 + IndexedDB + BroadcastChannel
js/compat.js    特性检测与兼容性说明
js/elements.js  自定义元素定义
js/main.js      场景编排、MutationObserver、降级渲染
```
