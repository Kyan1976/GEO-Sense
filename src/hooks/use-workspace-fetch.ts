"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 统一工作区数据获取 hook（审计 I7）。
 *
 * 解决现有组件普遍存在的：
 *  - catch {} 空捕获，错误对用户不可见
 *  - 重复的 fetch + loading + state 样板
 *  - 缺少 error / retry 状态
 *
 * 用法：
 *   const { data, loading, error, refetch } = useWorkspaceFetch(
 *     workspaceId ? `/api/workspaces/${workspaceId}/sources` : null
 *   );
 *
 * 传 null 作为 url 则不请求（用于依赖 workspaceId 的场景）。
 */
export function useWorkspaceFetch<T = unknown>(
  url: string | null,
  options?: { method?: string; body?: unknown }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    const myId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const init: RequestInit = { method: options?.method ?? "GET" };
      if (options?.body !== undefined) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(options.body);
      }
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }
      const json = await res.json();
      // 防止旧请求覆盖新数据（竞态保护）
      if (reqIdRef.current !== myId) return;
      setData(json as T);
    } catch (err) {
      if (reqIdRef.current !== myId) return;
      const msg = err instanceof Error ? err.message : "数据加载失败";
      setError(msg);
      // 不再静默吞错，调用方可据 error 展示提示
      console.error(`[useWorkspaceFetch] ${url}:`, err);
    } finally {
      if (reqIdRef.current === myId) setLoading(false);
    }
  }, [url, options?.method, options?.body]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, setData };
}
