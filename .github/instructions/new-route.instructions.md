## 路径解释：

- /admin
  - 这页是 admin dashboard，可以看我有哪些功能可以访问
  - 页面描述：现在规划两个模块：1. workspace 管理（区域限制，地图模型选择）；2. 具体的资源管理（与 student 的 manage 界面通用。用 role 区分权限）；3. 把用户添加到 workspace
- /admin/workspace
  - 可以管理 workspace（新建，编辑，删除）
- /upload-onsite
  - 现场上传平台
  - 根据用户当前的 gps 位置上传
- /display
  - 采集成果展示平台
  - 界面描述：和 manage 大致相同。隐藏一些管理 ui。
- /manage
  - 界面描述：整体是 3d 地图界面。右侧有可管理的资源（通过用户权限分配）
    - 关于权限：admin 可以切换所有 workspace；student 只能访问被 assigned 的 workspace，能查看当前 workspace 下的所有资源，但是只能修改自己的资源。
  - 功能：
    - 可以上传新资源
    - 可以管理和编辑现有资源
- /sign-up
  - 学生可以随便 sign-up
  - admin 需要一个 key 才能 sign up
- /web-ar
  - zappar 做的页面，如果手机不带雷达回退到这个页面
  - 另一个选项是侧载应用

## 角色权限：

admin：

- 可以新建 workspace
- 可以管理任意 worksapce 下的所有文件

student：

- 可以进入被 assigned 的 workspace
- 可以在这个 workspace 下上传
- 可以管理自己的 assets
