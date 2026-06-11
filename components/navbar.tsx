import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { EnvVarWarning } from "@/components/env-var-warning";
import { NavbarSidebar } from "@/components/navbar-sidebar";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { UserAvatarMenu } from "@/components/user-avatar-menu";
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
          {/* Desktop: avatar dropdown */}
          <div className="hidden md:flex items-center gap-2">
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <UserAvatarMenu />
              </Suspense>
            )}
          </div>
          {/* Mobile: avatar drawer */}
          <div className="md:hidden">
            <NavbarSidebar />
          </div>
        </div>
      </div>
    </nav>
  );
}
