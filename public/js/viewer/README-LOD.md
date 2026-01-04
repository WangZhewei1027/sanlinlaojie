# LOD (Level of Detail) 功能说明

## 概述

LOD（细节层次）功能已经集成到Viewer中，可以根据相机距离自动切换渲染内容：
- **远距离（>300米）**：显示为彩色小点
- **近距离（<150米）**：显示完整的详细内容（图标+文本）
- **中间范围（150-300米）**：保持当前状态，避免频繁切换

## 配置

在 `src/utils/config.js` 中可以调整LOD配置：

```javascript
export const LOD_CONFIG = {
  farThreshold: 300,    // 远距离阈值（米）
  nearThreshold: 150,   // 近距离阈值（米）
  dotSize: 16,          // 点的大小（像素）
  dotPadding: 2,        // 点的边距
};
```

## 实现原理

### 1. 颜色编码
不同资产类型使用不同颜色的点：
- 🟠 Anchor（锚点）- 金色 (#f59e0b)
- 🟣 Audio（音频）- 紫色 (#a855f7)
- ⚫ Link（链接）- 灰色 (#6b7280)
- 🔵 Image（图片）- 蓝色 (#3b82f6)
- 🟢 Text（文本）- 绿色 (#10b981)

### 2. 自动切换
- 监听相机移动事件（`camera.moveEnd`）
- 计算相机到每个实体的距离
- 根据距离自动切换显示内容
- 中间范围保持当前状态，避免闪烁

### 3. 性能优化
- 初始加载时使用点显示（快速渲染）
- 仅在相机停止移动时更新LOD
- 避免频繁切换（使用hysteresis机制）

## 主要文件

- **src/utils/lodManager.js** - LOD核心逻辑
  - `createDotCanvas()` - 创建点显示
  - `createDetailCanvas()` - 创建详细显示
  - `updateEntityLOD()` - 更新单个实体
  - `updateAllLODs()` - 批量更新

- **src/managers/assetManager.js** - 集成LOD
  - `createBillboard()` - 创建billboard时初始化为点
  - `startLODUpdate()` - 启动LOD更新
  - `stopLODUpdate()` - 停止LOD更新

## 使用方式

LOD功能是自动启用的，无需手动调用：

1. 调用 `displayAssets(assets)` 显示资产
2. LOD自动启动，监听相机移动
3. 相机移动后自动切换显示内容
4. 调用 `clearAssetBillboards()` 时自动停止LOD

## 测试方法

1. 打开viewer: `http://localhost:3000/js/viewer/`
2. 加载包含资产的数据
3. 缩放相机：
   - 拉远视角（>300米）- 观察资产变成彩色小点
   - 拉近视角（<150米）- 观察资产显示详细内容
4. 控制台会输出LOD切换日志

## 调试

在浏览器控制台中可以看到LOD切换日志：
```
切换LOD: asset-123, 距离: 350.2m, detail -> dot
切换LOD: asset-456, 距离: 120.5m, dot -> detail
```

## 自定义

可以通过修改以下内容自定义LOD行为：

1. **调整距离阈值** - 修改 `LOD_CONFIG`
2. **更改点的颜色** - 修改 `lodManager.js` 中的 `colorMap`
3. **调整点的大小** - 修改 `LOD_CONFIG.dotSize`
4. **添加更多LOD级别** - 扩展 `getLODLevel()` 函数
