"use client";

import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  FileText,
  Server,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Live Events", href: "/events", icon: Activity },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Incidents", href: "/incidents", icon: FileText },
  { name: "Sources", href: "/sources", icon: Server },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface NavListProps {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}

function NavList({ collapsed, pathname, onNavigate }: NavListProps) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
      {navigation.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(item.href);
        return (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={({ isActive: active }) => cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center px-2"
            )}
            title={collapsed ? item.name : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon className="h-[1.1rem] w-[1.1rem] flex-shrink-0" aria-hidden="true" />
            {!collapsed && <span>{item.name}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}

interface BrandProps {
  collapsed?: boolean;
}

function Brand({ collapsed }: BrandProps) {
  return (
    <NavLink
      to="/dashboard"
      className={cn(
        "flex h-14 items-center border-b px-4",
        collapsed ? "justify-center px-0" : "gap-2.5"
      )}
      aria-label="Hawk3ye dashboard home"
    >
      <Logo size={28} />
      {!collapsed && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Hawk3ye
        </span>
      )}
    </NavLink>
  );
}

export interface SidebarProps {
  /** Desktop rail collapsed state */
  collapsed: boolean;
  onToggle: () => void;
  /** Mobile drawer open state */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Desktop rail (persistent) */}
      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col border-r bg-card transition-[width] duration-200",
          collapsed ? "w-16" : "w-60"
        )}
        aria-label="Main navigation"
      >
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} pathname={location.pathname} />

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full justify-center text-muted-foreground hover:text-foreground", collapsed && "px-0")}
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r bg-card lg:hidden"
            aria-label="Main navigation"
          >
            <div className="flex h-14 items-center justify-between border-b pr-2">
              <Brand />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onMobileClose}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <NavList collapsed={false} pathname={location.pathname} onNavigate={onMobileClose} />
          </aside>
        </>
      )}
    </>
  );
}
