"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface AuthFormShellProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthFormShell({
  title,
  description,
  footer,
  children,
  className,
  ...props
}: AuthFormShellProps) {
  return (
    <div
      className={cn(
        "min-w-0 selection:bg-primary selection:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <header
        className="mb-8 space-y-3 sm:mb-10"
        aria-live="polite"
        aria-atomic="true"
      >
        <Text as="h1" variant="headingXl" breakWord>
          {title}
        </Text>
        {description && (
          <Text as="p" tone="subdued" breakWord>
            {description}
          </Text>
        )}
      </header>
      {children}
      {footer && (
        <Text
          as="p"
          variant="bodySm"
          tone="subdued"
          alignment="center"
          className="mt-8"
        >
          {footer}
        </Text>
      )}
    </div>
  );
}

export function AuthInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn("h-12 min-w-0 rounded-lg px-4 shadow-none", className)}
      {...props}
    />
  );
}

export function AuthButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-auto min-h-12 w-full whitespace-normal rounded-full shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function AuthLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "rounded-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export function AuthError({ children }: { children?: React.ReactNode }) {
  return children ? (
    <Text as="p" variant="bodySm" tone="critical" role="alert" breakWord>
      {children}
    </Text>
  ) : null;
}

export function AuthDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-6 flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <Text as="span" variant="bodySm" tone="subdued">
        {t("auth.or")}
      </Text>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
