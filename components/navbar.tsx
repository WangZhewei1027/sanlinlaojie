import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { NavbarSidebar } from "@/components/navbar-sidebar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { hasEnvVars } from "@/lib/utils";

export function Navbar() {
  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-14">
      <div className="w-full flex justify-between items-center px-3 sm:px-5 text-sm gap-2">
        <Suspense>
          <BreadcrumbNav />
        </Suspense>
        <div className="flex items-center gap-2 flex-shrink-0">
          <LanguageSwitcher />
          {/* Desktop: show all controls */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeSwitcher />
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
          {/* Mobile: sidebar drawer */}
          <div className="md:hidden">
            <NavbarSidebar />
          </div>
        </div>
      </div>
    </nav>
  );
}
