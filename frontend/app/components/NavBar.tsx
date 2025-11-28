"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Desktop links — no Home.
const links = [
  { href: "/methodology", label: "Methodology" },
  { href: "/players", label: "Meet the Players" },
  { href: "/matches", label: "Match History" },
  { href: "/matches/new", label: "Enter New Match" },
  { href: "/live", label: "Live Match" },
  { href: "/chemistry", label: "Chemistry Network" },
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
    <nav className="relative border-b border-gray-200 bg-white shadow-sm">
      {/* Top bar */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 md:py-3">

        {/* Desktop brand (links to Home) */}
        <Link
          href="/"
          className="hidden text-sm font-semibold text-gray-800 md:block md:text-base hover:text-gray-900"
        >
          The Victorian Throne
        </Link>

        {/* Mobile brand (NOT a link) */}
        <div className="text-sm font-semibold text-gray-800 md:hidden">
          The Victorian Throne
        </div>

        {/* Desktop links */}
        <div className="hidden items-center gap-2 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={getLinkClasses(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 md:hidden bg-white"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="mr-1 text-xs font-medium">
            {open ? "Close" : "Menu"}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="block h-[2px] w-3 bg-gray-700" />
            <span className="block h-[2px] w-3 bg-gray-700" />
            <span className="block h-[2px] w-3 bg-gray-700" />
          </span>
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile slide-in drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-white">
          <div className="text-base font-semibold text-gray-800">
            The Victorian Throne
          </div>
          <button
            className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-700 bg-white"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>

        {/* Drawer nav links */}
        <div className="flex flex-col gap-2 px-4 py-4 bg-white">
          {/* NEW: Mobile-only Home Link */}
          <Link
            href="/"
            className={`${getLinkClasses("/")} w-full text-left`}
            onClick={() => setOpen(false)}
          >
            Home
          </Link>

          {/* Existing Drawer Links */}
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${getLinkClasses(link.href)} w-full text-left`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
