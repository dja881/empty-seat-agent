"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, CalendarDays, Handshake, ChevronsUpDown, CreditCard, Headset, Home, Settings2, Users, Armchair,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { href: "#", label: "Home", icon: Home, disabled: true },
  { href: "/board", label: "Calendar", icon: CalendarDays },
  { href: "#", label: "Customers", icon: Users, disabled: true },
  { href: "#", label: "Payments", icon: CreditCard, disabled: true },
];

const AGENT_NAV = [
  { href: "/merchant", label: "Empty Seat Agent", icon: Armchair, live: true },
  { href: "/merchant/front-desk", label: "Front desk", icon: Headset },
  { href: "/merchant/summary", label: "Daily report", icon: BarChart3 },
  { href: "/agents", label: "Negotiations", icon: Handshake },
  { href: "/merchant/settings", label: "Agent settings", icon: Settings2 },
];

/** Merchant dashboard frame: the salon's own workspace with the agent installed in it. */
export function AppShell({ title, crumbs, actions, children }: {
  title: string;
  crumbs?: string[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <button className="mx-3 mt-3 flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/strand-mark.svg" alt="" className="h-8 w-8 rounded-md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">Strand & Co.</span>
            <span className="block truncate text-[12px] text-muted">Madhapur, Hyderabad</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-faint" />
        </button>

        <nav className="mt-4 space-y-0.5 px-3">
          {NAV.map((n) => (
            <NavItem key={n.label} {...n} active={!n.disabled && path === n.href} />
          ))}
        </nav>

        <div className="mt-6 px-5 text-[11px] font-medium uppercase tracking-wider text-faint">Agents</div>
        <nav className="mt-2 space-y-0.5 px-3">
          {AGENT_NAV.map((n) => (
            <NavItem key={n.label} {...n} active={path === n.href} />
          ))}
        </nav>

        <div className="mt-auto border-t border-line px-5 py-4 text-[12px] text-muted">
          <div className="flex items-center justify-between">
            <span>Payments</span>
            <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn">Test mode</span>
          </div>
          <div className="mt-1 text-faint">Installed from Razorpay Agent Studio</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1">
            {crumbs && <div className="truncate text-[12px] text-muted">{crumbs.join(" / ")}</div>}
            <h1 className="truncate text-[15px] font-semibold leading-tight text-ink">{title}</h1>
          </div>
          {actions}
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active, disabled, live }: {
  href: string; label: string; icon: typeof Home; active?: boolean; disabled?: boolean; live?: boolean;
}) {
  const cls = `flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] ${
    active ? "bg-accent-soft font-medium text-accent" : disabled ? "text-faint" : "text-ink-2 hover:bg-background"
  }`;
  const body = (
    <>
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      <span className="flex-1">{label}</span>
      {live && <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" />}
    </>
  );
  return disabled ? <span className={cls}>{body}</span> : <Link href={href} className={cls}>{body}</Link>;
}
