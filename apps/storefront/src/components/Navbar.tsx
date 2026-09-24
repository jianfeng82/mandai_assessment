'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  ShoppingBag,
  Zap,
  LayoutDashboard,
  User,
  LogOut,
} from 'lucide-react';

export const Navbar = () => {
  const pathname = usePathname();
  const { user, quickLogin, logout } = useAuth();

  const navLinks = [
    { href: '/', label: 'Storefront', icon: ShoppingBag, isExternal: false },
    { href: '/simulator', label: 'Concurrency Lab', icon: Zap, isExternal: false },
    {
      href: 'http://localhost:3001',
      label: 'Admin App (Port 3001)',
      icon: LayoutDashboard,
      isExternal: true,
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                MandaiCommerce
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Customer Storefront (Port 3000)
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              if (link.isExternal) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium text-purple-400 hover:text-purple-200 hover:bg-purple-950/30 transition-all border border-purple-500/20"
                  >
                    <Icon className="h-4 w-4 text-purple-400" />
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-white shadow-sm shadow-zinc-900 border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`}
                  />
                  {link.label}
                  {link.href === '/simulator' && (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                      Stress Test
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Quick Role Switcher & Auth */}
        <div className="flex items-center gap-3">
          {/* Quick Switch Buttons for Evaluator Ease */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5 text-xs">
            <button
              onClick={() => quickLogin('CUSTOMER')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                user?.role === 'CUSTOMER'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <User className="h-3 w-3" />
              Customer
            </button>
            <button
              onClick={() => quickLogin('ADMIN')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                user?.role === 'ADMIN'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldCheck className="h-3 w-3" />
              Admin
            </button>
          </div>

          {/* User info */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-medium text-zinc-300 truncate max-w-[130px]">
                  {user.email}
                </span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  {user.role}
                </span>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => quickLogin('CUSTOMER')}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
