# UI 工程化第一阶段 Handover

> 文档用途：交给另一个全站项目的开发者或 AI，先实践 UI 工程化第一阶段。
>
> 文档状态：本地 handover，不属于 Kiwi 或其他项目的 Git 仓库。
>
> 核心原则：第一阶段只建立安全网和组件实验环境，不做全站视觉重设计。

---

## 1. 任务背景

我们希望逐步建设一套工程级 UI 体系，最终包含：

- 可复用设计系统
- Storybook 组件实验和文档环境
- 自动测试、无障碍检查和质量门禁
- 可被开发者与 AI 共同遵守的 UI 规范
- 渐进式页面迁移机制

由于目标项目可能已经承载完整业务，第一阶段不能大规模修改页面，也不能顺手重构业务逻辑。第一阶段的任务是验证方法本身：先建立可信的工程安全网，再引入最小 Storybook 底座，并用少量现有组件证明整套工作流可行。

## 2. 本阶段最终目标

完成后，项目应具备以下能力：

1. 有明确且可重复执行的 typecheck、lint、unit test、application build。
2. 上述检查进入 CI，不能再只依赖“打包成功”。
3. Storybook 可以在没有真实后端的情况下独立运行和构建。
4. Storybook 使用与正式应用一致的 Theme、全局样式和基础 Provider。
5. 至少一组 Theme/基础控件状态矩阵，以及 6–10 个代表性组件 stories。
6. Auth、Router、State、API mock 有统一方法，不在每个 story 中重复搭建。
7. 项目内有第一版 UI 架构说明、Storybook 使用说明和 AI 规则。
8. 整个阶段不改变产品视觉方向和核心业务行为。

## 3. 成功标准

成功不是“Storybook 页面能够打开”，而是：

- 新开发者能够独立运行 Storybook。
- 一个组件可以在不登录、不启动后端的情况下展示关键状态。
- Theme 修改能够在集中状态矩阵中被检查。
- PR 会自动检查类型、测试、lint、应用构建和 Storybook 构建。
- 公共组件有明确的 story 责任。
- 第一阶段没有制造平行 UI、重复 Theme 或大量页面改动。

## 4. 明确不在本阶段做的事项

执行者不得把以下事项混入第一阶段：

- 不重新设计品牌、颜色、字体或视觉风格。
- 不全仓替换硬编码颜色。
- 不重写导航、权限、认证或路由架构。
- 不拆解最复杂的业务页面作为第一个 Storybook 示例。
- 不用 Storybook mock 复制整个后端。
- 不引入第二套生产组件库与现有 UI 框架竞争。
- 不因为类型或测试失败而关闭 strict、批量 skip 测试或排除手写源码。
- 不全仓运行自动格式化。
- 不修改生成代码。
- 不在同一个 PR 同时完成工具链、设计系统和页面重构。
- 不在第一阶段强制视觉回归作为阻断门禁；先建立稳定 stories。

## 5. 交接给执行者的任务指令

可将以下内容直接复制给负责实施的开发者或 AI：

> 请先只读调查目标项目，确认项目指南、Git 状态、技术栈、运行命令、测试现状、Theme、Provider、路由、API 层和生成代码边界。保护已有未提交修改。
>
> 第一阶段只建设 UI 工程安全网和 Storybook 底座，不进行视觉重设计，不大规模迁移页面，不改变核心业务行为。
>
> 按本文档规定的顺序实施。每个工作包使用独立、小范围 PR。任何时候发现需要更改认证、权限、API 契约、路由语义或大量页面时，停止扩展范围并报告。
>
> 最终必须提供：基线报告、质量脚本、CI、Storybook、统一 providers/mocks、首批 stories、使用文档、AI 规则和验收结果。

## 6. 开始前需要收集的信息

执行者应先填写下面的信息，不要直接安装 Storybook。

### 6.1 仓库信息

- 项目根目录：`<PROJECT_ROOT>`
- 默认分支：`<DEFAULT_BRANCH>`
- 包管理器：npm / pnpm / yarn / bun
- Node 版本：`<NODE_VERSION>`
- 是否 monorepo：是 / 否
- 是否有项目级 AGENTS.md、CLAUDE.md 或贡献指南：`<PATHS>`
- 是否有未提交修改：`<GIT_STATUS>`
- 哪些目录是生成代码：`<GENERATED_PATHS>`

### 6.2 前端技术栈

