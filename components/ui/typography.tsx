import { cn } from "@/lib/utils";

// 全站文字刻度：原则上只使用这五级字号（rem 单位，跟随用户浏览器字号缩放）。
// 标题标签按文档结构选择（h1→h2→h3 不跳级）；需要不同外观时用 className 覆盖样式，而不是换标签。

export function TypographyH1({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-3xl font-bold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TypographyH2({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "scroll-m-20 text-2xl font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TypographyH3({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "scroll-m-20 text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TypographyP({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("max-w-[65ch] text-base leading-7 text-foreground", className)}
      {...props}
    />
  );
}

// 仅用于辅助信息（时间戳、字段说明、表格备注），不用于成段正文。
export function TypographySmall({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <small
      className={cn("text-sm leading-normal text-muted-foreground", className)}
      {...props}
    />
  );
}
