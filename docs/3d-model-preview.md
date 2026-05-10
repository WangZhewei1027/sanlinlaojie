---
title: 3D Model Preview
created: 2026-05-10
updated: 2026-05-10
---

# 3D Model Preview

`AssetModelPreview` 是资产编辑器中用于预览 glTF / GLB 格式三维模型的组件，基于 **React Three Fiber** 和 **@react-three/drei** 实现。

## 功能

| 功能 | 说明 |
|------|------|
| glTF / GLB 加载 | 通过 `useGLTF` 加载远程模型文件，支持 Draco 压缩 |
| 自动适配视角 | 首次加载及切换资产时，根据模型包围盒自动调整相机距离与朝向，模型始终居中填满预览区 |
| 动画自动播放 | 若模型内嵌动画剪辑，所有动画以 `LoopRepeat` 模式自动循环播放 |
| 交互控制 | `OrbitControls`：鼠标拖拽旋转、滚轮缩放，禁用平移（`enablePan={false}`） |
| 环境光照 | 使用 `Environment preset="city"` 提供 HDR 环境光，辅以环境光与平行光 |

## 文件位置

```
app/manage/components/AssetEditor/AssetModelPreview.tsx
```

## 组件接口

```ts
interface AssetModelPreviewProps {
  fileUrl: string;   // 模型文件的远程 URL（glTF / GLB）
  fileName: string;  // 文件名，显示在预览区下方
}
```

## 自动适配视角原理

切换 `fileUrl` 时触发以下计算：

1. 用 `THREE.Box3.setFromObject` 计算模型的轴对齐包围盒（AABB）
2. 取包围盒三轴尺寸的最大值 `maxDim`
3. 根据相机垂直 FOV 计算合适的观察距离：

$$
d = \frac{maxDim / 2}{\tan(fov / 2)} \times 1.5
$$

4. 将相机放置在模型中心正前方距离 $d$ 处，`near = d / 100`，`far = d \times 100`
5. 将 `OrbitControls.target` 设置为模型中心，保证旋转轴心正确

## 动画播放逻辑

```
加载模型
  └── animations.length > 0 ?
        ├── 是：对所有 AnimationAction 调用 setLoop(LoopRepeat, Infinity).play()
        └── 否：静态模型，无动画播放
组件卸载时：对所有 action 调用 stop()
```

## 依赖

| 包 | 用途 |
|----|------|
| `@react-three/fiber` | React 的 Three.js 渲染器 |
| `@react-three/drei` | `useGLTF`、`useAnimations`、`OrbitControls`、`Environment` |
| `three` | 包围盒、向量、动画循环常量等底层类型 |
