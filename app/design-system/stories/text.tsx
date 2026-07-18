import {
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyP,
  TypographySmall,
} from "@/components/ui/typography";
import { StorySection } from "../components/StorySection";

const SCALE = [
  { level: "H1", cls: "text-3xl font-bold", size: "30px / 1.875rem", usage: "页面主标题，每页仅一个" },
  { level: "H2", cls: "text-2xl font-semibold", size: "24px / 1.5rem", usage: "区块标题" },
  { level: "H3", cls: "text-lg font-semibold", size: "18px / 1.125rem", usage: "小节 / 卡片标题" },
  { level: "Body", cls: "text-base leading-7", size: "16px / 1rem", usage: "正文，最小正文字号" },
  { level: "Small", cls: "text-sm text-muted-foreground", size: "14px / 0.875rem", usage: "辅助信息，不用于成段正文" },
];

const A11Y_RULES = [
  "全部字号使用 rem（Tailwind 默认），跟随用户浏览器字号设置缩放，不写死 px。",
  "正文最小 16px（text-base）；14px 只作辅助说明，禁止用于成段正文。",
  "muted-foreground 在白底上的对比度约 4.7:1，满足 WCAG AA 对小字号文本 4.5:1 的要求；不要再调浅。",
  "标题标签按文档结构选（h1→h2→h3 不跳级）；需要不同外观时用 className 覆盖，不要换标签。",
  "正文行长控制在约 65ch（TypographyP 已内置 max-w），行高 1.75（leading-7）。",
];

export function TextStory() {
  return (
    <div className="space-y-8">
      <StorySection title="Scale — 全站只有这五级字号">
        <div className="w-full space-y-6">
          {SCALE.map((s) => (
            <div key={s.level} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className={`${s.cls} min-w-40`}>老街晨光 Aa</p>
              <TypographySmall className="w-16 font-mono">{s.level}</TypographySmall>
              <TypographySmall className="w-32 font-mono">{s.size}</TypographySmall>
              <TypographySmall className="w-52 font-mono">{s.cls}</TypographySmall>
              <TypographySmall>{s.usage}</TypographySmall>
            </div>
          ))}
        </div>
      </StorySection>
      <StorySection title="Markdown 式组合示例">
        <article className="space-y-4">
          <TypographyH1>三林老街数字导览</TypographyH1>
          <TypographySmall>发布于 2026-07-18 · 阅读约 3 分钟</TypographySmall>
          <TypographyP>
            三林老街位于上海浦东，是一条保存完好的江南水乡老街。本项目通过增强现实技术，
            把口述历史、老照片与声音档案叠加在真实街景之上，让访客边走边看边听。
          </TypographyP>
          <TypographyH2>如何开始体验</TypographyH2>
          <TypographyP>
            用微信扫描街口的二维码即可打开小程序，无需安装任何应用。定位授权后，
            地图会显示你附近的全部 AR 内容点位。
          </TypographyP>
          <TypographyH3>内容类型</TypographyH3>
          <TypographyP>
            目前支持图片、音频、视频与 3D 模型四类内容，均由街区居民与志愿者共同采集。
          </TypographyP>
        </article>
      </StorySection>
      <StorySection title="Accessibility 原则">
        <ul className="list-disc space-y-2 pl-5">
          {A11Y_RULES.map((rule) => (
            <li key={rule}>
              <TypographyP>{rule}</TypographyP>
            </li>
          ))}
        </ul>
      </StorySection>
    </div>
  );
}
