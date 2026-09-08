"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Key,
  Copy,
  RotateCcw,
  Loader2,
  RefreshCw,
  Server,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, formatRelativeTime, copyTextToClipboard } from "@/lib/utils";
import { apiClient, queryKeys } from "@/api/client";
import type { Source, SourceCreate, SourceUpdate, ApiKey, ApiKeyCreate, SourceListResponse } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function SourceManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");
  const [selectedSource, setSelectedSource] = React.useState<Source | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [deleteSourceId, setDeleteSourceId] = React.useState<number | null>(null);
  const [showApiKeysForSource, setShowApiKeysForSource] = React.useState<number | null>(null);
  const [newApiKeyName, setNewApiKeyName] = React.useState("");
  const [newApiKeyExpiresIn, setNewApiKeyExpiresIn] = React.useState<number | undefined>(undefined);
  const [showNewKey, setShowNewKey] = React.useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = React.useState<number | null>(null);
  const [revokeKeyId, setRevokeKeyId] = React.useState<number | null>(null);
  const [rotateKeyId, setRotateKeyId] = React.useState<number | null>(null);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);

  // Form state for create/edit
  const [formData, setFormData] = React.useState<SourceCreate>({
    name: "",
    description: "",
    is_active: true,
  });

  // Debounce search input into the query used for server-side search
  React.useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to first page whenever server-side filters change
  React.useEffect(() => {
    setPage(0);
  }, [searchQuery, statusFilter]);

  // Fetch sources with server-side pagination + search + status filter
  const {
    data: sourcesResponse,
    dataUpdatedAt,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<SourceListResponse>({
    queryKey: [...queryKeys.sources.all, { search: searchQuery || undefined, is_active: statusFilter === "all" ? undefined : statusFilter === "active", page, pageSize }],
    queryFn: () =>
      apiClient.getSources({
        limit: pageSize,
        offset: page * pageSize,
        search: searchQuery || undefined,
        is_active: statusFilter === "all" ? undefined : statusFilter === "active",
      }),
    staleTime: 30000,
  });

  // Refresh handler: forces a network fetch and surfaces the outcome.
  // TanStack keeps showing current data while fetching; without explicit
  // feedback an unchanged result looked like a dead button.
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await refetch();
      if (result.isError) {
        toast({
          title: "Refresh failed",
          description: (result.error as Error)?.message ?? "Could not load sources.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sources refreshed",
          description: `${result.data?.total ?? 0} sources loaded.`,
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Deep link: /sources?source=ID selects that source (global search)
  const deepLinkSourceId = searchParams.get("source");
  const deepLinkAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (!deepLinkSourceId || deepLinkAppliedRef.current || !sourcesResponse) return;
    const id = Number(deepLinkSourceId);
    const match = sourcesResponse.sources.find((s) => s.id === id) ?? null;
    if (match) {
      setSelectedSource(match);
      setShowApiKeysForSource(match.id);
      deepLinkAppliedRef.current = true;
      const params = new URLSearchParams(searchParams);
      params.delete("source");
      setSearchParams(params, { replace: true });
    }
  }, [deepLinkSourceId, sourcesResponse, searchParams, setSearchParams]);

  // Fetch API keys for selected source
  const {
    data: apiKeysResponse,
    isLoading: isApiKeysLoading,
    refetch: refetchApiKeys,
  } = useQuery({
    queryKey: queryKeys.apiKeys.all(selectedSource?.id ?? 0),
    queryFn: () => apiClient.getApiKeys(selectedSource!.id),
    enabled: !!selectedSource && showApiKeysForSource === selectedSource.id,
    staleTime: 30000,
  });

  // Create source mutation
  const createSourceMutation = useMutation({
    mutationFn: (data: SourceCreate) => apiClient.createSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      toast({ title: "Source created", description: "The source has been created successfully." });
      setIsCreateDialogOpen(false);
      setFormData({ name: "", description: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create source", description: error.message, variant: "destructive" });
    },
  });

  // Update source mutation
  const updateSourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SourceUpdate }) => apiClient.updateSource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      toast({ title: "Source updated", description: "The source has been updated successfully." });
      setIsEditDialogOpen(false);
      setSelectedSource(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update source", description: error.message, variant: "destructive" });
    },
  });

  // Delete source mutation
  const deleteSourceMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      toast({ title: "Source deleted", description: "The source has been deleted successfully." });
      setDeleteSourceId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete source", description: error.message, variant: "destructive" });
      setDeleteSourceId(null);
    },
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: ({ sourceId, data }: { sourceId: number; data: ApiKeyCreate }) =>
      apiClient.createApiKey(sourceId, data),
    onSuccess: (response) => {
      refetchApiKeys();
      setNewApiKeyName("");
      setNewApiKeyExpiresIn(undefined);
      setShowNewKey(response.api_key);
      toast({ title: "API key created", description: "Copy the key now - it won't be shown again." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create API key", description: error.message, variant: "destructive" });
    },
  });

  // Revoke API key mutation
  const revokeApiKeyMutation = useMutation({
    mutationFn: ({ sourceId, keyId }: { sourceId: number; keyId: number }) =>
      apiClient.revokeApiKey(sourceId, keyId),
    onSuccess: () => {
      refetchApiKeys();
      toast({ title: "API key revoked", description: "The API key has been revoked successfully." });
      setRevokeKeyId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to revoke API key", description: error.message, variant: "destructive" });
      setRevokeKeyId(null);
    },
  });

  // Handle source selection for API keys
  const handleSourceClick = (source: Source) => {
    if (selectedSource?.id === source.id) {
      setSelectedSource(null);
      setShowApiKeysForSource(null);
    } else {
      setSelectedSource(source);
      setShowApiKeysForSource(source.id);
    }
  };

  // Handle API key copy
  const handleCopyApiKey = async (key: string, keyId: number) => {
    const ok = await copyTextToClipboard(key);
    if (ok) {
      setCopyFeedback(keyId);
      setTimeout(() => setCopyFeedback(null), 2000);
    } else {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  // Handle create source form submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createSourceMutation.mutate(formData);
  };

  // Handle edit source form submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource || !formData.name.trim()) return;
    updateSourceMutation.mutate({ id: selectedSource.id, data: formData });
  };

  // Handle edit dialog open
  const handleEditOpen = (source: Source, e?: React.MouseEvent) => {
    setSelectedSource(source);
    setFormData({ name: source.name, description: source.description || "", is_active: source.is_active });
    setIsEditDialogOpen(true);
    e?.stopPropagation();
  };

  // Handle delete confirmation
  const handleDeleteConfirm = (id: number) => {
    setDeleteSourceId(id);
  };

  // Handle create API key
  const handleCreateApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource || !newApiKeyName.trim()) return;
    createApiKeyMutation.mutate({
      sourceId: selectedSource.id,
      data: { name: newApiKeyName, expires_in_days: newApiKeyExpiresIn },
    });
  };

  // Handle revoke API key
  const handleRevokeConfirm = (keyId: number) => {
    if (!selectedSource) return;
    setRevokeKeyId(keyId);
  };

  // Handle rotate API key (revoke old + create new with same name; preserve
  // remaining validity window of the old key)
  const handleRotateApiKey = async (key: ApiKey) => {
    if (!selectedSource) return;
    setRotateKeyId(key.id);
    try {
      // Revoke old key
      await apiClient.revokeApiKey(selectedSource.id, key.id);
      const expiresInDays = key.expires_at
        ? Math.max(1, Math.ceil((new Date(key.expires_at).getTime() - Date.now()) / 86_400_000))
        : undefined;
      // Create new key with same name and remaining validity
      const response = await apiClient.createApiKey(selectedSource.id, {
        name: key.name,
        expires_in_days: expiresInDays,
      });
      refetchApiKeys();
      setShowNewKey(response.api_key);
      toast({ title: "API key rotated", description: "New key generated. Copy it now." });
    } catch (error) {
      toast({ title: "Failed to rotate API key", description: (error as Error).message, variant: "destructive" });
    } finally {
      setRotateKeyId(null);
    }
  };

  const sources = sourcesResponse?.sources || [];
  const apiKeys = apiKeysResponse || [];

  // Handle form data change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (isRefreshing || isFetching) && "animate-spin")} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {dataUpdatedAt > 0 && !isFetching && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {formatRelativeTime(new Date(dataUpdatedAt))}
            </span>
          )}
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sources by name, description..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "active" | "inactive")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {(searchQuery || statusFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchInput(""); setStatusFilter("all"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Sources</CardTitle>
            {sourcesResponse && (
              <Badge variant="secondary">{sourcesResponse.total} total</Badge>
            )}
          </div>
          <CardDescription>
            Click a source to manage its API keys
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && sourcesResponse === undefined ? (
            <div className="p-8 text-center">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded" />
                ))}
              </div>
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive">
              <p>Failed to load sources</p>
              <p className="text-sm text-muted-foreground mt-1">{error?.message}</p>
              <Button className="mt-4" variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : sources.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sources found</p>
              <p className="text-sm mt-1">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters or search query"
                  : "Create your first source to get started"}
              </p>
              {(!searchQuery && statusFilter === "all") && (
                <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Source
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="w-40 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((source) => (
                      <TableRow
                        key={source.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50 transition-colors",
                          selectedSource?.id === source.id && "bg-primary/5"
                        )}
                        onClick={() => handleSourceClick(source)}
                      >
                        <TableCell className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOpen(source);
                            }}
                            aria-label="Edit source"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {source.name}
                          {selectedSource?.id === source.id && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              Selected
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-muted-foreground">
                          {source.description || "-"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={source.is_active ? "default" : "secondary"}>
                            {source.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {new Date(source.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteConfirm(source.id);
                              }}
                              aria-label="Delete source"
                              disabled={deleteSourceMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {sourcesResponse && sourcesResponse.total > pageSize ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, sourcesResponse.total)} of {sourcesResponse.total} sources
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground w-20 text-center">
                      Page {page + 1} of {Math.ceil(sourcesResponse.total / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(Math.ceil((sourcesResponse.total - 1) / pageSize), p + 1))}
                      disabled={(page + 1) * pageSize >= sourcesResponse.total || isLoading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v)); setPage(0); }}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="20">20 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                        <SelectItem value="100">100 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* API Keys Section */}
      {selectedSource && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">API Keys for "{selectedSource.name}"</CardTitle>
                <CardDescription>Manage API keys for this source</CardDescription>
              </div>
              <Button onClick={handleCreateApiKey} disabled={createApiKeyMutation.isPending}>
                <Key className="h-4 w-4 mr-2" />
                Generate Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Create API Key Form */}
            <form onSubmit={handleCreateApiKey} className="mb-6 p-4 border rounded-lg bg-muted/30">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="api-key-name">Key Name</Label>
                  <Input
                    id="api-key-name"
                    placeholder="e.g., Production Server, CI/CD Pipeline"
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    required
                    disabled={createApiKeyMutation.isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="api-key-expires">Expires In (days)</Label>
                  <Input
                    id="api-key-expires"
                    type="number"
                    placeholder="Optional"
                    value={newApiKeyExpiresIn ?? ""}
                    onChange={(e) => setNewApiKeyExpiresIn(e.target.value ? parseInt(e.target.value) : undefined)}
                    min="1"
                    max="3650"
                    disabled={createApiKeyMutation.isPending}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={createApiKeyMutation.isPending || !newApiKeyName.trim()}>
                  {createApiKeyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Key"
                  )}
                </Button>
              </div>
            </form>

            {/* New API Key Display */}
            {showNewKey && (
              <AlertDialog open={!!showNewKey} onOpenChange={(open) => !open && setShowNewKey(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>API Key Generated</AlertDialogTitle>
                    <AlertDialogDescription>
                      Copy this key now. It will not be shown again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mb-4 p-4 bg-muted rounded-lg font-mono text-sm break-all">
                    {showNewKey}
                  </div>
                  <AlertDialogFooter>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const ok = await copyTextToClipboard(showNewKey);
                        if (ok) {
                          setCopyFeedback(-1);
                          setTimeout(() => setCopyFeedback(null), 2000);
                        } else {
                          toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
                        }
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Key
                    </Button>
                    <AlertDialogAction onClick={() => setShowNewKey(null)}>
                      Done
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* API Keys List */}
            {isApiKeysLoading ? (
              <div className="p-8 text-center">
                <div className="animate-pulse space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded" />
                  ))}
                </div>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No API keys found</p>
                <p className="text-sm mt-1">Generate your first API key above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Used</TableHead>
                      <TableHead className="hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="hidden lg:table-cell">Created</TableHead>
                      <TableHead className="w-48 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell className="font-mono text-sm">{key.key_prefix}••••</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={key.is_active ? "default" : "secondary"}>
                            {key.is_active ? "Active" : "Revoked"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {key.last_used_at
                            ? new Date(key.last_used_at).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {key.expires_at
                            ? new Date(key.expires_at).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {new Date(key.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right p-3">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleCopyApiKey(key.key_prefix, key.id)}
                                    aria-label="Copy key prefix"
                                    disabled={!key.is_active}
                                  >
                                    <Copy className={cn("h-4 w-4", copyFeedback === key.id ? "text-success" : "")} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Copy key prefix (full key only shown once on creation)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {key.is_active && (
                              <>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleRotateApiKey(key)}
                                        aria-label="Rotate key"
                                        disabled={rotateKeyId === key.id}
                                      >
                                        {rotateKeyId === key.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RotateCcw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Rotate key (revokes old, creates new with same name)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive"
                                        onClick={() => handleRevokeConfirm(key.id)}
                                        aria-label="Revoke key"
                                        disabled={revokeKeyId === key.id}
                                      >
                                        {revokeKeyId === key.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Revoke key (cannot be undone)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Source Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Source</DialogTitle>
            <DialogDescription>Register a new application source</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="source-name">Name *</Label>
                <Input
                  id="source-name"
                  name="name"
                  placeholder="e.g., Production Web App"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  disabled={createSourceMutation.isPending}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="source-description">Description</Label>
                <Input
                  id="source-description"
                  name="description"
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={handleFormChange}
                  disabled={createSourceMutation.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={createSourceMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSourceMutation.isPending || !formData.name.trim()}>
                {createSourceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Source"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Source Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Source</DialogTitle>
            <DialogDescription>Update source details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="edit-source-name">Name *</Label>
                <Input
                  id="edit-source-name"
                  name="name"
                  placeholder="e.g., Production Web App"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  disabled={updateSourceMutation.isPending}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="edit-source-description">Description</Label>
                <Input
                  id="edit-source-description"
                  name="description"
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={handleFormChange}
                  disabled={updateSourceMutation.isPending}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-source-active"
                  checked={selectedSource?.is_active ?? true}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                  disabled={updateSourceMutation.isPending}
                />
                <Label htmlFor="edit-source-active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={updateSourceMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateSourceMutation.isPending || !formData.name.trim()}>
                {updateSourceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Source Confirmation */}
      <AlertDialog open={!!deleteSourceId} onOpenChange={(open) => !open && setDeleteSourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this source? This action cannot be undone. All associated API keys will also be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSourceId) deleteSourceMutation.mutate(deleteSourceId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSourceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke API Key Confirmation */}
      <AlertDialog open={!!revokeKeyId} onOpenChange={(open) => !open && setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke this API key? This action cannot be undone. The key will immediately stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedSource && revokeKeyId) revokeApiKeyMutation.mutate({ sourceId: selectedSource.id, keyId: revokeKeyId });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokeApiKeyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Revoking...
                </>
              ) : (
                "Revoke"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}