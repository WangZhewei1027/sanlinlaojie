# 快速开始指南

## 🚀 快速开始

### 1. 打开项目
使用微信开发者工具打开 `public/miniprogram-ar` 目录

### 2. 配置AppID
在微信开发者工具中，点击右上角"详情" -> 基本信息，填入你的AppID。
如果没有AppID，可以点击"使用测试号"进行开发。

### 3. 配置合法域名
在微信公众平台（mp.weixin.qq.com）配置以下域名：

**request合法域名：**
```
https://mkdfezaufjhrfjkfqlbj.supabase.co
```

**注意：** 在开发阶段，可以在微信开发者工具中勾选"不校验合法域名"来跳过此步骤。

### 4. 启用xr-frame插件
1. 在微信公众平台 -> 设置 -> 第三方设置 -> 插件管理
2. 添加插件：xr-frame (appid: wx3c042630f3fdb3c6)
3. 等待审核通过

### 5. 编译运行
1. 点击开发者工具顶部的"编译"按钮
2. 在模拟器中会看到首页
3. 点击导航到AR页面

### 6. 真机调试
AR功能需要在真机上测试：
1. 点击开发者工具顶部的"预览"按钮
2. 使用微信扫描二维码
3. 在手机上打开小程序
4. 授权位置权限
5. 进入AR页面开始体验

## 📋 功能测试清单

### 基础功能
- [ ] 页面加载正常
- [ ] AR场景初始化成功
- [ ] 位置权限授权成功
- [ ] 控制面板显示正常

### 数据获取
- [ ] 附近素材模式：能获取到附近的AR内容
- [ ] 最近Anchor模式：能找到最近的Anchor并获取内容
- [ ] 指定Anchor模式：能选择Anchor并获取对应内容

### AR渲染
- [ ] 图片素材正常显示
- [ ] 文字素材正常显示（背景卡片）
- [ ] 音频素材正常显示（蓝色球体）

### 交互功能
- [ ] 模式切换正常工作
- [ ] Anchor选择器正常工作
- [ ] 重置按钮能清除内容并重新加载

## ⚠️ 常见问题

### 1. 无法获取位置
**原因：** 没有授权位置权限
**解决：** 在手机设置中打开微信的位置权限，或者在小程序中重新授权

### 2. 获取不到素材
**原因：** 
- 数据库中没有素材数据
- 距离素材太远（超过50米）
- RPC函数未正确配置

**解决：** 
- 检查数据库中是否有数据
- 移动到素材附近
- 检查Supabase中的RPC函数

### 3. AR场景黑屏
**原因：** 
- 相机权限未授权
- xr-frame插件未正确配置

**解决：** 
- 授权相机权限
- 检查app.json中的插件配置
- 确保在真机上测试

### 4. 请求失败
**原因：** 
- 合法域名未配置
- Supabase URL或Key错误

**解决：** 
- 配置request合法域名
- 或在开发阶段勾选"不校验合法域名"
- 检查 `utils/assetService.js` 中的配置

### 5. xr-frame组件未注册
**原因：** 插件未启用或版本不对

**解决：** 
- 在微信公众平台添加xr-frame插件
- 检查 `app.json` 中的plugins配置
- 尝试修改version为具体版本号

## 🔧 开发配置

### 本地开发
在开发者工具中勾选以下选项：
- ✅ 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
- ✅ 启用调试

### 打印日志
代码中已添加详细的console.log，可以在控制台查看：
- 📍 位置更新日志
- 🔍 数据获取日志
- 🖼️ 内容渲染日志
- ❌ 错误日志

### 数据库测试
可以使用以下SQL在Supabase中创建测试数据：

```sql
-- 创建测试workspace
INSERT INTO workspace (name) VALUES ('sanlinlaojie');

-- 创建测试anchor
INSERT INTO asset (
  workspace_id, 
  file_type, 
  text_content,
  metadata
) VALUES (
  (SELECT id FROM workspace WHERE name = 'sanlinlaojie'),
  'anchor',
  NULL,
  jsonb_build_object(
    'name', '测试Anchor',
    'latitude', 31.1948,
    'longitude', 121.5336,
    'altitude', 0
  )
);

-- 创建测试图片素材
INSERT INTO asset (
  workspace_id,
  file_type,
  file_url,
  metadata
) VALUES (
  (SELECT id FROM workspace WHERE name = 'sanlinlaojie'),
  'image',
  'https://example.com/test.jpg',
  jsonb_build_object(
    'latitude', 31.1948,
    'longitude', 121.5336,
    'altitude', 0
  )
);
```

## 📱 推荐测试流程

1. **首先在模拟器测试基础功能**
   - UI界面正常
   - 数据请求正常
   - 逻辑流程正常

2. **然后在真机测试AR功能**
   - 位置获取
   - AR场景渲染
   - 内容显示

3. **最后在实地测试完整流程**
   - 到有AR内容的地点
   - 测试附近素材模式
   - 测试Anchor模式

## 🎯 下一步

迁移已完成基础功能，你可以：

1. **优化功能**
   - 完善文字渲染（使用Canvas生成纹理）
   - 添加音频播放功能
   - 优化AR内容定位算法

2. **增强体验**
   - 添加引导动画
   - 优化加载状态
   - 添加手势交互

3. **扩展功能**
   - 支持视频素材
   - 支持3D模型
   - 添加社交分享

详细的迁移说明和待完善功能请查看 [MIGRATION.md](./MIGRATION.md)
