# UI 规范体系与实践

本项目的 UI 规范采用业内通用的分层模型：**Token（词汇）→ 组件（语法）→ Storybook（活文档）→ 强制（lint/review）**。设计决策的唯一事实源在代码仓库内：人通过 Storybook 阅读，AI 与 lint 读取对应源码文件——不允许出现“文档说一套、代码是另一套”。

## 一、体系分层

### 1. Token 层 —— 什么值存在

| Token | 定义位置 | 说明 |
|---|---|---|
| 颜色 | `app/globals.css`（CSS 变量，明/暗两套） | 语义命名：`background/foreground/primary/secondary/muted/accent/destructive/border` 等，经 `tailwind.config.ts` 映射为 `bg-primary`、`text-muted-foreground` 等类 |
| 字体栈 | `tailwind.config.ts` → `fontFamily.sans` | Geist（拉丁，next/font 加载）→ PingFang SC → Hiragino Sans GB → Microsoft YaHei → Noto Sans SC → 系统兜底。**中文不加载 webfont**，全站唯一字体定义点，任何地方不再单独写 font-family |
| 字号刻度 | `tailwind.config.ts` → `fontSize`（词汇表）+ `components/ui/typography.tsx` 的 `VARIANT_CLASSES`（组合） | 六级：30/24/18/16/14/12px + 营销专用 `display`(36px)/`display-lg`(48px)，全部 rem。**theme 已收窄：刻度外的类（text-xl/4xl…）不存在，写了不生效** |
| 圆角 | `globals.css` 的 `--radius` | 经 config 映射为 `rounded-sm/md/lg` |

核心规则：**只用语义 token，不写死值**。禁止 hex 色、禁止 `text-[..px]` 任意值、禁止绕过语义色直接用 `text-red-600` 这类调色板类（现存的属历史遗留，见路线图）。

### 2. 组件层 —— 合法的组合

- **基础组件**：`components/ui/`（shadcn/Radix），自带刻度内的字号字重，使用时不手写文字样式。禁止直接 import `@radix-ui/*` 原始包。
- **文字组件**：`components/ui/typography.tsx` 的 `<Text>`，Polaris 风格 API（详见下文）。

### 3. 活文档层 —— Storybook

正式 Storybook 配置位于 `.storybook/`，内容位于 `stories/`。应用内不再提供 `/design-system` 路由。Storybook 按标准 CSF 与 Autodocs 组织为三层：

- **Foundations / Tokens**：Colors、Typography（刻度、字体栈、API 规则的可视化）
- **Foundations / Principles**：颜色语义、布局嵌套、移动端适配、加载态——do/don't 对比 + 成文规则
- **Components**：每个 `components/ui/*` 组件拥有独立 CSF 文件与 Docs 页面

目录职责：

- `stories/**/*.stories.tsx`：Storybook 导航、meta、Autodocs 和独立状态声明；每个可命名状态拥有自己的 Story URL。
- `stories/_components/`：只保留跨多个原则 Story 复用的纯文档版式组件。

Story 编写约定：
- 简单组件以 `args` 为事实来源，提供 `Playground` 和有意义的状态 Story，Controls 自动编辑公开 props。
- 复合组件使用显式 `render` 组合子组件；不要为了 Storybook 修改正式组件 API。
- 一个 Story 只表达一个状态或规则，不再创建集合式 `Overview` 页面。
- 状态名使用产品语义（如 `DestructiveConfirmation`、`CardLoading`），不使用 `Example1`。
- Story 只负责展示和文档，不使用 `play` 函数或测试运行器。

实践约定：
- PR 里出现设计争议，直接贴对应 Storybook story URL 作为依据。
- 规则变更走 PR：改规则文案 + 对应 story 同一个 commit。
- 新增 `<Text>` variant 时，`stories/foundations/typography.stories.tsx` 的 `SCALE` 是 `Record<TextVariant, …>`，不同步更新该 story 会**编译失败**——这是有意设计，保持它。

### 4. 强制层 —— 现状与缺口

- 已有：`npm run build`（TS strict）+ code review + 本文档/CLAUDE.md 对 AI 生效。
- **lint（warn 级，不阻塞 build）**：`eslint.config.mjs` 内置四条设计规范检查——禁任意值字号 `text-[..px]`、禁刻度外字号（text-xl/4xl/5xl…）、禁 Text 的 className 携带文字类、禁绕过 `components/ui` 直接 import `@radix-ui/*`。warn 是有意选择：提示违规但由 review 决定是否放行（豁免场景如落地页 display 会命中）。
- **尚未落地**（见路线图）：fontSize 词汇表收窄（theme 层面让刻度外的类不存在）。

## 二、文字体系（全站最重要的一章）

### 字体栈

拉丁字形走 Geist，中文走系统字体链（见上表）。字体回退是逐字符的，中西混排自动各归其位，zh/en 共用同一个栈。若未来需要品牌中文字体，必须走子集化 + 按需加载，并先修订本节。

### 六级刻度

| variant | 字号 | 用途 |
|---|---|---|
| `headingXl` | 30px / 1.875rem | 页面主标题，每页仅一个 |
| `headingLg` | 24px / 1.5rem | 区块标题 |
| `headingMd` | 18px / 1.125rem | 小节 / 卡片标题 |
| `bodyMd` | 16px / 1rem | 正文，**最小正文字号** |
| `bodySm` | 14px / 0.875rem | 辅助信息，不用于成段正文 |
| `bodyXs` | 12px / 0.75rem | 组件级微文本（badge/时间戳/表格备注），禁止承载完整句子 |