- React/Vue/Svelte/其他：`<FRAMEWORK>`
- Vite/Next.js/其他构建工具：`<BUILD_TOOL>`
- TypeScript 配置：`<TSCONFIG>`
- UI 框架：MUI / Ant Design / Tailwind / 自研 / 其他
- Theme 入口：`<THEME_PATH>`
- 全局 CSS 入口：`<GLOBAL_CSS_PATH>`
- Router：`<ROUTER>`
- State：`<STATE_MANAGEMENT>`
- Auth Provider：`<AUTH_PROVIDER>`
- API Client：`<API_CLIENT>`
- 测试框架：`<TEST_FRAMEWORK>`

### 6.3 当前命令

- install：`<INSTALL_COMMAND>`
- dev：`<DEV_COMMAND>`
- build：`<BUILD_COMMAND>`
- typecheck：`<TYPECHECK_COMMAND>`
- lint：`<LINT_COMMAND>`
- test：`<TEST_COMMAND>`
- coverage：`<COVERAGE_COMMAND>`
- CI 配置：`<CI_PATHS>`

## 7. 安全边界

### 7.1 Git 安全

- 开工前和每次任务切换前运行 `git status --short`。
- 不覆盖、不格式化、不暂存用户已有修改。
- 不使用 `git reset --hard`、`git checkout --` 或其他破坏性命令。
- 每个 PR 只包含本工作包相关文件。
- 生成构建产物必须被 `.gitignore` 排除。

### 7.2 业务安全

- 默认不修改 API request/response 结构。
- 默认不修改权限判断。
- 默认不修改 URL、路由参数和导航目标。
- 默认不修改表单校验语义。
- 默认不修改 analytics、埋点和审计行为。
- 如果修测试必须改变上述行为，先提交原因和影响分析。

### 7.3 UI 安全

- 不做全局 Theme override，除非先有状态矩阵覆盖受影响组件。
- 不将 page-specific 样式直接提升为全局规则。
- 不为了 Storybook 而修改生产组件 API，除非该修改本身合理且有测试。
- 不将生产密钥、真实 token 或真实账号数据放入 stories。

## 8. 推荐实施顺序

```text
WP0 只读调查与基线
  ↓
WP1 TypeScript 与 build 基线
  ↓
WP2 测试基线与统一 render helpers
  ↓
WP3 Lint、format 和本地统一命令
  ↓
WP4 CI 质量门禁
  ↓
WP5 Storybook 最小安装
  ↓
WP6 Providers 与 Mock 体系
  ↓
WP7 首批 Characterization Stories
  ↓
WP8 文档、AI 规则与最终验收
```

不得跳过 WP0 直接执行 Storybook 初始化器。初始化器可能批量改配置、脚本和依赖，必须先知道项目边界。

---

## 9. WP0：只读调查与基线

### 9.1 目标

建立可信的现状记录，识别不能被 Storybook 承载或掩盖的问题。

### 9.2 调查内容

#### 项目结构

- 页面、组件、feature、hooks、services、providers 的组织方式。
- 是否已有 design tokens、Theme、CSS variables。
- 是否已有共享组件，但实际页面绕过它们。
- 是否存在多个 UI 框架或图标库。
- 是否存在超大页面和高耦合组件。

#### 样式债务

统计：

- 组件文件数。
- inline style / `sx` / utility classes 数量。
- 硬编码颜色数量。
- Theme 使用率。
- CSS modules、global CSS、CSS-in-JS 的分布。
- 已有 shared component 的使用率。

#### 质量工具

- TypeScript 是否真的由 CI 执行。
- build 是否包含 typecheck。
- 测试数量和失败数量。
- lint 是否存在、是否阻断。
- 是否有覆盖率阈值。
- 是否有 E2E、a11y、visual regression。

#### 测试含金量

至少区分：

- 只检查 render。
- props 和 callback。
- 样式实现细节。
- 页面 mock 流程。
- 纯业务逻辑。
- 真实集成或 E2E。

### 9.3 必须记录的基线

```text
Git status:
Install:
Typecheck result:
Lint result:
Unit test result:
Application build result:
Current bundle warnings:
Existing Storybook:
Existing E2E:
Existing a11y automation:
```

### 9.4 交付物

- `phase-1-baseline.md` 或等价 issue/PR 描述。
- 问题按 P0/P1/P2 分类。
- 明确生成代码和禁止修改目录。
- 明确第一阶段的风险与非目标。

### 9.5 退出条件

- 所有基础命令都实际执行过，不能只相信 README。
- 当前失败可以重复得到。
- 已识别已有工作区修改。
- 已确认 Storybook 应挂载的真实 Theme 和 Providers。

