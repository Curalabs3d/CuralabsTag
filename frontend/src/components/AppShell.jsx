import React from 'react';
import { LogOut } from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppShell({ title, subtitle, actions, children, navItems }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-base-950">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-base-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            {navItems}
            <div className="hidden items-center gap-3 border-l border-white/10 pl-4 sm:flex">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight text-white">{user?.name}</p>
                <p className="text-[11px] leading-tight text-white/40">
                  {user?.role === 'SUPER_ADMIN' ? 'Super Admin CuraLabs3D' : 'Painel do Cliente'}
                </p>
              </div>
              <button onClick={logout} className="rounded-lg border border-white/10 p-2 text-white/50 hover:border-red-500/40 hover:text-red-400" title="Sair">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-white/40">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