排版规则：标题不加负 letter-spacing（CJK 方块字不收紧字距），标题行高 `leading-snug`，正文 `leading-7`；长文行长由容器限制约 65ch（≈32 汉字），组件本身不限宽。

**Display 档**：`text-display`(36px) / `text-display-lg`(48px) 仅限营销页（首页、hero）的展示性大字，utility 直写、不进入 Text variant；console 路由（/manage、/admin、/super-admin 等）禁用。

### Text 组件 API

```tsx
<Text as="h2" variant="headingLg">区块标题</Text>
<Text as="p" variant="bodyMd" tone="subdued">辅助说明</Text>
<Text as="span" variant="bodySm" truncate className="max-w-64">…</Text>
```

- `as` 必填，语义标签与外观（variant）解耦，h1→h2→h3 不跳级。
- `tone`：`default / subdued / critical / success / warning`，对应语义色 token；不直接写 `text-muted-foreground`。**缺省时继承父级颜色**（可安全用于 primary 按钮、彩色横幅等有色表面），需要明确前景色时显式传 `tone="default"`。
- `fontWeight / alignment / truncate / breakWord` 按需。
- **`className` 只准放布局类**（margin/width/display）；字号、字重、行高、颜色、字距一律走 props。`cn` 走 twMerge，className 能静默覆盖 variant——这是逃生舱不是后门，review 重点盯这条。
- 表单标签用 `components/ui/label.tsx`，链接用 `next/link`，不走 Text。

### 三区边界 —— 哪些文字归谁管

1. **文档流内容**（页面/区块标题、成段正文、长说明）→ 必须用 `<Text>`。判断标准：像"文章的一部分"就用。
2. **组件内嵌文字**（按钮、badge、输入框、菜单项、表格内容）→ 用 ui 组件自带样式，不手写字号、不包 Text。
3. **零散 UI 辅助文字**（字段标签、时间戳、计数）→ 允许直接写 utility，但只准刻度内字号 + 语义色 token。

长文例外：`app/instructions/` 的 MDX 用 `@tailwindcss/typography` 的 `prose` 类排版，不与应用 UI 混用。shadcn 官方文档站的 typography 样式（`text-4xl font-extrabold` 等）**不作为本项目依据**。

## 三、颜色使用规则

- 只用语义 token；`destructive` 只用于不可逆的危险操作且必须配二次确认；同一视图只有一个 `primary` 主操作按钮，其余 `secondary/outline/ghost`。
- `muted-foreground` 白底对比度约 4.7:1，是辅助文字的对比度下限，不得再调浅。
- 状态色：`success`（成功/已完成）、`warning`（警示/需注意）、`destructive`（错误/不可逆），各含 `-foreground` 配对，明暗双套，文字对比度白底 ≥4.5:1。柔和底色用透明度修饰（`bg-success/10`、`border-warning/30`），禁止再写 `text-green-600` 式调色板类。
- **分类标识色豁免**：成员角色徽章（purple/blue/gray/green）、资产类型色（音频 purple、锚点 amber）、清理工具的分类区（orange/blue）、owner 皇冠（yellow/amber）——这些是身份/类别色不是状态色，暂允许调色板类（需带 dark: 变体），未来如引入 categorical token 集再收编。

## 四、i18n 相关的 UI 规则

- 默认 `zh`、fallback `en`；en 文本普遍比 zh 长 50–200%，因此：文本容器不定死宽高；截断必须显式（`truncate` + tooltip），禁止静默溢出；带文案的 UI 须 zh/en 各过一遍再算完成。
- 全部字号 rem，跟随浏览器字号设置缩放。
- 已知限制：`html lang` 首帧恒为 zh，客户端 hydration 后由 i18n-provider 修正（cacheComponents 下 cookie 读取位置的取舍）。

## 五、协作实践

- **人**：新人第一天运行 `npm run storybook` 并过一遍 Design System；review 引用 story URL；设计决策变更由 story + 规则同 PR 修订。
- **AI**：CLAUDE.md 指向本文档与 `stories/`；AI 写 UI 前应遵守三区边界与 token 规则，新增例外须先修订规则，不允许静默绕过。
- **验证**：改动共享层（token、ui 组件、Text）属于高杠杆操作——合规不等于视觉无损，改完至少人工检查受影响的 Storybook Docs 页面与明暗主题。

## 六、路线图（按优先级）

1. ~~Token 词汇表收窄~~（已完成：`theme.fontSize` 收敛到六级 + `display`/`display-lg` 两档，首页/hero 已迁移，刻度外类不再存在）。
2. ~~lint 上牙齿~~（已完成：四条规则以 warn 级落地 `eslint.config.mjs`，不阻塞 build）。
3. ~~状态色 token~~（已完成：`--success`/`--warning` 上线，约 50 处状态色已迁移，分类标识色按豁免清单保留）。
4. ~~Text 小修~~（已完成：tone 缺省继承、alignment 改逻辑属性 `text-start/end`、CardTitle 移除 `tracking-tight`）。
5. **Storybook 内容维护**：公共组件新增或 API 变化时同步更新对应 CSF、展示状态和 Docs 描述。
