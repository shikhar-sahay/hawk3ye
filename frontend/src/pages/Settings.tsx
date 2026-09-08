"use client";

import * as React from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Save,
  Loader2,
  Key,
  Server,
  Monitor,
  Wifi,
  WifiOff,
  Info,
  Database,
  Shield,
  Bell,
  GitBranch,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "next-themes";
import { HAWKEYE_THEMES, setThemeAnimated, type HawkeyeTheme } from "@/lib/theme";
import { useDocumentTitle } from "@/hooks/useRouteMeta";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiClient } from "@/api/client";
import { clearStoredApiKey } from "@/auth";
import { copyTextToClipboard } from "@/lib/utils";
import { useWebSocketContext, useConnectionStatusWithInit } from "@/context/WebSocketContext";

const APP_VERSION = "2.0.0";
const BUILD_DATE = "2026-07-27";

const VALID_TABS = ["general", "api", "websocket", "about"] as const;
type SettingsTab = (typeof VALID_TABS)[number];

export function SettingsPage() {
  useDocumentTitle("Settings");
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const wsStatus = useConnectionStatusWithInit();
  const ws = useWebSocketContext();

  // Active tab from URL (?tab=), falling back to general.
  // TopNav links here with ?tab=profile (mapped to general) and ?tab=api.
  const requestedTab = (searchParams.get("tab") ?? "").toLowerCase();
  const activeTab: SettingsTab = VALID_TABS.includes(requestedTab as SettingsTab)
    ? (requestedTab as SettingsTab)
    : requestedTab === "profile"
      ? "general"
      : "general";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    setSearchParams(params, { replace: true });
  };

  // Local state
  const [storedApiKey, setStoredApiKey] = React.useState("");
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = React.useState(60);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  // Load settings from localStorage on mount
  React.useEffect(() => {
    const savedKey = localStorage.getItem("hawkeye_api_key") ?? "";
    const savedNotifications = localStorage.getItem("hawkeye_notifications");
    const savedRefresh = localStorage.getItem("hawkeye_auto_refresh");
    const savedSidebar = localStorage.getItem("hawkeye_sidebar_collapsed");

    setStoredApiKey(savedKey);
    if (savedNotifications !== null) setNotificationsEnabled(savedNotifications === "true");
    if (savedRefresh !== null && !Number.isNaN(parseInt(savedRefresh, 10))) {
      setAutoRefreshInterval(parseInt(savedRefresh, 10));
    }
    if (savedSidebar !== null) setSidebarCollapsed(savedSidebar === "true");
  }, []);

  // Test API connection (REST reachability + auth + WebSocket state)
  const runConnectionTest = async () => {
    setIsTestingConnection(true);
    try {
      await apiClient.getSources({ limit: 1, offset: 0 });
      toast({
        title: "API connection OK",
        description: `Backend reachable and authenticated. WebSocket: ${wsStatus}.`,
      });
    } catch (error) {
      toast({
        title: "API connection failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save all settings
  const saveSettings = () => {
    setIsSaving(true);
    try {
      // Apply a changed API key (takes effect for new REST calls; the
      // WebSocket reconnects when it next re-establishes)
      const currentKey = localStorage.getItem("hawkeye_api_key") ?? "";
      if (storedApiKey.trim() && storedApiKey !== currentKey) {
        localStorage.setItem("hawkeye_api_key", storedApiKey.trim());
      }
      localStorage.setItem("hawkeye_notifications", String(notificationsEnabled));
      localStorage.setItem("hawkeye_auto_refresh", String(autoRefreshInterval));
      localStorage.setItem("hawkeye_sidebar_collapsed", String(sidebarCollapsed));

      toast({ title: "Settings saved", description: "Your preferences have been updated." });
    } catch (error) {
      toast({ title: "Failed to save", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy API key to clipboard
  const copyApiKey = async () => {
    if (storedApiKey) {
      const ok = await copyTextToClipboard(storedApiKey);
      toast(ok
        ? { title: "Copied", description: "API key copied to clipboard." }
        : { title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your Hawk3ye dashboard preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="general">
            <Monitor className="h-4 w-4 sm:mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="api">
            <Server className="h-4 w-4 sm:mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger value="websocket">
            <Wifi className="h-4 w-4 sm:mr-2" />
            WebSocket
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4 sm:mr-2" />
            About
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="grid items-start gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how the dashboard looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
                </div>
                <Select value={theme ?? "dark"} onValueChange={(v) => setThemeAnimated(setTheme, v as HawkeyeTheme)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HAWKEYE_THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Sidebar State</Label>
                  <p className="text-sm text-muted-foreground">Remember sidebar collapsed state</p>
                </div>
                <Switch
                  checked={sidebarCollapsed}
                  onCheckedChange={setSidebarCollapsed}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show toast notifications for alerts and updates</p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Auto Refresh Interval</Label>
                  <p className="text-sm text-muted-foreground">How often to refresh data automatically (seconds)</p>
                </div>
                <Select value={String(autoRefreshInterval)} onValueChange={(v) => setAutoRefreshInterval(parseInt(v, 10))}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="120">2 minutes</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                    <SelectItem value="600">10 minutes</SelectItem>
                    <SelectItem value="0">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Data & Privacy</CardTitle>
              <CardDescription>Manage local data storage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label>Clear All Local Data</Label>
                  <p className="text-sm text-muted-foreground">Remove all cached data, settings, and stored keys</p>
                </div>
                <Button variant="destructive" onClick={() => {
                  if (confirm("This will clear ALL local data including your API key. Are you sure?")) {
                    localStorage.clear();
                    window.location.href = "/login";
                  }
                }}>
                  Clear Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Connection Settings */}
        <TabsContent value="api" className="grid items-start gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>API Connection</CardTitle>
              <CardDescription>
                The dashboard talks to the Hawk3ye backend on the same origin
                (<code className="font-mono text-xs">/api/v1</code>). In development,
                the Vite dev server proxies requests to the backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={runConnectionTest} disabled={isTestingConnection}>
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Server className="h-4 w-4 mr-2" />
                      Test API Connection
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stored API Key</CardTitle>
              <CardDescription>API key used to authenticate this browser</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your API key (starts with hawk_)"
                    value={storedApiKey}
                    onChange={(e) => setStoredApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowApiKey(!showApiKey)}
                    aria-label={showApiKey ? "Hide key" : "Show key"}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This key is stored locally in your browser and used for authenticated API requests.
                  Get your API key from the Sources page.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyApiKey} disabled={!storedApiKey}>
                  <Key className="h-4 w-4 mr-2" />
                  Copy Key
                </Button>
                <Button
                  variant="destructive"
                  disabled={!storedApiKey}
                  onClick={() => {
                    clearStoredApiKey();
                    setStoredApiKey("");
                    toast({ title: "Signed out", description: "API key removed from this browser." });
                  }}
                >
                  Remove Key & Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WebSocket Settings */}
        <TabsContent value="websocket" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>WebSocket Connection</CardTitle>
              <CardDescription>Real-time connection status and diagnostics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-background flex items-center justify-center">
                  {wsStatus === "connected" ? (
                    <Wifi className="h-6 w-6 text-success" />
                  ) : (
                    <WifiOff className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Connection Status</span>
                    <Badge
                      variant={wsStatus === "connected" ? "default" : wsStatus === "error" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {wsStatus}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    WebSocket connection for real-time alerts and incidents
                  </p>
                </div>
                {wsStatus === "connected" ? (
                  <Button variant="outline" size="sm" onClick={ws.disconnect}>
                    Disconnect
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={ws.reconnect}>
                    Connect
                  </Button>
                )}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">WebSocket URL</span>
                  </div>
                  <code className="text-sm text-muted-foreground font-mono break-all">
                    {window.location.protocol === "https:" ? "wss:" : "ws:"}//{window.location.host}/ws
                  </code>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Auto-Reconnect</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enabled with exponential backoff (max 30s delay)
                  </p>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Authentication</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {storedApiKey || localStorage.getItem("hawkeye_api_key") ? "API Key configured" : "No API key stored"}
                  </p>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Subscriptions</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Alerts, Incidents, Events
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connection Diagnostics</CardTitle>
              <CardDescription>Check REST and real-time connectivity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Button variant="outline" className="justify-start gap-2" onClick={runConnectionTest} disabled={isTestingConnection}>
                  {isTestingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  Run Connection Test
                </Button>
                {wsStatus === "connected" ? (
                  <Button variant="outline" className="justify-start gap-2" onClick={ws.reconnect}>
                    <GitBranch className="h-4 w-4" />
                    Force Reconnect
                  </Button>
                ) : (
                  <Button variant="outline" className="justify-start gap-2" onClick={ws.reconnect}>
                    <GitBranch className="h-4 w-4" />
                    Reconnect Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Settings */}
        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
              <CardDescription>Version and build details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Version</span>
                  </div>
                  <p className="font-mono text-lg font-medium">{APP_VERSION}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Build Date</span>
                  </div>
                  <p className="font-mono text-lg font-medium">{BUILD_DATE}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Environment</span>
                  </div>
                  <p className="font-mono text-lg font-medium">
                    {import.meta.env.PROD ? "Production" : "Development"}
                  </p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">User Agent</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate max-w-xs">
                    {typeof navigator !== "undefined" ? navigator.userAgent : "Unknown"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Links & Resources</CardTitle>
              <CardDescription>Helpful links for development and support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href="https://github.com/shikhar-sahay/hawk3ye"
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <div className="flex items-center gap-3">
                        <GitBranch className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">GitHub Repository</p>
                          <p className="text-sm text-muted-foreground">Source code and issues</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Open the Hawk3ye repository on GitHub</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg text-muted-foreground cursor-not-allowed"
                      disabled
                      aria-disabled="true"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Security Policy</p>
                          <p className="text-sm text-muted-foreground">Report vulnerabilities (coming soon)</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Not yet available (placeholder for future security policy)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg text-muted-foreground cursor-not-allowed"
                      disabled
                      aria-disabled="true"
                    >
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Documentation</p>
                          <p className="text-sm text-muted-foreground">API reference and guides (coming soon)</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-50" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Not yet available (placeholder for future documentation site)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Future Settings (Planned)</CardTitle>
              <CardDescription>These sections will be implemented in future milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg opacity-60">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Data Retention</p>
                    <p className="text-sm text-muted-foreground">Configure event/alert retention policies</p>
                  </div>
                </div>
                <Badge variant="secondary">Planned</Badge>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg opacity-60">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Alert Rules</p>
                    <p className="text-sm text-muted-foreground">Custom detection thresholds and notifications</p>
                  </div>
                </div>
                <Badge variant="secondary">Planned</Badge>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg opacity-60">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Team Management</p>
                    <p className="text-sm text-muted-foreground">User roles, permissions, and SSO</p>
                  </div>
                </div>
                <Badge variant="secondary">Planned</Badge>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-muted/30 rounded-lg opacity-60">
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Integrations</p>
                    <p className="text-sm text-muted-foreground">Slack, PagerDuty, webhooks, SIEM exports</p>
                  </div>
                </div>
                <Badge variant="secondary">Planned</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={saveSettings} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save All Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}