---

## 10. WP1：TypeScript 与 Build 基线

### 10.1 目标

确保“应用能打包”和“源码类型正确”不再是两个互不相关的事实。

### 10.2 工作内容

- 增加或修正 `typecheck` script。
- 校准 TypeScript module/moduleResolution 与构建工具。
- 先处理配置造成的大批同类错误，再处理真实错误。
- 给第三方库建立局部 adapter，而不是关闭全局检查。
- 检查生成代码是否需要单独 tsconfig 或合理 exclude。
- 保证 application build 仍然通过。

### 10.3 框架适配

#### Vite

通常检查：

```json
{
  "module": "ESNext",
  "moduleResolution": "Bundler"
}
```

不要未经分析就给所有 import 添加 `.js`。

#### Next.js

- 不覆盖 Next.js 自动维护的 tsconfig 规则。
- 使用项目正式的 `next build`。
- 检查 server/client component 边界。
- Storybook stories 默认只承载 client-compatible UI。

#### Monorepo

- 明确 Storybook 属于 app 还是 design-system package。
- 使用 workspace 正式包管理器。
- 不复制 Theme package 代码到 app 内。

### 10.4 禁止做法

- 关闭 `strict`。
- 批量添加 `any`。
- 把整个 `src` 子树放进 exclude。
- 修改生成 API 文件来消除调用方错误。

### 10.5 验收

```bash
<PACKAGE_MANAGER> run typecheck
<PACKAGE_MANAGER> run build
```

均退出码为 0。

---

## 11. WP2：测试基线与统一 Render Helpers

### 11.1 目标

把现有测试恢复为可信安全网，并为 Storybook 与测试共享 Provider 边界。

### 11.2 工作内容

- 对失败测试进行分类，不盲目更新断言。
- 区分实现回归、过期断言、异步问题和 mock 漂移。
- 修复真实 DOM 警告，例如 interactive element 嵌套。
- 清理未处理 Promise、timer 和 `act()` warning。
- 建立 `renderWithProviders()`。

建议接口：

```tsx
renderWithProviders(ui, {
  route: "/classes/123",
  auth: instructorUser,
  preloadedState: {},
  featureFlags: [],
});
```

### 11.3 Provider 原则

- 默认使用正式 Theme。
- 每个测试创建独立 store，避免状态泄露。
- Router 使用内存实现。
- Auth 使用小型类型安全 fixture。
- API mock 默认失败或明确返回，避免“所有未配置请求自动成功”。

### 11.4 用户交互

- 新测试优先使用 `userEvent`，减少纯 `fireEvent`。
- 重要 Dialog 和表单覆盖键盘和焦点行为。
- 不通过 MUI class name 验证用户行为。

### 11.5 验收

- 全量测试退出码为 0。
- 不通过批量 `.skip` 获得绿色。
- 测试输出没有未解释的关键 warning。
- `renderWithProviders()` 被至少一批代表性测试采用。

---

## 12. WP3：Lint、Format 与统一检查命令

### 12.1 目标

让新问题在提交前被发现，但不因一次性启用过多风格规则而阻塞全项目。

### 12.2 最小规则集

- TypeScript correctness。
- React Hooks。
- JSX accessibility。
- 未使用 import/variable。
- Promise 误用。
- 明显危险的浏览器 API 使用。

### 12.3 分级策略

- Error：正确性、Hooks、严重 a11y。
- Warning：历史债务，需要渐进清理。
- Off/Deferred：纯风格偏好或会制造大规模无关改动的规则。

### 12.4 建议 scripts

```json
{
  "scripts": {
    "typecheck": "...",
    "lint": "...",
    "format:check": "...",
    "test:ci": "...",
    "check": "..."
  }
}
```

### 12.5 验收

- 手写源码无 lint error。
- 生成目录被明确排除。
- 第一阶段没有全仓格式化 diff。
- 有一条本地统一检查命令。

---

## 13. WP4：CI 质量门禁

### 13.1 目标

把本地规则变成 PR 的自动门禁。

### 13.2 必需检查

```text
install
typecheck
lint
unit tests
application build
Storybook build（WP5 完成后加入）
```

### 13.3 原则

- PR validation 与 deploy 分开。
- Deploy 不能只依赖 bundler build。
- 不使用 `CI=false` 隐藏 warning 或失败。
- 使用锁文件安装。
- Node 版本与项目声明一致。
- 缓存只能优化速度，不能改变结果。

