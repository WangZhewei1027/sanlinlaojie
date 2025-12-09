# Cesium 3D Viewer - 模块化架构

这是一个使用 CesiumJS 构建的 3D 地形查看器，已按功能模块进行重构。

## 📁 文件结构

```
public/js/viewer/
├── index.html              # HTML 入口文件
├── styles.css              # 样式文件
├── app.js                  # 主应用入口（已重构）
├── config.js               # 配置管理模块
├── coordinateUtils.js      # 坐标转换工具
├── viewerManager.js        # Viewer 管理和相机控制
├── assetManager.js         # 资产显示和管理
├── messageHandler.js       # 跨窗口消息通信
├── clickHandler.js         # 地图点击事件处理
├── tilesetLoader.js        # 3D Tiles 加载器
└── terra_b3dms/           # 3D Tiles 数据
```

## 🏗️ 模块说明

### 1. **config.js** - 配置管理
集中管理所有配置项：
- Cesium Ion Token
- 元数据（坐标系统、原点）
- 3D Tiles 配置
- Viewer 配置
- 相机配置
- Billboard 配置
- 标记样式配置

### 2. **coordinateUtils.js** - 坐标转换
提供坐标转换工具函数：
- `utm51NToWGS84()` - UTM Zone 51N 转 WGS84
- `getOriginCoordinates()` - 获取原点坐标
- `lonLatToCartesian()` - 经纬度转笛卡尔坐标
- `cartesianToLonLat()` - 笛卡尔坐标转经纬度

### 3. **viewerManager.js** - Viewer 管理
管理 Cesium Viewer 实例和相机：
- `initViewer()` - 初始化 Viewer
- `getViewer()` - 获取 Viewer 实例
- `resetCamera()` - 重置相机
- `flyTo()` - 飞行到指定位置
- `zoomToTileset()` - 缩放到 tileset

### 4. **assetManager.js** - 资产管理
管理地图上的资产标记：
- `displayAssets()` - 显示资产列表
- `clearAssetBillboards()` - 清除资产标记
- `focusOnAsset()` - 聚焦到指定资产
- `clearFocusMarker()` - 清除聚焦标记
- `getAssetBillboards()` - 获取所有资产标记

### 5. **messageHandler.js** - 消息通信
处理 iframe 跨窗口通信：
- `setupMessageListener()` - 设置消息监听器
- `sendMessageToParent()` - 发送消息给父窗口
- `sendLocationClicked()` - 发送位置点击事件

**支持的消息类型：**
- `SET_ASSETS` - 设置要显示的资产
- `FOCUS_ASSET` - 聚焦到指定资产
- `LOCATION_CLICKED` - 位置被点击（发出）

### 6. **clickHandler.js** - 点击处理
处理地图点击事件：
- `setupClickHandler()` - 设置点击事件监听
- `clearClickMarker()` - 清除点击标记
- `getClickMarker()` - 获取当前点击标记

### 7. **tilesetLoader.js** - 3D Tiles 加载
加载和管理 3D Tiles：
- `load3DTiles()` - 加载 3D Tiles
- `getTileset()` - 获取 tileset 实例
- `unloadTileset()` - 卸载 tileset

### 8. **app.js** - 主应用
协调所有模块，应用入口点：
- 设置 Cesium Ion Token
- 初始化各个模块
- 暴露全局函数（如 `resetCamera`）

## 🚀 使用方式

### 基本使用

```javascript
// app.js 已经处理了初始化流程
// 页面加载时会自动：
// 1. 初始化 Viewer
// 2. 设置消息监听
// 3. 设置点击事件
// 4. 加载 3D Tiles
```

### 发送消息到 Viewer

```javascript
// 从父窗口发送消息到 viewer iframe
iframe.contentWindow.postMessage({
  type: "SET_ASSETS",
  payload: [
    {
      id: "asset-1",
      file_type: "image",
      file_url: "https://example.com/image.jpg",
      metadata: {
        longitude: 123.456,
        latitude: 31.123,
        height: 100
      }
    }
  ],
  source: "manage",
  version: 1
}, "*");
```

### 聚焦到资产

```javascript
iframe.contentWindow.postMessage({
  type: "FOCUS_ASSET",
  payload: {
    id: "asset-1",
    longitude: 123.456,
    latitude: 31.123,
    height: 100
  },
  source: "manage",
  version: 1
}, "*");
```

### 监听位置点击

```javascript
// 在父窗口监听
window.addEventListener("message", (event) => {
  if (event.data?.source === "viewer" && event.data?.type === "LOCATION_CLICKED") {
    const { longitude, latitude, height } = event.data.payload;
    console.log("用户点击了:", longitude, latitude, height);
  }
});
```

## 🎯 重构优势

1. **模块化** - 每个模块职责单一，易于维护
2. **可测试性** - 模块独立，便于单元测试
3. **可重用性** - 模块可在其他项目中复用
4. **可扩展性** - 添加新功能时不影响现有模块
5. **可读性** - 代码组织清晰，易于理解
6. **配置集中** - 所有配置在 config.js 中统一管理

## 🔧 配置修改

需要修改配置时，只需编辑 `config.js`：

```javascript
// 修改 Cesium Ion Token
export const CESIUM_ION_TOKEN = "your-token-here";

// 修改相机默认俯仰角
export const CAMERA_CONFIG = {
  defaultPitch: -60, // 改为 -60 度
  // ... 其他配置
};
```

## 📦 依赖

- CesiumJS 1.111+
- 支持 ES6 模块的现代浏览器

## 🔄 与原代码对比

**原代码：**
- 单文件 ~500 行
- 全局变量和函数
- 配置硬编码
- 难以维护和测试

**重构后：**
- 8 个模块化文件
- 清晰的依赖关系
- 配置集中管理
- 易于维护和扩展
