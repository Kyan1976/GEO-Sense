/**
 * 后端 API 响应与实体的统一类型定义（审计 I8 基础设施）。
 *
 * 供客户端组件逐步替换 `any`，与 src/hooks/use-workspace-fetch.ts 配合使用：
 *   const { data } = useWorkspaceFetch<WorkspaceStats>(url);
 *
 * 字段基于 src/models/* 的 Mongoose schema。可选字段标注 ?。
 */

// ── 通用 ──
export interface ApiResponse<T = unknown> {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface PaginatedData<T> {
  items?: T[];
  total?: number;
  page?: number;
  totalPages?: number;
}

// ── 用户/工作区/成员 ──
export type UserRole = "admin" | "user";
export type MembershipRole = "owner" | "admin" | "editor" | "viewer";

export interface Workspace {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  ownerId: string;
  region?: string;
  language?: string;
  updateFrequency?: "daily" | "twice_daily";
  brandName?: string;
  brandNames?: string[];
  domain?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  id: string;
  _id?: string;
  userId: string;
  workspaceId: string;
  role: MembershipRole;
  joinedAt?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  image?: string;
  role: UserRole;
  createdAt?: string;
}

// ── 查询/检测 ──
export type QueryStatus = "active" | "paused" | "archived";

export interface Query {
  id: string;
  _id?: string;
  tenantId: string;
  queryText: string;
  engines?: string[];
  tags?: string[];
  topic?: string;
  status: QueryStatus;
  lastFetchedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackingResult {
  id: string;
  _id?: string;
  queryId: string;
  tenantId: string;
  engine: string;
  overviewText?: string;
  sources?: Source[];
  isBrandMentioned?: boolean;
  brandTextVisibility?: number;
  sentiment?: SentimentLabel;
  mentionType?: string;
  fetchedAt: string;
}

// ── 来源/竞品 ──
export interface Source {
  title?: string;
  link?: string;
  domain?: string;
  snippet?: string;
  position?: number;
  sourceType?: "self" | "competitor" | "third_party";
}

export interface Competitor {
  id: string;
  _id?: string;
  tenantId: string;
  name: string;
  domain?: string;
  aliases?: string[];
  createdAt?: string;
}

export interface CitationSource {
  domain: string;
  domainType?: string;
  totalUrls?: number;
  usedTotal?: number;
  usedPercent?: number;
  avgCitations?: number;
}

// ── 情感/可见度 ──
export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface VisibilityMetric {
  mentionRate?: number;
  shareOfVoice?: number;
  citationRate?: number;
  avgPosition?: number;
  sentiment?: SentimentBreakdown;
}

// ── 仪表盘统计 ──
export interface WorkspaceStats extends ApiResponse {
  totalQueries?: number;
  activeQueries?: number;
  totalResults?: number;
  brandMentionRate?: number;
  avgVisibility?: number;
  avgPosition?: number;
  competitorCount?: number;
  recentResults?: TrackingResult[];
  sentimentTrend?: Array<Record<string, number | string>>;
  visibilityTrend?: Array<{ date: string; value: number }>;
}

// ── 竞品概览(competitive-overview 端点) ──
export interface CompetitiveOverviewEntity {
  key: string;
  name: string;
  type?: "brand" | "competitor";
  visibility?: number;
  visibilityChange?: number | null;
  sentiment?: number;
  sentimentChange?: number | null;
  position?: number;
  positionChange?: number | null;
}

export interface CompetitiveOverviewResponse extends ApiResponse {
  entities: CompetitiveOverviewEntity[];
  timeseries?: { date: string; [key: string]: number | string }[];
}

// ── 来源分析(sources 端点) ──
export interface SourcesResponse extends ApiResponse {
  domains?: CitationSource[];
  typeDistribution?: Record<string, number>;
  totalCitations?: number;
  urls?: Source[];
}

// ── 通知 ──
export type NotificationType =
  | "brand_mentioned"
  | "brand_lost"
  | "competitor_mentioned"
  | "system";

export interface AppNotification {
  id: string;
  _id?: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message?: string;
  read?: boolean;
  createdAt: string;
}
