import { AuthButton } from "./auth-button";
import Link from "next/link";
import { ThemeSwitcher } from "./theme-switcher";
import Image from "next/image";

export function Navbar() {
  return (
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-10">
          <div className="w-full flex justify-between items-center px-4 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>
                <Image
                  src="/logo-dark.svg"
                  alt="logo"
                  width={100}
                  height={24}
                  className="object-contain"
                />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted-foreground hidden sm:block">
                Professional (v.1.0-alpha)
              </span>
              <AuthButton />
            </div>
          </div>
        </nav>
  );
}