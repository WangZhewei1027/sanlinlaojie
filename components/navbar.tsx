import { Suspense } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavbarSidebar } from "@/components/navbar-sidebar";
import { WorkspaceSelect } from "@/app/manage/components/WorkspaceSelect";

export function Navbar() {
  return (
    <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
      <div className="w-full max-w-5xl flex justify-between items-center p-3 px-2 sm:px-5 text-sm gap-2">
        <div className="flex gap-2 sm:gap-3 items-center font-semibold min-w-0 flex-1">
          <Link href={"/"} className="whitespace-nowrap text-xs sm:text-sm">
            Sanlin Old Street
          </Link>
          <div className="min-w-0 flex-1">
            <Suspense>
              <WorkspaceSelect />
            </Suspense>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <LanguageSwitcher />
          <NavbarSidebar />
        </div>
      </div>
    </nav>
  );
}
