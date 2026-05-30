export type Role = "client" | "admin";

export type SourceType = "transcript" | "training" | "email" | "strategy_doc" | "faq" | "pdf_text";

export type SourceStatus = "uploaded" | "processing" | "draft_ready" | "published" | "failed";

export type WikiStatus = "draft" | "approved" | "published" | "rejected" | "needs_source";

export type AnswerState =
  | "answered_with_citations"
  | "needs_more_context"
  | "cpa_review_recommended"
  | "cannot_answer_from_approved_sources"
  | "escalated_to_team";

export interface ClientProfile {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  tier: string;
  entityType: string;
  lifecycleStage: string;
  tags: string[];
  hasChildren: boolean;
  accessStatus: string;
}

export interface SourceDocument {
  id: string;
  title: string;
  sourceType: SourceType;
  status: SourceStatus;
  visibility: string;
  visibilityTier: string;
  strategyKey: string;
  effectiveYear: string;
  audience: string;
  reviewOwner: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPage {
  id: string;
  sourceId: string | null;
  slug: string;
  title: string;
  summary: string;
  markdown?: string;
  status: WikiStatus;
  visibility: string;
  visibilityTier: string;
  strategyKey: string;
  effectiveYear: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
}

export interface DownloadAsset {
  id: string;
  title: string;
  description: string;
  filename: string;
  mimeType: string;
  strategyKey: string;
  linkedSlug: string;
  status: string;
  visibilityTier: string;
  sortOrder: number;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  wikiPageId: string | null;
  quoteSpan: string;
  timestamp: string | null;
  clientVisibleUrl: string;
  confidence: number;
}

export interface TrainingRecommendation {
  title: string;
  strategyKey: string;
  reason: string;
  url: string;
  assetTitle?: string;
  assetUrl?: string;
}

export interface ChatAnswer {
  conversationId: string;
  answer: string;
  state: AnswerState;
  citations: Citation[];
  recommendedTrainings: TrainingRecommendation[];
  nextSteps: string[];
  confidence: number;
  escalationRequired: boolean;
  escalationReason: string | null;
  sourceDates: string[];
  modelId: string;
  promptVersion: string;
}

export interface Escalation {
  id: string;
  status: string;
  reason: string;
  question: string;
  redactedSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthFinding {
  id: string;
  severity: "low" | "medium" | "high";
  category: string;
  title: string;
  detail: string;
  status: string;
  createdAt: string;
}

export interface PlanItem {
  title: string;
  done: boolean;
  reason: string;
  strategyKey: string;
  slug?: string;
  assetTitle?: string;
  assetUrl?: string;
}

export interface AdminReviewItem {
  id: string;
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
  category: string;
  targetUrl?: string;
  count?: number;
  createdAt?: string;
}

export interface AdminReviewData {
  unansweredQuestions: AdminReviewItem[];
  lowConfidenceAnswers: AdminReviewItem[];
  repeatedConfusion: AdminReviewItem[];
  contentGaps: AdminReviewItem[];
  pagesNeedingReview: AdminReviewItem[];
}

export interface AppMe {
  authenticated: boolean;
  role: Role | null;
  client: ClientProfile | null;
  adminEmail: string | null;
}

export interface DashboardData {
  sources: SourceDocument[];
  wikiPages: WikiPage[];
  healthFindings: HealthFinding[];
  escalations: Escalation[];
  review: AdminReviewData;
  metrics: {
    publishedPages: number;
    draftPages: number;
    openEscalations: number;
    healthFindings: number;
    conversations: number;
    unansweredQuestions: number;
    lowConfidenceAnswers: number;
    repeatedConfusion: number;
    pagesNeedingReview: number;
  };
}
