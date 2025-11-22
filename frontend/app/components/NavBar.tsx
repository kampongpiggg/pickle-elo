"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav
      style={{
        borderBottom: "1px solid #e5e7eb",
        marginBottom: "1rem",
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.6rem 1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            fontSize: "0.95rem",
          }}
        >
          {links.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "0.35rem 0.9rem",
                  borderRadius: 999,
                  textDecoration: "none",
                  color: isActive ? "#111827" : "#4b5563",
                  backgroundColor: isActive ? "#e5e7eb" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  border: isActive ? "1px solid #d1d5db" : "1px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
