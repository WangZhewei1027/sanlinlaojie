# 微信二维码

地图合集和 Scene 共享 `lib/wechat-qr.server.ts` 的 access_token 缓存、WeChat `getwxacode` 调用和 OSS 图片缓存。`app/manage/actions/wechat-qr.ts` 检查登录及团队访问权限，`components/wechat-qr-button.tsx` 负责加载、错误和重试展示。

- 团队：`pages/index/index?organizationId=…`。
- 合集：`pages/index/index?organizationId=…&workspaceId=…`，原 workspace UUID 和已有二维码保持有效。
- 场景：`pages/index/index?organizationId=…&sceneId=…`，首页转入 `pages/scene/scene`，不修改地图选择。

图片存放于 `wechat-qrcodes/release/`；合集保持原 `org__workspace.png` 键，场景使用 `scenes/org__scene.png`。图片内容是稳定入口，缓存一年；播放接口 `no-store`，每次打开读取最近保存的数据，无需重新生成二维码。场景归档或团队归档后，已有二维码也不能继续直接预览。

环境变量：`WECHAT_APPID`、`WECHAT_APPSECRET`、OSS 配置。环境版本在 `lib/wechat-qr.ts` 中为 release。新场景预览功能需要本次小程序代码上线；本地开发用相同参数在开发者工具打开页面。生成二维码和上传小程序是不同操作。

接口测试覆盖生成权限、缓存键、参数长度、跨团队拒绝、最新保存内容和归档失效；Storybook 使用模拟回调，绝不调用真实微信服务。
