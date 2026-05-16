# 思维导图布局算法

本文档描述 `src/layout/balanced.ts` 如何把 `MindNode` 树转换成带坐标的
React Flow 节点和边。`src/layout/simple.ts` 是早期的简单回退实现，目前
没有被 `MindMap.tsx` 引用，生产代码走的是 `balanced.ts`。

## 节点模型回顾

- **`rootQ`** —— 用户的初始问题，绘制在所在树的中心。
- **`A`** —— 答案节点。每个 `A` 带一个 `parentEdgeLabel`（产生它的追问
  问题），以及一个 `side: 'left' | 'right'`，仅对 `rootQ` 的直接子节点
  有意义。更深层的 `A` 隐式地继承所在一级祖先的 side（它们就长在那侧
  子树里）。

`rootQ → 一级 A` 的边没有 label。`A → A` 的边带 label，内容是子节点的
`parentEdgeLabel`。

## 整体形态

- 单根：水平铺开的思维导图，根节点居中，左右两侧各长出一棵子树。两侧
  分别用 [elkjs] 独立布局，再做镜像 / 偏移拼到一起。
- 多根：每棵根树独立布局，垂直方向按固定间距堆叠。

[elkjs]: https://github.com/kieler/elkjs

## 流水线

```
layoutMultiRoot(rootIds, nodes, measuredSizes)
  └─ 对每个 root：
       layoutBalanced(rootId, nodes, measuredSizes)
         ├─ 按 node.side 把 root 的子节点切分到 left / right
         ├─ layoutOneSide(left)   ┐
         ├─ layoutOneSide(right)  ┘ 并行执行
         ├─ 把 left 那一侧沿 x = 0 镜像
         ├─ 两侧分别往外偏移，避开 root 节点
         └─ 生成 React Flow 的 nodes 和 edges
```

### 1. 尺寸估算

`sizeOf(node)` 返回 `{ width, height }`：

- 如果 `measuredSizes` 里有这个节点的真实 DOM 测量值，直接用。React Flow
  会在首次渲染后测量节点，我们把测量值回传给下一次布局，让位置和真实
  渲染一致。
- 否则用 `estimateSize`（`balanced.ts:44`）粗略估算：基于字符数推算
  高度。回退值在高度方向上故意放宽，上限是 `A_MAX_H = 500`，对应 CSS 中
  `.a-content { max-height: 440 }` 加上 padding。

正在流式输出的答案（`node.streaming && content.length < 200`）会用固定的
`300 × 380` 占位尺寸，避免布局在 token 一个个到达时反复抖动。

### 2. 单侧布局（elkjs）

`layoutOneSide(parentId, sideChildIds, ...)` 为半边树构建一个 elkjs 图：

- **节点**：所有从该侧一级子节点可达的后代（`collectSubtree`，遵守
  `collapsed` 标志），再加一个 1×1 的虚拟节点 `__side_root__`。
- **边**：
  - 虚拟根 → 每个一级子节点（无 label）
  - 子树内所有 `A → A` 边；如果子节点有 `parentEdgeLabel`，就把
    `labels: [{ text, width, height }]` 一并交给 elkjs。label 尺寸由
    `estimateLabelSize` 算出，**只用于影响节点间距**，elkjs 返回的 label
    坐标我们不再消费（见下文"label 定位"）。

为什么要有虚拟根？elkjs 的 `layered` 算法需要一个单一的源点才能稳定地
产出树形布局。真正的 root 不在 elkjs 里，而是在 `layoutBalanced` 里
等两侧返回后手动放置。

关键的 elkjs 配置（`ELK_OPTS`，`balanced.ts:8`）：

| 选项 | 作用 |
|---|---|
| `elk.algorithm: layered` | 分层布局，每个深度一列。 |
| `elk.direction: RIGHT` | 层级从左往右长；左侧后续做镜像。 |
| `elk.layered.nodePlacement.strategy: BRANDES_KOEPF` | 兄弟节点的垂直分布更均衡。 |
| `elk.edgeRouting: ORTHOGONAL` | 直角路由（视觉上与 RF 的 smooth-step 接近）。 |
| `elk.layered.spacing.nodeNodeBetweenLayers: 180` | 不同深度之间的水平间距。 |
| `elk.spacing.nodeNode: 64` | 同层兄弟之间的垂直间距。 |
| `elk.spacing.labelNode`、`elk.spacing.edgeLabel` | 给 label 预留空间，即使我们最终自己重新定位 label。 |

elkjs 返回坐标后我们做三件事：

