import { AuthButton } from "./auth-button";
import Link from "next/link";
import { ThemeSwitcher } from "./theme-switcher";

export function Navbar() {
  return (
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-10">
          <div className="w-full max-w-5xl flex justify-between items-center px-4 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Next.js Supabase Starter</Link>
            </div>
            <div className="flex items-center gap-2">
              <AuthButton />
              <ThemeSwitcher />
            </div>
          </div>
        </nav>
  );
}