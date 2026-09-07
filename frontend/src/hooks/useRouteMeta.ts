import * as React from "react";

/**
 * useDocumentTitle - sets a per-route document title (restored to the
 * site default on unmount). Keeps every route meaningfully titled
 * without pulling in a helmet dependency.
 */
export function useDocumentTitle(title: string | undefined) {
  React.useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} · Hawk3ye`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}

/**
 * useRouteMeta - sets title + meta description for a route.
 */
export function useRouteMeta(title: string, description?: string) {
  useDocumentTitle(title);
  React.useEffect(() => {
    if (!description) return;
    const el = document.querySelector('meta[name="description"]');
    const prev = el?.getAttribute("content") ?? null;
    el?.setAttribute("content", description);
    return () => {
      if (prev !== null) el?.setAttribute("content", prev);
    };
  }, [description]);
}
