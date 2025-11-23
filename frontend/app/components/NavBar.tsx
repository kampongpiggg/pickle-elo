"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/methodology", label: "Methodology" },
  { href: "/players", label: "Meet the Players" },
  { href: "/matches", label: "Match History" },
  { href: "/matches/new", label: "Enter New Match" },
  { href: "/live", label: "Live Match" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const getLinkClasses = (href: string) => {
    const isActive =
      pathname === href || (href !== "/" && pathname.startsWith(href));

    const base =
      "px-3 py-1.5 rounded-full border text-sm transition-colors whitespace-nowrap";
    const active =
      "bg-gray-200 text-gray-900 border-gray-300 font-semibold";
    const inactive =
      "bg-transparent text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-900";

    return `${base} ${isActive ? active : inactive}`;
  };

  return (
    <nav className="border-b border-gray-200 bg-gray-50/90 backdrop-blur">
      {/* Top bar */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 md:py-3">
        {/* Brand / title */}
        <div className="text-sm font-semibold text-gray-800 md:text-base">
          The Victorian Throne
        </div>

        {/* Desktop links */}
        <div className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={getLinkClasses(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
        >
          {/* simple icon */}
          <span className="mr-1 text-xs font-medium">Menu</span>
          <span className="flex flex-col gap-0.5">
            <span className="block h-[2px] w-3 bg-gray-700" />
            <span className="block h-[2px] w-3 bg-gray-700" />
            <span className="block h-[2px] w-3 bg-gray-700" />
          </span>
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="border-t border-gray-200 bg-gray-50 md:hidden">
          <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={getLinkClasses(link.href)}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