### 13.4 验收

- PR 能看到所有检查。
- 任一必需检查失败会阻止合并或部署。
- CI 与本地命令一致。

---

## 14. WP5：Storybook 最小安装

### 14.1 目标

建立一个与正式应用一致、但不依赖后端和登录的组件运行环境。

### 14.2 版本选择

实施时查证当前稳定 Storybook 版本与以下依赖的兼容性：

- 当前 React 版本
- 当前 bundler 版本
- 当前 UI framework 版本
- 当前 TypeScript 版本

使用官方 React/Vite、Next.js 或对应 framework integration，不手工拼接非官方 builder。

### 14.3 初始能力

- Docs / Controls
- Actions 或交互记录
- Accessibility
- Interactions
- Viewport
- 必要时 MSW

### 14.4 目录

```text
.storybook/
  main.ts
  preview.tsx
src/
  .../*.stories.tsx
```

### 14.5 正式应用一致性

Storybook 必须复用：

- 正式 Theme。
- 正式全局 CSS。
- 正式字体加载方式。
- 正式资源路径。
- 正式 breakpoints。

不得复制一份 Storybook 专用 Theme。

### 14.6 推荐 scripts

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

### 14.7 验收

- dev server 可启动。
- static build 可在干净环境完成。
- 不启动后端也能展示 stories。
- 静态资源、字体和 Theme 正常。
- Storybook 构建进入 CI。

---

## 15. WP6：Providers 与 Mock 体系

### 15.1 目标

让 story 只声明它需要的业务状态，不重复搭建应用环境。

### 15.2 推荐 Provider Harness

```tsx
<AppStoryProvider
  route="/classes/123"
  auth={instructorUser}
  featureFlags={["example"]}
  preloadedState={{}}
>
  <Story />
</AppStoryProvider>
```

内部可包含：

- ThemeProvider
- CssBaseline / global CSS
- MemoryRouter
- Store Provider
- Query client
- Auth fixture provider
- Feature flag provider
- Toast/Dialog root

### 15.3 Auth Fixtures

至少提供：

```text
anonymous
student
instructor
admin
```

不得执行真实 OAuth。

### 15.4 API Mock

推荐状态：

```text
success
empty
loading
error
permission denied
delayed success
```

原则：

- 纯展示组件优先通过 props。
- 需要保留真实请求路径时使用 MSW。
- 未声明的请求默认报错，避免悄悄请求真实环境。
- mock response 使用正式类型。

### 15.5 验收

- story 不包含大量 provider boilerplate。
- 不存在真实 API 请求。
- 测试与 Storybook 能复用 fixtures 或 handlers。
- 每个 story 可以明确看出当前 auth/route/API 状态。

---

## 16. WP7：首批 Characterization Stories

### 16.1 目标

记录现有行为并证明环境有效，不急于宣布新的设计系统。

### 16.2 组件选择标准

优先选择：

- props 驱动。
- 很少或没有 API 依赖。
- 已经在多个页面使用。
- 具有代表性的 Theme 或交互状态。
- 容易在一个小 PR 中验证。

避免选择：

- 最大、最复杂的页面。
- 需要完整权限树的页面。
- 需要真实 iframe、PDF worker、WebSocket 或 streaming backend 的模块。
- 内部状态无法通过 props 或 mock 控制的组件。

### 16.3 第一组 Stories

#### Theme/Foundation 状态矩阵

- Palette
- Typography
- Spacing
- Radius/Shadows
- Breakpoints
- Buttons
- Form controls
- Tabs
- Checkbox/Radio/Switch
- Dialog

#### 6–10 个现有组件

按目标项目实际情况选择，例如：

- Button wrapper
- TextField wrapper
- Logo/Brand mark
- Card
- Navigation item
- Empty state
- Loading state
- Alert
- Simple dialog
- Form container

### 16.4 Story 状态要求

按适用性覆盖：

- Default
- Disabled
- Loading
- Empty
- Error
- Long content
- Narrow viewport
- Keyboard interaction
- Permission variants

不要机械地为纯展示组件制造无意义的 Loading/Error。

### 16.5 Story 质量标准

- Story 名称表达产品状态，不表达内部实现。
- args 尽量可控。
- 不依赖 story 执行顺序。
- 不共享可变全局状态。
- 不访问真实服务。
- 严重 a11y 问题必须修复或明确记录。

### 16.6 验收

- 至少一组 Theme/控件矩阵。
- 至少 6 个现有组件有 stories。
- 至少一个交互 story。
- 至少一个窄屏边界状态。
- 至少一个错误或空状态。

