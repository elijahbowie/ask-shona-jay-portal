import type { ClientProfile, DownloadAsset, PlanItem, TrainingRecommendation, WikiPage } from "../shared/types";

export const ALLOWED_GHL_TAGS = [
  "low",
  "mid",
  "high",
  "hire-kids",
  "has-kids",
  "augusta-rule",
  "estimated-taxes",
  "s-corp",
  "real-estate",
  "str",
  "minister",
  "retirement-planning",
  "irs-notice",
  "vehicle",
  "travel",
  "home-office",
  "medical",
  "qbi",
  "worker-classification",
  "year-end",
  "basis",
  "entity-protection"
];

export const STRATEGY_RECOMMENDATIONS: Record<string, { slug: string; assetStrategyKey?: string; reason: string }> = {
  "hire-kids-implementation-kit": {
    slug: "hiring-kids-implementation-kit",
    assetStrategyKey: "hire-kids-implementation-kit",
    reason: "Use the hiring kids kit before creating job descriptions, timesheets, or payroll records."
  },
  "hire-kids": {
    slug: "hiring-kids-implementation-kit",
    assetStrategyKey: "hire-kids-implementation-kit",
    reason: "Use the hiring kids kit before creating job descriptions, timesheets, or payroll records."
  },
  "has-kids": {
    slug: "hiring-kids-implementation-kit",
    assetStrategyKey: "hire-kids-implementation-kit",
    reason: "Your profile indicates children may be part of the strategy review."
  },
  "augusta-rule": {
    slug: "augusta-rule-meeting-packet",
    assetStrategyKey: "augusta-rule-meeting-packet",
    reason: "Use the Augusta meeting packet to document agenda, rate support, invoice, and minutes."
  },
  "augusta-rule-meeting-packet": {
    slug: "augusta-rule-meeting-packet",
    assetStrategyKey: "augusta-rule-meeting-packet",
    reason: "Use the Augusta meeting packet to document agenda, rate support, invoice, and minutes."
  },
  "estimated-tax-system": {
    slug: "estimated-tax-30-day-review-kit",
    assetStrategyKey: "estimated-tax-30-day-kit",
    reason: "Review estimated tax records 30 days before each quarterly deadline."
  },
  "estimated-taxes": {
    slug: "estimated-tax-30-day-review-kit",
    assetStrategyKey: "estimated-tax-30-day-kit",
    reason: "Review estimated tax records 30 days before each quarterly deadline."
  },
  "s-corp": {
    slug: "s-corp-owner-payroll-reasonable-compensation",
    reason: "S-corp owners need payroll, compensation, and distribution records reviewed together."
  },
  "real-estate": {
    slug: "cost-seg-str-real-estate-professional-intake-packet",
    assetStrategyKey: "real-estate-strategy-intake-packet",
    reason: "Real estate strategies need property records, depreciation support, and participation facts."
  },
  str: {
    slug: "cost-seg-str-real-estate-professional-intake-packet",
    assetStrategyKey: "real-estate-strategy-intake-packet",
    reason: "Short-term rental planning depends on rental days, owner hours, and loss limitation review."
  },
  minister: {
    slug: "ministerial-housing-allowance-review",
    reason: "Ministerial housing allowance requires designation, housing expense, and fair rental support."
  },
  "retirement-planning": {
    slug: "social-security-and-retirement-income-tax-planning",
    reason: "Retirement tax planning coordinates withdrawals, Social Security, pensions, and Roth decisions."
  },
  "irs-notice": {
    slug: "irs-notice-response-packet",
    assetStrategyKey: "irs-notice-response-packet",
    reason: "IRS notices need full notice pages, transcripts, payment proof, and deadline tracking."
  },
  vehicle: {
    slug: "vehicle-mileage-and-actual-expense-kit",
    assetStrategyKey: "vehicle-mileage-actual-expense-kit",
    reason: "Vehicle deductions need mileage logs and actual expense support."
  },
  travel: {
    slug: "business-travel-trip-memo-kit",
    assetStrategyKey: "business-travel-trip-memo-kit",
    reason: "Business travel needs trip purpose, itinerary, receipts, and personal-use allocation."
  },
  "home-office": {
    slug: "home-office-monthly-reimbursement-worksheet",
    assetStrategyKey: "home-office-reimbursement-worksheet",
    reason: "Home office reimbursements work best with monthly worksheets and bill support."
  },
  medical: {
    slug: "hsa-medical-deduction-decision-tree",
    reason: "Medical planning depends on coverage type, entity type, payroll, and reimbursement rules."
  },
  qbi: {
    slug: "qbi-deduction-basics-and-2026-watchpoint",
    reason: "QBI needs current-law review and entity, wage, property, and SSTB facts."
  },
  "worker-classification": {
    slug: "worker-classification-intake-checklist",
    assetStrategyKey: "worker-classification-intake-checklist",
    reason: "Worker classification should be reviewed before the first contractor or payroll payment."
  },
  "worker-classification-review": {
    slug: "worker-classification-intake-checklist",
    assetStrategyKey: "worker-classification-intake-checklist",
    reason: "Worker classification should be reviewed before the first contractor or payroll payment."
  },
  "worker-classification-intake-checklist": {
    slug: "worker-classification-intake-checklist",
    assetStrategyKey: "worker-classification-intake-checklist",
    reason: "Worker classification should be reviewed before the first contractor or payroll payment."
  },
  "year-end": {
    slug: "year-end-strategy-closeout-kit",
    assetStrategyKey: "year-end-closeout-kit",
    reason: "Year-end closeout confirms strategy support before filing season."
  },
  "year-end-strategy-review": {
    slug: "year-end-strategy-closeout-kit",
    assetStrategyKey: "year-end-closeout-kit",
    reason: "Year-end closeout confirms strategy support before filing season."
  },
  "year-end-closeout-kit": {
    slug: "year-end-strategy-closeout-kit",
    assetStrategyKey: "year-end-closeout-kit",
    reason: "Year-end closeout confirms strategy support before filing season."
  },
  "vehicle-mileage": {
    slug: "vehicle-mileage-and-actual-expense-kit",
    assetStrategyKey: "vehicle-mileage-actual-expense-kit",
    reason: "Vehicle deductions need mileage logs and actual expense support."
  },
  "vehicle-mileage-actual-expense-kit": {
    slug: "vehicle-mileage-and-actual-expense-kit",
    assetStrategyKey: "vehicle-mileage-actual-expense-kit",
    reason: "Vehicle deductions need mileage logs and actual expense support."
  },
  "business-travel-trip-memo-kit": {
    slug: "business-travel-trip-memo-kit",
    assetStrategyKey: "business-travel-trip-memo-kit",
    reason: "Business travel needs trip purpose, itinerary, receipts, and personal-use allocation."
  },
  "accountable-plan-system": {
    slug: "accountable-plan-monthly-reimbursement-kit",
    assetStrategyKey: "accountable-plan-monthly-kit",
    reason: "Accountable plan reimbursements need receipts, business purpose, approval, and payment proof."
  },
  "accountable-plan-monthly-kit": {
    slug: "accountable-plan-monthly-reimbursement-kit",
    assetStrategyKey: "accountable-plan-monthly-kit",
    reason: "Accountable plan reimbursements need receipts, business purpose, approval, and payment proof."
  },
  basis: {
    slug: "basis-tracking-for-real-estate-inheritance-and-entity-owners",
    reason: "Basis records affect losses, distributions, depreciation, sales, and inheritance planning."
  },
  "entity-protection": {
    slug: "power-of-entities-and-asset-protection",
    reason: "Entity protection planning connects asset ownership, contracts, insurance, and tax structure."
  }
};

