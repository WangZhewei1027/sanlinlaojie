# 小程序配置修复记录

## 修复日期
2025-12-28

## 问题诊断

根据微信小程序 XR-Frame 官方文档的要求，项目存在以下配置问题导致无法启动：

### 1. ✅ project.config.json 缺少必要配置
**问题：** 
- 缺少 `ignoreDevUnusedFiles: false`
- 缺少 `ignoreUploadUnusedFiles: false`

**原因：**
文档明确要求："因为是包内的json文件，所以需要在project.config.json的setting字段中增加 `ignoreDevUnusedFiles: false`和`ignoreUploadUnusedFiles: false`配置参数！"

**修复：**
在 `project.config.json` 的 `setting` 字段中添加了这两个配置项。

### 2. ✅ 基础库版本设置为 trial
**问题：**
- `libVersion` 设置为 `"trial"` 而非具体版本号

**原因：**
文档要求："xr-frame在基础库v2.32.0开始基本稳定"

**修复：**
将 `libVersion` 修改为 `"2.32.0"`

### 3. ✅ pages/ar/ar.json 配置错误
**问题：**
- 页面配置文件中包含 `"renderer": "webview"`

**原因：**
- 页面本身不需要设置 renderer
- renderer 只应在使用 xr-frame 的组件配置文件中设置
- 页面通过引用组件来使用 xr-frame

**修复：**
移除了 `"renderer": "webview"` 配置项

### 4. ✅ pages/index/index.json 配置错误
**问题：**
- 首页配置文件错误地设置了 `"component": true` 和 `"renderer": "xr-frame"`
- 这导致页面被识别为组件而非页面

**原因：**
- index 是一个普通页面，不是 xr-frame 组件
- 只有实际使用 xr-frame 的自定义组件才需要设置 renderer

**修复：**
将配置简化为标准页面配置：
```json
{
  "usingComponents": {},
  "navigationBarTitleText": "三林老街AR"
}
```

## 正确的配置结构

### 组件配置（components/xr-ar-scene/index.json）
```json
{
  "component": true,
  "renderer": "xr-frame",
  "usingComponents": {}
}
```

### 页面配置（pages/ar/ar.json）
```json
{
  "usingComponents": {
    "xr-ar-scene": "../../components/xr-ar-scene/index"
  },
  "disableScroll": true,
  "navigationBarTitleText": "AR场景"
}
```

### 项目配置（project.config.json - 关键部分）
```json
{
  "libVersion": "2.32.0",
  "setting": {
    ...
    "ignoreDevUnusedFiles": false,
    "ignoreUploadUnusedFiles": false
  }
}
```

### 应用配置（app.json - 关键部分）
```json
{
  "lazyCodeLoading": "requiredComponents"
}
```

## 配置要点总结

1. **渐进式架构**
   - 只在实际使用 xr-frame 的组件中设置 `"renderer": "xr-frame"`
   - 页面通过 `usingComponents` 引用 xr-frame 组件
   - 不在页面配置中直接设置 renderer

2. **资源加载配置**
   - 必须在 app.json 中设置 `"lazyCodeLoading": "requiredComponents"`
   - 必须在 project.config.json 的 setting 中设置 `ignoreDevUnusedFiles: false`
   - 必须在 project.config.json 的 setting 中设置 `ignoreUploadUnusedFiles: false`

3. **基础库版本**
   - 至少需要 v2.32.0
   - 某些功能（如前置相机）需要更高版本

## 下一步操作

1. 在微信开发者工具中重新打开项目
2. 清理项目缓存（工具 -> 清除缓存）
3. 重新编译
4. 如遇到其他错误，请查看控制台具体错误信息

## 参考文档
- XR-Frame 官方文档：https://developers.weixin.qq.com/miniprogram/dev/component/xr-frame.html
- 开始指南：上文提供的完整开发指南