---

## 17. WP8：文档与 AI 规则

### 17.1 必需文档

```text
docs/ui/architecture.md
docs/ui/storybook.md
AGENTS.md 或现有 agent guide 的 UI 章节
```

### 17.2 Architecture 文档

说明：

- Foundation / Component / Pattern / Feature / Page 分层。
- 什么逻辑应该留在 page/container。
- 什么情况下直接用现有 UI framework。
- 什么情况下建立产品 wrapper。
- Storybook、unit test、E2E 的职责边界。
- 生成代码禁止修改范围。

### 17.3 Storybook 文档

说明：

- 如何运行。
- 如何创建 story。
- 如何选择 provider fixture。
- 如何声明 route 和 auth。
- 如何使用 API mock。
- 命名和状态要求。
- 如何运行 a11y 和 interaction 检查。

### 17.4 第一版 AI 规则

只写当前已经可执行的规则：

1. UI 修改前先搜索现有组件和 stories。
2. 不修改生成代码。
3. 新增公共组件必须提供 story。
4. Icon-only control 必须有可访问名称。
5. Story 不得访问真实后端或包含凭据。
6. 修改 Theme 时同步更新 Theme 状态 stories。
7. 修改完成必须运行 typecheck、lint、test、app build、Storybook build。
8. 不在页面中重新发明已有产品 pattern。

如果正式 token 体系尚未建立，不要提前写无法执行的“禁止一切硬编码值”；可以先禁止新增品牌色硬编码。

### 17.5 验收

- 新开发者不需要口头指导即可添加一个 story。
- AI 规则引用真实存在的脚本和目录。
- 文档没有描述尚不存在的抽象。

---

## 18. PR 拆分建议

推荐至少拆成五个 PR：

### PR 1：Engineering baseline

- TypeScript 配置。
- typecheck script。
- 必要类型错误修复。
- 不做 UI 变化。

### PR 2：Test baseline

- 修复失败测试。
- `renderWithProviders()`。
- 关键 DOM warning。
- 不重写页面。

### PR 3：Lint and CI

- ESLint/format 最小配置。
- PR validation workflow。
- 本地统一检查命令。

### PR 4：Storybook infrastructure

- Storybook 安装。
- Theme/Router/State/Auth decorators。
- mock 基础。
- Storybook build CI。

### PR 5：Characterization stories and docs

- Theme/控件矩阵。
- 6–10 个组件 stories。
- Architecture、Storybook、AI 规则。

如果目标项目基线已经完全绿色，可以合并 PR 1 和 PR 2，但不要把所有阶段工作压成一个 PR。

## 19. 停止条件

遇到以下情况时，不要自行扩大范围，应停止对应工作包并报告：

- 需要改变认证或权限语义才能运行 Storybook。
- 需要把生产密钥放进 Storybook。
- typecheck 修复要求批量修改生成代码。
- 测试预期与当前产品行为冲突，无法判断哪一方正确。
- Storybook 初始化要求升级核心 framework 或 bundler 大版本。
- Theme 是由外部 package 管理，当前项目无权修改。
- 现有未提交修改与目标文件重叠。
- CI 权限、组织规则或 secrets 需要新的用户授权。
- 一个所谓“基础组件”实际包含大量业务请求和权限逻辑。

报告时应给出：

```text
阻塞内容：
现有证据：
影响范围：
安全选项：
推荐选项：
需要谁决定：
```

## 20. 回滚策略

- 每个工作包独立 PR，可以单独回滚。
- Storybook 配置不得成为生产 app runtime 的强制依赖。
- Storybook-only dev dependencies 删除后，production build 仍应可运行。
- Provider harness 不替换生产 Provider，只组合和复用它们。
- 新增 stories 不修改生产行为。
- CI 初期如因基础设施原因不稳定，应修复 CI；不能长期标记为允许失败后假装完成。

## 21. 阶段最终验收命令

按项目包管理器替换命令：

```bash
<PACKAGE_MANAGER> install --frozen-lockfile
<PACKAGE_MANAGER> run typecheck
<PACKAGE_MANAGER> run lint
<PACKAGE_MANAGER> run test:ci
<PACKAGE_MANAGER> run build
<PACKAGE_MANAGER> run build-storybook
```

如果有 format check：

```bash
<PACKAGE_MANAGER> run format:check
```

所有命令必须在干净安装和无后端环境中可重复执行。

## 22. 最终交付清单