1. 平移，让 `__side_root__` 回到 `(0, 0)`。
2. 删除虚拟节点。
3. 垂直再居中：让整个 bounding box 的中心 y 等于 `0`。这一步保证不管
   子树多不平衡，整侧子树都在 root 的垂直中心位置。

### 3. 左侧镜像

elkjs 只会从左往右布局。对左半棵树，把每个节点框沿 `x = 0` 镜像：

```
mirrorXNode(p):  p.x = -p.x - p.width
```

减 `p.width` 是因为 elkjs 给的是左上角坐标，镜像时要把整个盒子翻过去。

### 4. 拼合根 + 两侧

在 `layoutBalanced` 里：

- 根节点放在 `(-rootW/2, -rootH/2)`，使其中心为原点。
- 右侧每个节点的 x 加上 `rightOffsetX = rootW/2 + 60`。
- 左侧每个节点的 x 加上 `leftOffsetX = -rootW/2 - 60`（镜像之后已经
  在负半轴，再往左推一段）。

`60` 是 root 节点和一级子节点之间的视觉间隙。elkjs 的第一层从 `x ≈ 1`
开始（紧挨着虚拟根），这个间隙负责把 root 和两侧子树视觉上分开。

### 5. 边

边的渲染**不复用 elkjs 路由**，由注册的 edge 组件（`QEdge`）用 React Flow
重新绘制。我们只设置：

- **handle**：root 边用 `sourceHandle: 'r' | 'l'`（根的右/左侧），
  `targetHandle: 't'`（A 节点上朝向父节点那一侧的目标 handle，`ANode`
  会根据 `node.side` 选）。内部边用 `'s' → 't'`，每个 A 节点都有一个朝
  向父亲那侧的 source `'s'` 和 target `'t'`。
- **label**：子节点的 `parentEdgeLabel`，root 边为空字符串。

`QEdge` 用 `getSmoothStepPath` 画路径，并把 label 放在路径**最后一段水平
段**上（`labelX = (midX + targetX) / 2`，`labelY = targetY`）。这样 label
落在每条边独有的那一段，而不是兄弟边重叠的那条垂直主干上。我们**特意
不用** elkjs 计算的 label 坐标 —— elkjs 和 React Flow 的路由方式不同，
elkjs 的坐标在 RF 渲染出来的线上常常找不到对应位置。

### 6. 多根堆叠

`layoutMultiRoot` 对每个 root 并行跑 `layoutBalanced`，然后从上到下垒
起来：

```
cursorY = 0
对每棵 tree：
  计算该树的 [minY, maxY] 包围盒
  shift = cursorY - minY            // 把这棵树的顶部对齐到 cursor
  把每个 node.y 都加上 shift
  cursorY += (maxY - minY) + 80     // ROOT_TREE_GAP_Y
```

根树之间固定 80px 间距。堆叠只在垂直方向移动，每棵树内部的左右平衡
保持不变。

## 坐标系约定

- 原点 `(0, 0)` 在第一棵（或唯一一棵）根树的根节点中心。
- x 正向向右，y 正向向下（与 React Flow 一致）。
- `Node.position` 一律是节点框的**左上角**，符合 React Flow 的要求。

## 重新布局的触发条件

以下情况下会重跑布局：

- 节点树发生变化（增删、折叠等）。
- DOM 测量值更新（React Flow 在内容变化后会上报新的尺寸，比如长答案、
  流式输出结束等）。

具体接线见 `MindMap.tsx`。因为 `layoutBalanced` 是异步的，调用方需要做
防抖或丢弃过期结果，避免多次调度互相覆盖。

## 已知限制

- **流式输出期间用估算尺寸。** 答案还在流式输出时一律用 `300 × 380`
  占位，第一次拿到真实测量后邻居可能会有一次位移。这是有意的 —— 每个
  token 都重新布局会非常抖。
- **label 碰撞。** 两条兄弟边如果 label 都很长、垂直间距又接近，label
  可能会重叠：因为 label 的 x 是 `[midX, targetX]` 的中点，对共享同一
  source handle 的兄弟来说这个 x 是一样的。我们依赖 elkjs 的
  `spacing.labelNode` / `spacing.edgeLabel` 把兄弟节点在垂直方向拉得
  够开，实际中很少触发。
- **镜像侧用的是估算 label 宽度。** elkjs 看到的 label 尺寸只用于影响
  间距，它并不知道左侧会被镜像 —— 因为布局 x 方向对称，目前没问题，但
  如果以后要调不对称的间距选项需要留意。