export function normalizedClientTags(client: ClientProfile): string[] {
  const tags = new Set(client.tags);
  if (client.hasChildren) tags.add("has-kids");
  if (client.entityType.toLowerCase().includes("s_corp") || client.entityType.toLowerCase().includes("s-corp")) {
    tags.add("s-corp");
  }
  return Array.from(tags);
}

export function recommendPagesForClient(client: ClientProfile, pages: WikiPage[], assets: DownloadAsset[] = []): PlanItem[] {
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const assetByStrategy = new Map<string, DownloadAsset>();
  for (const asset of assets) {
    if (!assetByStrategy.has(asset.strategyKey)) {
      assetByStrategy.set(asset.strategyKey, asset);
    }
  }
  const output: PlanItem[] = [];
  const seen = new Set<string>();
  for (const tag of normalizedClientTags(client)) {
    const recommendation = STRATEGY_RECOMMENDATIONS[tag];
    const page = recommendation ? bySlug.get(recommendation.slug) : null;
    if (!recommendation || !page || seen.has(page.slug)) continue;
    const asset = recommendation.assetStrategyKey ? assetByStrategy.get(recommendation.assetStrategyKey) : undefined;
    seen.add(page.slug);
    output.push({
      title: page.title,
      done: false,
      reason: recommendation.reason,
      strategyKey: page.strategyKey,
      slug: page.slug,
      assetTitle: asset?.title,
      assetUrl: asset?.downloadUrl
    });
  }
  return output.slice(0, 8);
}

export function recommendationForStrategy(strategyKey: string, pages: WikiPage[], assets: DownloadAsset[] = []): TrainingRecommendation | null {
  const mapped = STRATEGY_RECOMMENDATIONS[strategyKey];
  const page = (mapped ? pages.find((item) => item.slug === mapped.slug) : null) || pages.find((item) => item.strategyKey === strategyKey);
  if (!page) return null;
  const asset = (mapped?.assetStrategyKey ? assets.find((item) => item.strategyKey === mapped.assetStrategyKey) : null)
    || assets.find((item) => item.strategyKey === strategyKey)
    || assets.find((item) => item.linkedSlug === page.slug);
  return {
    title: page.title,
    strategyKey: page.strategyKey,
    reason: mapped?.reason || `Open ${page.title} for the approved workflow.`,
    url: `/learn/${page.slug}`,
    assetTitle: asset?.title,
    assetUrl: asset?.downloadUrl
  };
}
