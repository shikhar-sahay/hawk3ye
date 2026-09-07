"use client";

import * as React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bell,
  Search,
  LogOut,
  Menu,
  User,
  Settings,
  X,
  Loader2,
  AlertTriangle,
  FileText,
  Server,
  Activity,
} from "lucide-react";
import { ConnectionStatusInline } from "@/components/ConnectionStatusCard";
import { useConnectionStatusWithInit, useWebSocketMessage, useWebSocketContext } from "@/context/WebSocketContext";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AlertPayload, IncidentPayload } from "@/context/WebSocketContext";
import { apiClient } from "@/api/client";
import { clearStoredApiKey } from "@/auth";

interface TopNavProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

// Types for search results
interface SearchResult {
  type: "event" | "alert" | "incident" | "source";
  id: number;
  title: string;
  subtitle: string;
  severity?: "critical" | "high" | "medium" | "low";
  url: string;
}

// Types for notifications
interface NotificationItem {
  id: string;
  type: "alert" | "incident";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  timestamp: string;
  url: string;
}

export function TopNav({ onMenuClick, sidebarCollapsed }: TopNavProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(-1);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const searchRequestIdRef = React.useRef(0);
  const listboxRef = React.useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Theme switching uses the shared three-theme dropdown (<ThemeToggle />).

  // Get connection status from shared WebSocket context
  const wsStatus = useConnectionStatusWithInit();
  const { subscribe, unsubscribe } = useWebSocketContext();

  // Store recent notifications from WebSocket
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);

  // Respect the "Enable Notifications" setting (localStorage, default on)
  const notificationsEnabledRef = React.useRef<boolean>(
    typeof window === "undefined" ? true : localStorage.getItem("hawkeye_notifications") !== "false"
  );
  React.useEffect(() => {
    const sync = () => {
      notificationsEnabledRef.current = localStorage.getItem("hawkeye_notifications") !== "false";
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Subscribe to WebSocket messages for real-time notifications
  useWebSocketMessage(["alert", "incident"], (message) => {
    if (!notificationsEnabledRef.current) return;
    const pushNotification = (n: NotificationItem) => {
      setNotifications((prev) =>
        prev.some((p) => p.id === n.id)
          ? prev // already notified about this entity
          : [n, ...prev].slice(0, 10)
      );
    };
    if (message.type === "alert" && message.data) {
      const alert = message.data as AlertPayload;
      if (alert.severity === "critical" || alert.severity === "high") {
        pushNotification({
          id: `alert-${alert.id}`,
          type: "alert",
          title: alert.title,
          description: alert.description,
          severity: alert.severity,
          timestamp: alert.created_at,
          url: `/alerts?alert=${alert.id}`,
        });
      }
    } else if (message.type === "incident" && message.data) {
      const incident = message.data as IncidentPayload;
      if (incident.severity === "critical" || incident.severity === "high") {
        pushNotification({
          id: `incident-${incident.id}`,
          type: "incident",
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          timestamp: incident.created_at,
          url: `/incidents?incident=${incident.id}`,
        });
      }
    }
  });

  // Ensure we're subscribed to alerts and incidents for notifications
  React.useEffect(() => {
    subscribe(["alerts", "incidents"]);
    return () => {
      unsubscribe(["alerts", "incidents"]);
    };
  }, [subscribe, unsubscribe]);

  // Handle search - Enter selects the highlighted suggestion, otherwise
  // submits a full search on the Events page
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedResultIndex >= 0 && searchResults[selectedResultIndex]) {
        handleResultSelect(searchResults[selectedResultIndex]);
      } else if (searchQuery.trim()) {
        navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
        resetSearch();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedResultIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      setShowSearchResults(false);
      setSelectedResultIndex(-1);
      e.currentTarget.blur();
    }
  };

  // Keep the keyboard-highlighted option visible in the dropdown
  React.useEffect(() => {
    if (selectedResultIndex < 0 || !listboxRef.current) return;
    const active = listboxRef.current.querySelector<HTMLElement>(`[data-result-index="${selectedResultIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedResultIndex]);

  // Debounced search across events, alerts, incidents and sources.
  // Guarded by a request id so a slow earlier response can never
  // overwrite results for a newer query.
  const performSearch = React.useCallback(async (query: string) => {
    const requestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setSearchError(false);
    try {
      const [eventsRes, alertsRes, incidentsRes, sourcesRes] = await Promise.all([
        apiClient.getEvents({ search: query, limit: 4 }),
        apiClient.getAlerts({ search: query, limit: 4 }),
        apiClient.getIncidents({ search: query, limit: 4 }),
        apiClient.getSources({ search: query, limit: 4 }),
      ]);
      if (requestId !== searchRequestIdRef.current) return;

      const results: SearchResult[] = [
        ...eventsRes.events.map((e) => ({
          type: "event" as const,
          id: e.id,
          title: `${e.category}: ${e.event_type}`,
          subtitle: `IP: ${e.ip || "N/A"} | ${e.route || "N/A"}`,
          severity: e.severity,
          url: `/events?event=${e.id}`,
        })),
        ...alertsRes.alerts.map((a) => ({
          type: "alert" as const,
          id: a.id,
          title: a.title,
          subtitle: `${a.detection_type} • ${a.severity}`,
          severity: a.severity,
          url: `/alerts?alert=${a.id}`,
        })),
        ...incidentsRes.incidents.map((i) => ({
          type: "incident" as const,
          id: i.id,
          title: i.title,
          subtitle:
            typeof i.alert_count === "number"
              ? `${i.status} • ${i.severity} • ${i.alert_count} alerts`
              : `${i.status} • ${i.severity}`,
          severity: i.severity,
          url: `/incidents?incident=${i.id}`,
        })),
        ...sourcesRes.sources.map((s) => ({
          type: "source" as const,
          id: s.id,
          title: s.name,
          subtitle: s.description || "No description",
          url: `/sources?source=${s.id}`,
        })),
      ];

      setSearchResults(results.slice(0, 12));
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      console.error("Search failed:", error);
      setSearchError(true);
      setSearchResults([]);
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  // Reset the whole search UI (input, dropdown, highlight)
  const resetSearch = React.useCallback(() => {
    setSearchQuery("");
    setShowSearchResults(false);
    setSearchResults([]);
    setSelectedResultIndex(-1);
    setSearchError(false);
    setIsMobileSearchOpen(false);
  }, []);

  // Clear the search when navigating to a different page: a query typed on
  // page A should not still sit in the header on page B. Only pathname
  // changes trigger this, so query-string navigation (deep links, pagination,
  // tab switches) keeps the UI stable.
  const pathname = location.pathname;
  React.useEffect(() => {
    resetSearch();
  }, [pathname, resetSearch]);

  // Handle search input change with debounced search
  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchQuery(value);
      setSelectedResultIndex(-1);
      setSearchError(false);

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (value.trim().length >= 2) {
        setShowSearchResults(true);
        debounceTimerRef.current = setTimeout(() => {
          performSearch(value.trim());
        }, 250);
      } else {
        setShowSearchResults(false);
        setSearchResults([]);
      }
    },
    [performSearch]
  );

  // Handle search result selection
  const handleResultSelect = (result: SearchResult) => {
    navigate(result.url);
    resetSearch();
  };

  // Handle search button click
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
      resetSearch();
    }
  };

  // Close search results when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-search-container]')) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle sign out
  const handleSignOut = () => {
    clearStoredApiKey();
    // Navigate to login; WebSocket provider unmounts with the layout
    navigate("/login", { replace: true });
  };

  // Handle profile click
  const handleProfile = () => {
    navigate("/settings?tab=profile");
  };

  // Handle security settings click
  const handleSecuritySettings = () => {
    navigate("/settings?tab=api");
  };

  const getSeverityColor = (severity?: "critical" | "high" | "medium" | "low") => {
    switch (severity) {
      case "critical":
        return "text-severity-critical bg-severity-critical/10";
      case "high":
        return "text-severity-high bg-severity-high/10";
      case "medium":
        return "text-severity-medium bg-severity-medium/10";
      case "low":
        return "text-severity-low bg-severity-low/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getTypeIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "event":
        return <Activity className="h-4 w-4" />;
      case "alert":
        return <AlertTriangle className="h-4 w-4" />;
      case "incident":
        return <FileText className="h-4 w-4" />;
      case "source":
        return <Server className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Highlight the matched substring inside a suggestion label
  const HighlightMatch = ({ text }: { text: string }) => {
    const query = searchQuery.trim();
    const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-transparent text-primary font-semibold">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  // Shared search field used by both the desktop header row and the
  // mobile expanded panel so state/behavior stay identical.
  const renderSearchField = (variant: "desktop" | "mobile") => (
    <div
      className={cn("relative min-w-0", variant === "desktop" ? "flex-1 max-w-2xl mx-8 hidden sm:block" : "flex-1")}
      data-search-container
    >
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        placeholder="Search alerts, incidents, events, sources..."
        value={searchQuery}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
        onKeyDown={handleSearch}
        onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
        className="pl-10 pr-10 h-10 text-sm"
        aria-label="Search"
        aria-autocomplete="list"
        aria-controls="search-results"
        aria-expanded={showSearchResults}
        role="combobox"
        autoFocus={variant === "mobile"}
      />
      {isSearching && (
        <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
      )}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={handleSearchSubmit}
        aria-label="Submit search"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
      </Button>

      {/* Search Results Dropdown */}
      {showSearchResults && searchResults.length > 0 && (
        <div
          id="search-results"
          ref={listboxRef}
          className="absolute top-full left-0 right-0 mt-2 z-50 bg-popover border rounded-lg shadow-lg overflow-hidden max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Search suggestions"
        >
          {searchResults.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              role="option"
              data-result-index={index}
              aria-selected={index === selectedResultIndex}
              onClick={() => handleResultSelect(result)}
              onMouseEnter={() => setSelectedResultIndex(index)}
              className={cn(
                "w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-center gap-3",
                index === selectedResultIndex && "bg-accent"
              )}
            >
              <div className={cn("flex-shrink-0 p-1.5 rounded", getSeverityColor(result.severity))}>
                {getTypeIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  <HighlightMatch text={result.title} />
                </p>
                <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded capitalize flex-shrink-0",
                  result.severity ? getSeverityColor(result.severity) : "bg-muted text-muted-foreground"
                )}
              >
                {result.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {showSearchResults && !isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-popover border rounded-lg shadow-lg p-4 text-center" role="status">
          {searchError ? (
            <>
              <p className="text-sm text-destructive">Search failed</p>
              <p className="text-xs text-muted-foreground mt-1">Check your connection and try again</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 transition-[left] duration-200",
        "left-0",
        sidebarCollapsed ? "lg:left-16" : "lg:left-60"
      )}
      role="banner"
    >
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left section: mobile menu + brand on small screens (the sidebar
            owns branding at lg+; never render two logos side by side) */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden flex-shrink-0"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Brand shown only while the persistent sidebar is hidden */}
          <NavLink to="/dashboard" className="lg:hidden flex items-center gap-2 flex-shrink-0" aria-label="Hawk3ye dashboard">
            <Logo size={22} />
            <span className="hidden min-[400px]:inline text-base font-semibold tracking-tight text-foreground">Hawk3ye</span>
          </NavLink>
        </div>

        {/* Center section: Search - prominent and centered */}
        {renderSearchField("desktop")}

        {/* Right side actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile search toggle (the inline field is hidden below sm) */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setIsMobileSearchOpen((v) => !v)}
            aria-label={isMobileSearchOpen ? "Close search" : "Open search"}
            aria-expanded={isMobileSearchOpen}
          >
            {isMobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {/* Connection status */}
          <ConnectionStatusInline status={wsStatus} />

          {/* Theme: shared three-theme dropdown */}
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                title="Notifications"
                className={cn("relative", notifications.length > 0 && "text-destructive")}
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs font-medium flex items-center justify-center">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end" forceMount>
              <DropdownMenuLabel className="font-normal flex items-center justify-between">
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNotifications([])}
                    aria-label="Clear all notifications"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                  <p className="text-xs">High-severity alerts and incidents will appear here</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="py-2 px-3 hover:bg-accent cursor-pointer flex flex-col items-start gap-1"
                      onClick={() => {
                        navigate(notification.url);
                      }}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div
                          className={cn(
                            "flex-shrink-0 p-1 rounded",
                            getSeverityColor(notification.severity)
                          )}
                        >
                          {notification.type === "alert" ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <FileText className="h-3 w-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTime(notification.timestamp)}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Session menu: the app authenticates per API key, so this is an
              account/session menu rather than a user profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                aria-label="Session menu"
              >
                <Avatar className="h-8 w-8 overflow-hidden border border-border bg-accent">
                  <AvatarFallback>
                    <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Session</p>
                  <p className="text-xs text-muted-foreground">Authenticated via API key</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfile}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSecuritySettings}>
                <Settings className="mr-2 h-4 w-4" />
                Security Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive-focus" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile expanded search panel */}
      {isMobileSearchOpen && (
        <div className="absolute inset-x-0 top-full border-b bg-background p-3 shadow-lg sm:hidden" data-search-container>
          <div className="flex items-center gap-2">
            {renderSearchField("mobile")}
          </div>
        </div>
      )}
    </header>
  );
}