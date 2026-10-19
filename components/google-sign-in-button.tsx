"use client";

import { useTranslation } from "react-i18next";
import Image from "next/image";
import googleMark from "@/public/images/google-g.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Props-only boundary: auth requests and navigation belong to the parent form.
export function GoogleSignInButton({
  onSignIn,
  isLoading = false,
  disabled = false,
  error,
  className,
}: {
  onSignIn: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className={cn("w-full gap-3 whitespace-normal", className)}
        onClick={onSignIn}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
      >
        {/* Official Google Identity mark: https://developers.google.com/identity/branding-guidelines */}
        <Image src={googleMark} width={20} height={20} alt="" aria-hidden="true" className="size-5 shrink-0 object-contain" />
        {isLoading ? t("auth.connectingGoogle") : t("auth.continueWithGoogle")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
