import { cn } from "@/lib/utils";

// Polaris 风格的单一 Text 组件（API 形态对齐 Shopify Polaris 的 <Text>，
// 字号刻度是本项目自己的六级，不照搬 Polaris 的英文密集刻度）。
// - as 必填：语义标签由调用方显式选择，标签与外观解耦（h1→h6 不跳级）。
// - 全刻度 rem 单位，跟随浏览器字号缩放；不加负 letter-spacing（CJK 不收紧字距）。
// - bodyXs(12px) 仅用于组件级微文本（badge/时间戳/表格备注），禁止承载成段句子。

export type TextVariant =
  | "headingXl" // 30px 页面主标题，每页仅一个
  | "headingLg" // 24px 区块标题
  | "headingMd" // 18px 小节 / 卡片标题
  | "bodyMd" //   16px 正文（最小正文字号）
  | "bodySm" //   14px 辅助信息
  | "bodyXs"; //  12px 组件级微文本

export type TextTone = "default" | "subdued" | "critical";

export type TextFontWeight = "regular" | "medium" | "semibold" | "bold";

export type TextAlignment = "start" | "center" | "end";

export type TextElement =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "div"
  | "small"
  | "strong"
  | "legend";

const VARIANT_CLASSES: Record<TextVariant, string> = {
  headingXl: "scroll-m-20 text-3xl font-bold leading-snug",
  headingLg: "scroll-m-20 text-2xl font-semibold leading-snug",
  headingMd: "scroll-m-20 text-lg font-semibold leading-snug",
  bodyMd: "text-base leading-7",
  bodySm: "text-sm leading-normal",
  bodyXs: "text-xs leading-normal",
};

const TONE_CLASSES: Record<TextTone, string> = {
  default: "text-foreground",
  subdued: "text-muted-foreground",
  critical: "text-destructive",
};

const FONT_WEIGHT_CLASSES: Record<TextFontWeight, string> = {
  regular: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

const ALIGNMENT_CLASSES: Record<TextAlignment, string> = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
};

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as: TextElement;
  variant?: TextVariant;
  tone?: TextTone;
  fontWeight?: TextFontWeight;
  alignment?: TextAlignment;
  truncate?: boolean;
  breakWord?: boolean;
}

export function Text({
  as: Component,
  variant = "bodyMd",
  tone = "default",
  fontWeight,
  alignment,
  truncate = false,
  breakWord = false,
  className,
  ...props
}: TextProps) {
  return (
    <Component
      className={cn(
        VARIANT_CLASSES[variant],
        TONE_CLASSES[tone],
        fontWeight && FONT_WEIGHT_CLASSES[fontWeight],
        alignment && ALIGNMENT_CLASSES[alignment],
        truncate && "truncate",
        breakWord && "break-words",
        className,
      )}
      {...props}
    />
  );
}
