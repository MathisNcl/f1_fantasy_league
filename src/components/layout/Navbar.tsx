"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Props = {
  userName: string;
  isAdmin: boolean;
  signOutForm: React.ReactNode;
};

export default function Navbar({ userName, isAdmin, signOutForm }: Props) {
  const [open, setOpen] = useState(false);

  const linkClass =
    "text-gray-300 hover:text-white transition-colors text-sm font-medium";

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <Image src="/f1_flb.png" alt="F1 Fantasy League" width={120} height={40} className="h-8 w-auto" />
          <span className="text-red-500 text-xl sm:text-2xl font-bold">F1</span>
          <span className="text-white font-semibold text-base sm:text-lg">Fantasy League</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6">
          <Link href="/dashboard" className={linkClass}>Dashboard</Link>
          <Link href="/regles" className={linkClass}>Règles</Link>
          {isAdmin && (
            <Link href="/admin" className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm font-medium">
              Admin
            </Link>
          )}
          <span className="text-gray-400 text-sm">{userName}</span>
          {signOutForm}
        </nav>

        {/* Hamburger mobile */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="sm:hidden flex flex-col justify-center items-center gap-1.5 p-2 text-gray-400 hover:text-white"
          aria-label="Menu"
        >
          <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-transform duration-200 ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="sm:hidden border-t border-gray-800 px-4 py-4 space-y-3" onClick={() => setOpen(false)}>
          <Link href="/dashboard" className="block text-gray-300 hover:text-white text-sm font-medium py-1">
            Dashboard
          </Link>
          <Link href="/regles" className="block text-gray-300 hover:text-white text-sm font-medium py-1">
            Règles
          </Link>
          {isAdmin && (
            <Link href="/admin" className="block text-yellow-400 hover:text-yellow-300 text-sm font-medium py-1">
              Admin
            </Link>
          )}
          <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
            <span className="text-gray-400 text-sm">{userName}</span>
            {signOutForm}
          </div>
        </nav>
      )}
    </header>
  );
}