### 基线

- [ ] 项目调查报告。
- [ ] Git 和生成代码边界明确。
- [ ] 原始失败和修复结果可追溯。

### 工程质量

- [ ] Typecheck 为 0 error。
- [ ] Unit tests 全部通过。
- [ ] Lint 无 error。
- [ ] Application build 成功。
- [ ] 没有批量 skip、关闭 strict 或大范围 exclude。

### Storybook

- [ ] Storybook dev 可运行。
- [ ] Storybook static build 成功。
- [ ] 使用正式 Theme 和全局样式。
- [ ] Providers/mocks 有统一入口。
- [ ] 不访问真实后端。
- [ ] Theme/基础控件矩阵存在。
- [ ] 6–10 个代表性组件 stories 存在。
- [ ] 至少一个交互、窄屏、空或错误状态。

### CI

- [ ] PR 自动执行 typecheck。
- [ ] PR 自动执行 lint。
- [ ] PR 自动执行 unit tests。
- [ ] PR 自动执行 application build。
- [ ] PR 自动执行 Storybook build。

### 文档与 AI

- [ ] UI architecture 文档。
- [ ] Storybook 使用文档。
- [ ] 第一版 AI UI 规则。
- [ ] 文档中的命令和路径经过实际验证。

## 23. 实施结束报告模板

执行者完成后必须提交以下报告：

```markdown
# UI Engineering Phase 1 Completion Report

## Outcome
- 完成了什么：
- 未完成什么：
- 是否改变生产 UI：

## Baseline Before
- TypeScript errors：
- Test result：
- Lint result：
- App build：
- Storybook：

## Baseline After
- TypeScript errors：
- Test result：
- Lint result：
- App build：
- Storybook build：

## Added Infrastructure
- Scripts：
- CI jobs：
- Storybook addons：
- Providers：
- API mocks：

## Stories Added
- Foundation：
- Components：
- Interaction states：

## Files and Architecture
- 新目录：
- 新文档：
- 生成代码是否被修改：

## Risks Found
- Theme：
- Auth：
- API：
- Tests：
- Accessibility：

## Deferred to Phase 2
- Tokens：
- Components：
- Page migrations：
- Visual regression：

## Verification Commands
- `...`
```

## 24. 如何判断这次实践是否值得迁回 Kiwi

在另一个项目完成第一阶段后，用以下问题复盘：

1. Storybook 是否真的降低了进入特定页面状态的成本？
2. 哪些 Provider 最难 mock，是否说明业务和 UI 耦合过深？
3. Storybook 与单元测试是否复用了 fixture，还是产生了两套假数据？
4. Theme 状态矩阵是否提前发现了全局 override 风险？
5. 哪类 story 最有价值，哪类只是截图展示？
6. CI 时长增加多少，是否需要并行或缓存？
7. 哪些 lint 规则真正提高质量，哪些只制造噪音？
8. AI 是否能根据 stories 和规则复用组件？
9. 首批 6–10 个组件的选择是否足够简单？
10. 是否出现“为了 Storybook 修改生产架构”的反向依赖？

如果这些问题有清晰答案，再把验证过的配置、目录结构、Provider harness、story conventions 和 AI 规则带回 Kiwi。不要直接复制目标项目的品牌 tokens 或业务 fixtures。

## 25. 推荐迁回 Kiwi 的内容

适合迁回：

- Storybook 基础配置模式。
- Theme/Router/Auth/State decorator 组合方式。
- MSW handler 组织方式。
- `renderWithProviders()` 设计。
- Story 命名和状态覆盖规范。
- CI jobs 和缓存经验。
- a11y 与 interaction 检查策略。
- AGENTS.md 中经过验证的工程规则。

不应直接迁回：

- 另一个项目的颜色和品牌 token。
- 另一个项目的业务组件抽象。
- 为不同 Router 或 State library 编写的专用代码。
- 另一个项目的真实 API fixtures。
- 没有证明价值的 wrapper 组件。

---

## 26. Handover 总结

本阶段的职责不是“把 UI 做漂亮”，而是建立一个能安全持续把 UI 做好的系统。

执行优先级始终是：

```text
保护已有工作
  > 明确真实基线
  > 恢复质量门禁
  > 建立独立组件环境
  > 记录现有行为
  > 写下可执行规则
  > 再考虑设计系统与页面迁移
```

如果第一阶段完成后仍然需要登录真实账号、启动后端、手工进入复杂页面才能验证一个基础组件，那么这次实施还没有真正达到目标。

