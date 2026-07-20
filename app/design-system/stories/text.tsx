import { Text, type TextVariant } from "@/components/ui/typography";
import { StorySection } from "../components/StorySection";

const SCALE: {
  variant: TextVariant;
  size: string;
  usage: string;
}[] = [
  { variant: "headingXl", size: "30px / 1.875rem", usage: "页面主标题，每页仅一个" },
  { variant: "headingLg", size: "24px / 1.5rem", usage: "区块标题" },
  { variant: "headingMd", size: "18px / 1.125rem", usage: "小节 / 卡片标题" },
  { variant: "bodyMd", size: "16px / 1rem", usage: "正文，最小正文字号" },
  { variant: "bodySm", size: "14px / 0.875rem", usage: "辅助信息，不用于成段正文" },
  { variant: "bodyXs", size: "12px / 0.75rem", usage: "组件级微文本（badge / 时间戳 / 表格备注），禁止承载完整句子" },
];

const SCALE_DEMO_ELEMENT: Record<TextVariant, "h1" | "h2" | "h3" | "p"> = {
  headingXl: "h1",
  headingLg: "h2",
  headingMd: "h3",
  bodyMd: "p",
  bodySm: "p",
  bodyXs: "p",
};

const API_RULES = [
  "文档流内容（标题、成段正文、长说明）必须用 <Text>；as 必填，语义标签与外观解耦。",
  "组件内嵌文字（按钮、badge、输入框、菜单项）用 components/ui 组件自带的样式，不手写字号。",
  "零散 UI 辅助文字允许直接写 utility，但只准用刻度内字号 + 语义色 token；text-[..px] 任意值一律禁止。",
  "辅助色用 tone=\"subdued\"、错误用 tone=\"critical\"，不直接写 text-muted-foreground / text-destructive。",
];

const A11Y_RULES = [
  "全部字号使用 rem（Tailwind 默认），跟随用户浏览器字号设置缩放，不写死 px。",
  "正文最小 16px（bodyMd）；14px 只作辅助说明，12px 只作组件级微文本，都禁止用于成段正文。",
  "muted-foreground（tone=\"subdued\"）在白底上的对比度约 4.7:1，满足 WCAG AA 对小字号文本 4.5:1 的要求；不要再调浅。",
  "标题标签按文档结构选 as（h1→h2→h3 不跳级）；层级外观由 variant 决定，两者独立。",
  "标题不加负 letter-spacing（CJK 方块字不收紧字距），标题行高 leading-snug，正文行高 1.75（leading-7）。",
  "长文容器自行限制行长约 65ch（约 32 个汉字），Text 本身不限宽。",
];

const FONT_STACK_RULES = [
  "拉丁字形用 Geist（next/font 加载）；中文不加载 webfont，走系统字体链：PingFang SC → Hiragino Sans GB → Microsoft YaHei → Noto Sans SC。",
  "字体栈定义在 tailwind.config.ts 的 fontFamily.sans，body 统一 font-sans；任何地方不再单独写 font-family。",
  "不引入中文 webfont（动辄数 MB）；如未来品牌需要，须走子集化 + 按需加载，先在这里修订本条。",
];

export function TextStory() {
  return (
    <div className="space-y-8">
      <StorySection title="字体栈 — i18n 的第一决策">
        <div className="w-full space-y-4">
          <ul className="list-disc space-y-2 pl-5">
            {FONT_STACK_RULES.map((rule) => (
              <li key={rule}>
                <Text as="p" variant="bodyMd">{rule}</Text>
              </li>
            ))}
          </ul>
          <Text as="p" variant="bodyMd">
            中西混排示例：三林老街 Sanlin Old Street — 数字 0123456789 与标点「引号」（括号）。
          </Text>
        </div>
      </StorySection>
      <StorySection title="Scale — 全站只有这六级字号">
        <div className="w-full space-y-6">
          {SCALE.map((s) => (
            <div key={s.variant} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <Text
                as={SCALE_DEMO_ELEMENT[s.variant]}
                variant={s.variant}
                className="min-w-40"
              >
                老街晨光 Aa
              </Text>
              <Text as="small" variant="bodySm" tone="subdued" className="w-24 font-mono">{s.variant}</Text>
              <Text as="small" variant="bodySm" tone="subdued" className="w-32 font-mono">{s.size}</Text>
              <Text as="small" variant="bodySm" tone="subdued">{s.usage}</Text>
            </div>
          ))}
        </div>
      </StorySection>
      <StorySection title="Text API（Polaris 风格）">
        <ul className="list-disc space-y-2 pl-5">
          {API_RULES.map((rule) => (
            <li key={rule}>
              <Text as="p" variant="bodyMd">{rule}</Text>
            </li>
          ))}
        </ul>
      </StorySection>
      <StorySection title="Tone / fontWeight / truncate">
        <div className="w-full space-y-3">
          <Text as="p" variant="bodyMd">tone=&quot;default&quot; — 正文默认颜色</Text>
          <Text as="p" variant="bodyMd" tone="subdued">tone=&quot;subdued&quot; — 辅助信息、次要说明</Text>
          <Text as="p" variant="bodyMd" tone="critical">tone=&quot;critical&quot; — 错误与不可逆警告</Text>
          <Text as="p" variant="bodyMd" fontWeight="semibold">fontWeight=&quot;semibold&quot; — 覆盖 variant 默认字重</Text>
          <Text as="p" variant="bodyMd" truncate className="max-w-64">
            truncate — 超出容器宽度时截断并显示省略号，截断必须显式，禁止静默溢出。
          </Text>
        </div>
      </StorySection>
      <StorySection title="Markdown 式组合示例">
        <article className="max-w-[65ch] space-y-4">
          <Text as="h1" variant="headingXl">三林老街数字导览</Text>
          <Text as="small" variant="bodySm" tone="subdued">发布于 2026-07-18 · 阅读约 3 分钟</Text>
          <Text as="p" variant="bodyMd">
            三林老街位于上海浦东，是一条保存完好的江南水乡老街。本项目通过增强现实技术，
            把口述历史、老照片与声音档案叠加在真实街景之上，让访客边走边看边听。
          </Text>
          <Text as="h2" variant="headingLg">如何开始体验</Text>
          <Text as="p" variant="bodyMd">
            用微信扫描街口的二维码即可打开小程序，无需安装任何应用。定位授权后，
            地图会显示你附近的全部 AR 内容点位。
          </Text>
          <Text as="h3" variant="headingMd">内容类型</Text>
          <Text as="p" variant="bodyMd">
            目前支持图片、音频、视频与 3D 模型四类内容，均由街区居民与志愿者共同采集。
          </Text>
        </article>
      </StorySection>
      <StorySection title="Accessibility 原则">
        <ul className="list-disc space-y-2 pl-5">
          {A11Y_RULES.map((rule) => (
            <li key={rule}>
              <Text as="p" variant="bodyMd">{rule}</Text>
            </li>
          ))}
        </ul>
      </StorySection>
    </div>
  );
}
