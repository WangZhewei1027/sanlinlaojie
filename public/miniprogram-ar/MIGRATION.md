# AR-NEW 迁移到微信小程序 XR-Frame

## 迁移概述

本项目将 `ar-new` 从 Zappar 框架迁移到微信小程序的 XR-Frame 框架。

## 已完成的工作

### 1. 页面结构创建 ✅
- 创建了 `pages/ar/` 目录，包含完整的小程序页面文件
  - `ar.wxml` - WXML模板，使用xr-frame组件
  - `ar.wxss` - 样式文件
  - `ar.js` - 页面逻辑
  - `ar.json` - 页面配置

### 2. 核心服务迁移 ✅

#### AssetService (`utils/assetService.js`)
- 从Zappar的Web环境迁移到小程序环境
- 使用 `wx.request` 替代 Supabase JS SDK
- 保留了所有原有功能：
  - 获取附近素材 (`fetchNearbyAssets`)
  - 按Anchor获取素材 (`fetchAssetsByAnchor`)
  - 按最近Anchor获取素材 (`fetchAssetsByNearestAnchor`)
  - 获取Anchor列表 (`fetchAnchors`)

#### LocationManager (`utils/locationManager.js`)
- 从 `navigator.geolocation` 迁移到 `wx.getLocation`
- 使用定时器模拟 `watchPosition` 功能
- 保留了位置变化检测和阈值触发机制

### 3. 内容渲染器创建 ✅

#### ARContentRenderer (`utils/arContentRenderer.js`)
- 从Three.js的Mesh创建迁移到xr-frame的节点系统
- 支持三种内容类型：
  - **图片** - 使用 `xr-image` 组件
  - **文字** - 使用 `xr-mesh` 创建文字背景卡片
  - **音频** - 使用球体可视化表示音频位置

### 4. UI控制面板 ✅
- 实现了三种获取模式：
  - 📍 附近素材
  - 🎯 最近Anchor
  - 🔗 指定Anchor
- 添加了重置按钮
- 状态指示器
- 加载动画

### 5. 小程序配置 ✅
- 配置了位置权限 (`scope.userLocation`)
- 添加了xr-frame插件
- 设置了页面路由
- 配置了必要的隐私权限

## 技术差异对比

### 框架对比
| 功能 | Zappar (ar-new) | XR-Frame (miniprogram-ar) |
|------|-----------------|---------------------------|
| 3D渲染 | Three.js | xr-frame组件系统 |
| AR追踪 | InstantWorldTracker | xr-ar-tracker (Plane模式) |
| 位置获取 | navigator.geolocation | wx.getLocation |
| 数据请求 | Supabase JS SDK | wx.request |
| 环境 | Web浏览器 | 微信小程序 |

### 核心功能对比
| 功能 | Zappar实现 | XR-Frame实现 |
|------|-----------|--------------|
| 场景创建 | THREE.Scene | xr-scene |
| 相机 | ZapparThree.Camera | xr-camera (is-ar-camera) |
| 图片显示 | THREE.Mesh + TextureLoader | xr-image |
| 文字显示 | Canvas生成纹理 | xr-mesh + 自定义纹理 |
| 音频可视化 | THREE.Mesh (球体) | xr-mesh (sphere) |
| 位置计算 | 相同（Haversine公式） | 相同 |

## 待完善的功能

### 1. 文字渲染优化 ⚠️
当前实现：只创建了背景平面
建议改进：
- 使用小程序Canvas API生成文字纹理
- 将纹理应用到xr-mesh上
- 支持多行文字和自适应尺寸

### 2. 音频播放功能 ⚠️
当前实现：只有可视化球体
建议添加：
- 使用 `wx.createInnerAudioContext()` 播放音频
- 添加3D空间音频效果（如果xr-frame支持）
- 添加播放控制UI

### 3. Supabase集成 ⚠️
当前实现：使用 `wx.request` 直接调用RPC
建议改进：
- 考虑使用 `@supabase/supabase-js` 的小程序版本
- 或者创建云函数作为中间层

### 4. 动态节点创建 ⚠️
当前实现：使用scene.createElement（API可能不完全正确）
需要确认：
- xr-frame的正确动态节点创建方式
- 节点的生命周期管理
- 性能优化

### 5. AR内容定位算法 ⚠️
当前实现：简单的平面近似
可以改进：
- 考虑地球曲率的精确计算
- 高度（海拔）的准确处理
- 指南针方向的整合

## 使用说明

### 前置要求
1. 微信开发者工具
2. 已配置的微信小程序AppID
3. 开通位置权限
4. 开通xr-frame插件权限

### 运行步骤
1. 打开微信开发者工具
2. 导入 `public/miniprogram-ar` 目录
3. 在 `project.config.json` 中配置你的AppID
4. 点击"编译"运行
5. 首页点击进入AR页面（或直接访问 `pages/ar/ar`）

### 测试注意事项
- 需要在真机上测试（模拟器不支持AR功能）
- 确保手机定位功能已开启
- 需要授权位置权限
- 需要在有AR素材的地理位置附近测试

## 数据库要求

确保Supabase数据库有以下RPC函数：
- `get_nearby_assets(user_lat, user_lng, max_distance_meters, workspace_name)`
- `get_assets_by_anchor(anchor_id, workspace_name)`
- `get_assets_by_nearest_anchor(user_lat, user_lng, max_distance_meters, workspace_name)`
- `get_anchors(workspace_name)`

## 文件结构

```
miniprogram-ar/
├── pages/
│   └── ar/
│       ├── ar.wxml        # AR页面模板
│       ├── ar.wxss        # AR页面样式
│       ├── ar.js          # AR页面逻辑
│       └── ar.json        # AR页面配置
├── utils/
│   ├── assetService.js    # 资产服务
│   ├── locationManager.js # 位置管理器
│   └── arContentRenderer.js # 内容渲染器
├── app.json               # 小程序配置
├── app.js                 # 小程序入口
└── project.config.json    # 项目配置
```

## 下一步计划

1. **优化文字渲染**
   - 实现Canvas文字纹理生成
   - 支持富文本和样式

2. **完善音频功能**
   - 集成音频播放
   - 添加播放控制

3. **性能优化**
   - 实现内容分页加载
   - 添加距离裁剪（只显示附近的内容）
   - 优化节点创建和销毁

4. **用户体验改进**
   - 添加引导动画
   - 优化加载状态
   - 添加错误处理和提示

5. **功能扩展**
   - 支持视频素材
   - 支持3D模型（GLTF）
   - 添加交互功能（点击、缩放等）

## 已知问题

1. xr-frame的动态节点创建API需要验证
2. 文字渲染需要完整实现
3. 音频播放功能未实现
4. 需要在真机上测试AR追踪效果
5. Supabase请求可能需要配置合法域名

## 相关文档

- [微信小程序xr-frame文档](https://developers.weixin.qq.com/miniprogram/dev/framework/xr-frame/)
- [微信小程序位置API](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html)
- [Supabase文档](https://supabase.com/docs)

## 联系方式

如有问题，请参考原ar-new项目的实现逻辑。
