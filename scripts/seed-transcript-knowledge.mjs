#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PORTAL_ORIGIN = "https://ask.beyondfreedomfinancial.com";
const PRODUCTION_DB = "ask-shona-jay-db-production";
const PRODUCTION_BUCKET = "ask-shona-jay-content-production";
const PRODUCTION_VECTOR_INDEX = "ask-shona-jay-knowledge-production";
const TRANSCRIPT_ROOT = "/Users/elijahbowie/[Shona Bell] Wiki/Transcriptions";
const OUTPUT_DIR = ".transcript-knowledge-runs";
const REVIEW_OWNER = "Codex transcript knowledge expansion";
const SEED_BATCH = "transcript-derived-preview-2026-05-28-v1";
const FRESHNESS_REVIEW_DATE = "2026-05-29";
const REQUIRED_ENV = ["CLOUDFLARE_API_TOKEN", "ADMIN_MASTER_PASSWORD"];
const TENANT_ID = "tenant_beyond_freedom";
const ADMIN_AUTH_PATH = "/api/auth/admin-password";
const ADMIN_SOURCES_PATH = "/api/admin/sources";
const ADMIN_HEALTH_PATH = "/api/admin/health/run";
const HEADERS_JSON = { "content-type": "application/json" };
const PREVIEW_BANNER =
  "Transcript-derived Beyond Freedom education. Not personalized tax, legal, payroll, or state-law advice. Ask Shona/Jay before acting.";
const STALE_SEGMENT_PATTERNS = [
  /\b2024\b/,
  /\b2025\b/,
  /\b67 cents?\b/i,
  /\b70 cents?\b/i,
  /\b1\.22 million\b/i,
  /\b40%\b/,
  /\b15,000\b/,
  /\b15k\b/i,
  /\$\s?\d/,
  /\b\d{1,3},\d{3}\b/,
  /\bJanuary 31th\b/i
];

const official2026Sources = [
  ["IRS 2026 inflation adjustments", "https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill"],
  ["IRS 2026 standard mileage rates", "https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents"],
  ["IRS Publication 946 depreciation updates", "https://www.irs.gov/publications/p946"],
  ["IRS Publication 560 retirement plan limits", "https://www.irs.gov/publications/p560"],
  ["IRS QBI deduction page", "https://www.irs.gov/newsroom/qualified-business-income-deduction"]
];

const freshnessNotes = {
  "hire-kids": [
    "Do not rely on transcript references to a 2025 child standard deduction amount. For tax year 2026, the regular single standard deduction is $16,100, and dependent-child wage treatment still requires current-year review of earned income, dependency, payroll, and entity facts.",
    "W-2 and payroll filing deadlines should be checked against the applicable payroll calendar before implementation."
  ],
  "vehicle-mileage": [
    "Replace any transcript reference to the 2024 67-cent mileage rate or a 2025 rate. Beginning January 1, 2026, the IRS business standard mileage rate is 72.5 cents per mile.",
    "Clients may use standard mileage or actual costs only when the method is allowed for their facts; business-use logs remain mandatory."
  ],
  depreciation: [
    "Do not rely on transcript references to 2025 Section 179 or 40% bonus-depreciation examples without review.",
    "For tax years beginning in 2026, IRS Publication 946 lists a $2,560,000 maximum Section 179 deduction, phase-out after $4,090,000 of qualifying property, and a $32,000 SUV Section 179 cap.",
    "Publication 946 also says 100% special depreciation allowance was reinstated for certain qualified property acquired and placed in service after January 19, 2025, with election-out and eligibility rules."
  ],
  "cost-segregation": [
    "Cost segregation conclusions should be coordinated with 2026 depreciation law, passive activity limits, short-term rental or real estate professional facts, and the property's placed-in-service history.",
    "Do not quote stale bonus-depreciation percentages from older transcript examples without advisor review."
  ],
  "short-term-rental": [
    "Short-term rental loss treatment still depends on average-stay, services, material participation, passive activity, depreciation, and entity facts. A 2026 label does not prove losses are currently deductible.",
    "Escalate before applying cost segregation or depreciation-driven STR loss planning."
  ],
  "real-estate-professional": [
    "Real estate professional status remains fact-heavy. Require current-year time logs, other employment facts, property activity records, and material participation support before suggesting qualification.",
    "Do not let office-hours examples substitute for a 2026 qualification review."
  ],
  "llc-to-s-corp": [
    "S-corp conversion analysis must use current-year payroll, reasonable compensation, state fees, filing status, and election timing. Transcript examples are not a filing recommendation.",
    "Escalate before filing Form 2553 or changing owner pay/distribution patterns."
  ],
  "late-s-corp-election": [
    "Late S-corp election relief depends on current IRS procedures, effective dates, shareholder consent, reasonable cause, prior returns, and payroll facts.",
    "Escalate before filing Form 2553 or relying on a transcript example about a prior-year election."
  ],
  "medical-reimbursement": [
    "Medical and health reimbursement strategies require current plan-document, entity, owner-status, spouse-coverage, payroll, and reimbursement-path review.",
    "Do not treat transcript examples as a current 2026 plan setup."
  ],
  meals: [
    "Meal deduction percentages and entertainment-related restrictions should be verified for the current tax year before advising.",
    "Receipts alone are not enough; retain attendees, amount, date, place, and business-purpose notes."
  ],
  travel: [
    "Travel guidance should be applied with 2026 substantiation rules and mixed-purpose trip review.",
    "Escalate international, family, conference, and personal-days questions before deduction treatment is suggested."
  ],
  "home-office": [
    "Home office reimbursement examples mentioning prior-year worksheets are planning examples, not automatic 2026 deduction amounts.",
    "Use current-year expense records, square footage, accountable-plan procedures, and entity facts before implementation."
  ],
  "entity-protection": [
    "Entity and asset-protection discussion is not legal advice. Use current state law, operating documents, ownership facts, tax election records, payroll, and insurance review before action."
  ],
  "augusta-rule": [
    "Augusta Rule planning must be reviewed under current-year rental-day tracking, fair-rental support, business purpose, lease/payment records, entity facts, and state/local issues.",
    "Do not let transcript examples replace current comparable-rate support."
  ],
  "community-walkthrough": [
    "Portal navigation content is not tax guidance. Use the strategy pages and escalation path for current-year tax decisions."
  ],
  "office-hours-faq": [
    "Office-hours examples may involve prior filing years. Treat them as question patterns and teaching examples, not as 2026 conclusions.",
    "Escalate any answer that requires a 2026 limit, deadline, form, filing position, or eligibility conclusion."
  ]
};

const strategies = [
  strategy("Hiring Your Kids", "hire-kids", ["Hiring Your Kids Strategy"], ["kid", "child", "children", "payroll", "reasonable", "wage"], {
    overview: "Use this page to understand how Shona/Jay explain putting children to work in a real business role with clean records.",
    applies: ["Business owners with children who may perform real services.", "Clients comparing payroll, entity type, and documentation before moving money."],
    facts: ["Child age, duties, schedule, supervision, and examples of completed work.", "Entity type and payroll setup.", "Proposed pay and how it compares to the work performed."],
    documents: ["Job description.", "Timesheets or work logs.", "Payroll records and payment trail.", "Work samples or business deliverables."],
    mistakes: ["Paying without real work.", "Skipping payroll review.", "Assuming each entity type works the same way."],
    escalation: ["Before hiring a child.", "When payroll, labor law, entity type, or reasonable pay is unclear."],
    questions: ["What work can my child do?", "How much can I pay?", "Does my S-corp change the setup?"],
    links: [["IRS family employees", "https://www.irs.gov/businesses/small-businesses-self-employed/family-employees"]]
  }),
  strategy("Augusta Rule / 14-Day Rental", "augusta-rule", ["Augusta Strategy"], ["augusta", "rent", "rental", "lease", "meeting", "memo"], {
    overview: "Use this page to prepare the proof file for a business rental of a personal residence.",
    applies: ["Clients considering a business meeting or event at a residence.", "Clients who need to understand lease, memo, day-count, and fair rental documentation."],
    facts: ["Rental dates and total days.", "Business purpose, attendees, agenda, and minutes.", "Comparable rental support and payment path."],
    documents: ["Lease or rental agreement.", "Meeting agenda and memo.", "Comparable rental rates.", "Invoice and proof of payment."],
    mistakes: ["Skipping fair-rental support.", "Using personal space facts casually.", "Forgetting annual rental-day tracking."],
    escalation: ["Before taking an Augusta rental deduction.", "When entity, lease, fair rental value, or rental days need review."],
    questions: ["What should my meeting memo say?", "Can I rent my home to my business?", "What spaces count?"],
    links: [["IRC 280A", "https://www.law.cornell.edu/uscode/text/26/280A"]]
  }),
  strategy("Home Office Reimbursement", "home-office", ["Home Office Strategy"], ["home office", "reimburse", "worksheet", "mortgage", "utilities"], {
    overview: "Use this page to gather the home-office facts and expenses that Shona/Jay need to review reimbursement or deduction treatment.",
    applies: ["Clients who use part of their home for business.", "Clients trying to separate home office, mileage, and reimbursement questions."],
    facts: ["Office square footage and total home square footage.", "Expenses paid and business-use period.", "Entity type and reimbursement path."],
    documents: ["Home office worksheet.", "Mortgage/rent, utilities, insurance, internet, repairs, and related records.", "Photos or floor-plan support where helpful."],
    mistakes: ["Mixing personal and business use.", "Skipping reimbursement documentation.", "Double counting expenses."],
    escalation: ["Before changing reimbursement treatment.", "When the office overlaps with rental, Augusta, or personal-use facts."],
    questions: ["What expenses go on the worksheet?", "How do I measure my office?", "How does this interact with mileage?"],
    links: [["IRS Publication 587", "https://www.irs.gov/publications/p587"]]
  }),
  strategy("Meals Deduction", "meals", ["Meals Strategy"], ["meal", "restaurant", "receipt", "business purpose", "client"], {
    overview: "Use this page to document business meals in a way that supports review instead of guessing after the fact.",
    applies: ["Clients who buy meals with prospects, clients, team members, or business contacts.", "Clients who need to distinguish business purpose from personal spending."],
    facts: ["Who attended, business relationship, business purpose, date, and amount.", "Whether the meal is tied to travel, meetings, or entertainment-like activity."],
    documents: ["Receipts.", "Calendar notes.", "Attendee and business-purpose notes.", "Bookkeeping category support."],
    mistakes: ["Keeping only a credit card charge.", "Not writing the business purpose.", "Treating personal meals as business meals."],
    escalation: ["When meals are large, recurring, mixed personal/business, or tied to travel.", "When current-year deduction percentage needs confirmation."],
    questions: ["What should I write on a receipt?", "Can I deduct meals while traveling?", "What counts as business purpose?"],
    links: [["IRS Publication 463", "https://www.irs.gov/publications/p463"]]
  }),
  strategy("Business Travel Deduction", "travel", ["Travel Strategy"], ["travel", "trip", "flight", "hotel", "lodging", "business purpose"], {
    overview: "Use this page to separate business travel facts from personal travel facts before asking the team for review.",
    applies: ["Clients planning a business trip.", "Clients combining business, family, events, conferences, or client work."],
    facts: ["Destination, dates, business purpose, schedule, and personal days.", "Who traveled and why each traveler was needed."],
    documents: ["Itinerary.", "Receipts.", "Calendar and meeting notes.", "Conference or client-work support."],
    mistakes: ["Calling a mostly personal trip business travel.", "Not separating personal days.", "Missing receipts or business purpose notes."],
    escalation: ["Before deducting mixed-purpose travel.", "When family members, conferences, international travel, or large costs are involved."],
    questions: ["What makes travel business travel?", "Can I bring family?", "What records should I keep?"],
    links: [["IRS Publication 463", "https://www.irs.gov/publications/p463"]]
  }),
  strategy("Vehicle Deduction", "vehicle-mileage", ["Vehicle Strategy"], ["vehicle", "mileage", "car", "depreciation", "business use"], {
    overview: "Use this page to prepare vehicle records before choosing mileage, actual expense, depreciation, or reimbursement treatment.",
    applies: ["Clients using a vehicle for business.", "Clients considering a vehicle purchase or trying to document business-use percentage."],
    facts: ["Business miles, total miles, vehicle ownership, and business-use percentage.", "Whether the vehicle is used personally and how trips are logged."],
    documents: ["Mileage log.", "Odometer records.", "Purchase or lease documents.", "Fuel, repairs, insurance, and registration records."],
    mistakes: ["Reconstructing mileage at year-end.", "Missing total mileage.", "Assuming a vehicle purchase automatically creates a deduction."],
    escalation: ["Before buying a vehicle for tax reasons.", "When depreciation, listed property, or business-use percentage is involved."],
    questions: ["Should I use mileage or actual expenses?", "What should my mileage log show?", "Can I depreciate my vehicle?"],
    links: [["IRS Publication 463", "https://www.irs.gov/publications/p463"]]
  }),
  strategy("Medical / Health Reimbursement Strategy", "medical-reimbursement", ["Medical Strategy"], ["medical", "health", "reimburse", "premium", "insurance"], {
    overview: "Use this page to understand health and medical reimbursement concepts that require entity-specific setup and review.",
    applies: ["Clients paying health insurance or medical costs.", "Clients asking whether the business can reimburse or deduct health-related costs."],
    facts: ["Entity type, owner status, spouse coverage, plan documents, and payment path.", "Who incurred the cost and whether reimbursement procedures exist."],
    documents: ["Insurance premium records.", "Medical receipts.", "Plan or reimbursement documents.", "Payroll and owner compensation records where relevant."],
    mistakes: ["Mixing personal medical spending with business payments.", "Skipping plan setup.", "Ignoring entity-specific rules."],
    escalation: ["Before reimbursing medical costs.", "When S-corp owner, spouse coverage, payroll, or plan-document issues exist."],
    questions: ["Can my business pay medical expenses?", "Does entity type matter?", "What records should I keep?"],
    links: [["IRS Publication 535", "https://www.irs.gov/publications/p535"]]
  }),
  strategy("Power of Entities and Asset Protection", "entity-protection", ["The Power of Entities"], ["entity", "llc", "s-corp", "asset", "protection"], {
    overview: "Use this page to understand how Shona/Jay discuss entities as part tax structure, part operating structure, and part protection conversation.",
    applies: ["Clients forming or changing entities.", "Clients trying to separate tax strategy from legal protection and operations."],
    facts: ["Current entity, ownership, activity, risk exposure, payroll, and tax filing status.", "What problem the entity is meant to solve."],
    documents: ["Formation documents.", "Operating agreement.", "EIN letter.", "Tax election records.", "Insurance and contract records."],
    mistakes: ["Forming entities without maintaining them.", "Treating an LLC as automatically tax-optimized.", "Ignoring legal counsel for protection questions."],
    escalation: ["Before forming, converting, or moving assets between entities.", "When legal, state, payroll, or ownership facts are involved."],
    questions: ["What entity should I have?", "Does an LLC save taxes?", "When does S-corp treatment matter?"],
    links: [["IRS business structures", "https://www.irs.gov/businesses/small-businesses-self-employed/business-structures"]]
  }),
  strategy("LLC to S-Corp Conversion", "llc-to-s-corp", ["Should I convert my LLC to an S-Corp"], ["s corp", "s-corp", "llc", "payroll", "conversion", "reasonable"], {
    overview: "Use this page to evaluate the facts Shona/Jay want before an LLC owner elects S-corp tax treatment.",
    applies: ["LLC owners with profit high enough to consider payroll and distribution planning.", "Clients comparing tax savings against payroll, compliance, and admin requirements."],
    facts: ["Profit level, owner role, payroll readiness, state, entity docs, and current filing status.", "Reasonable compensation support and timing."],
    documents: ["Profit and loss.", "Entity documents.", "Payroll provider details.", "Prior returns.", "Owner job description."],
    mistakes: ["Electing too early.", "Ignoring payroll cost and compliance.", "Taking distributions without reasonable compensation review."],
    escalation: ["Before making an S-corp election.", "When payroll, timing, state fees, or owner compensation are unresolved."],
    questions: ["When should I convert my LLC?", "How much payroll do I need?", "What changes after S-corp election?"],
    links: [["IRS S corporations", "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations"]]
  }),
  strategy("Late S-Corp Election", "late-s-corp-election", ["How to file a Late S-Corp Election"], ["late", "s corp", "s-corp", "election", "2553"], {
    overview: "Use this page to gather facts before asking whether late S-corp election relief may be available.",
    applies: ["Clients who missed an S-corp election deadline.", "Clients who need to understand election timing and paperwork before filing."],
    facts: ["Entity formation date, intended effective date, filing history, payroll history, and reason for missing the deadline."],
    documents: ["Form 2553 draft or filed copy.", "Entity formation documents.", "Prior tax filings.", "Payroll and reasonable compensation records."],
    mistakes: ["Assuming relief applies automatically.", "Filing forms without checking facts.", "Ignoring payroll and reasonable compensation."],
    escalation: ["Before filing a late election.", "When effective dates, shareholder consent, payroll, or prior returns are involved."],
    questions: ["Can I still elect S-corp?", "What is Form 2553?", "What facts does the team need?"],
    links: [["IRS Form 2553", "https://www.irs.gov/forms-pubs/about-form-2553"]]
  }),
  strategy("Depreciation Strategy", "depreciation", ["Depreciation Strategy"], ["depreciation", "asset", "equipment", "placed in service", "bonus"], {
    overview: "Use this page to understand depreciation as a timing strategy that depends on asset type, use, and placed-in-service facts.",
    applies: ["Clients buying equipment, furniture, vehicles, or other business assets.", "Clients asking whether a purchase creates a current-year deduction."],
    facts: ["Asset description, purchase date, placed-in-service date, cost, and business-use percentage."],
    documents: ["Invoice.", "Financing or lease agreement.", "Placed-in-service support.", "Asset use records."],
    mistakes: ["Buying only for a deduction.", "Confusing purchase date and placed-in-service date.", "Skipping business-use support."],
    escalation: ["Before major purchases.", "When listed property, vehicles, bonus depreciation, or Section 179 choices matter."],
    questions: ["What does placed in service mean?", "Can I deduct equipment?", "How does depreciation interact with cash flow?"],
    links: [["IRS Publication 946", "https://www.irs.gov/publications/p946"]]
  }),
  strategy("Cost Segregation", "cost-segregation", ["Cost Seg Strategy"], ["cost segregation", "cost seg", "depreciation", "real estate", "study"], {
    overview: "Use this page to prepare property facts before considering a cost segregation study.",
    applies: ["Real estate owners evaluating accelerated depreciation.", "Clients comparing study cost, property facts, and tax benefit timing."],
    facts: ["Property type, purchase/build date, cost basis, use, income, and depreciation history."],
    documents: ["Closing statement.", "Depreciation schedule.", "Property details.", "Cost segregation proposal or study."],
    mistakes: ["Ordering a study without tax-benefit review.", "Ignoring passive activity limits.", "Missing prior depreciation records."],
    escalation: ["Before ordering or using a cost segregation study.", "When passive losses, STR, REP status, or amended returns are involved."],
    questions: ["When does cost segregation help?", "What documents are needed?", "How does this connect to STR or real estate professional status?"],
    links: [["IRS Publication 946", "https://www.irs.gov/publications/p946"]]
  }),
  strategy("Short-Term Rental Strategy", "short-term-rental", ["Short Term Rental Strategy"], ["short term", "short-term", "rental", "airbnb", "material participation"], {
    overview: "Use this page to understand why short-term rental tax treatment depends on average stay, services, participation, and depreciation facts.",
    applies: ["Clients operating or buying short-term rental property.", "Clients trying to understand losses, participation, and documentation."],
    facts: ["Average guest stay, services provided, owner hours, gross income, property basis, and depreciation records."],
    documents: ["Booking reports.", "Activity logs.", "Cleaning/management records.", "Closing statement and depreciation schedule."],
    mistakes: ["Assuming all rentals are treated the same.", "Reconstructing participation hours late.", "Ignoring property-level records."],
    escalation: ["Before claiming STR losses.", "When material participation, depreciation, or cost segregation is involved."],
    questions: ["What makes a rental short-term?", "How do I track participation?", "How does STR connect to cost segregation?"],
    links: [["IRS Publication 527", "https://www.irs.gov/publications/p527"]]
  }),
  strategy("Real Estate Professional Qualification", "real-estate-professional", ["Real Estate Pro Strategy"], ["real estate professional", "750", "hours", "material participation", "rental"], {
    overview: "Use this page to gather the records needed before asking whether real estate professional status may apply.",
    applies: ["Clients with rental real estate activity.", "Clients or spouses who spend significant time in real property trades or businesses."],
    facts: ["Hours by person, activity type, other employment, properties, services performed, and material participation support."],
    documents: ["Contemporaneous time logs.", "Property management records.", "Calendar entries.", "Job/business role summaries."],
    mistakes: ["Guessing hours at year-end.", "Counting investor-only time casually.", "Ignoring spouse and full-time-job facts."],
    escalation: ["Before relying on REP status.", "When hours, material participation, grouping, or loss treatment is involved."],
    questions: ["What hours count?", "Can my spouse qualify?", "How do I document participation?"],
    links: [["IRS Publication 925", "https://www.irs.gov/publications/p925"]]
  }),
  strategy("Community / Portal Walkthrough", "community-walkthrough", ["Community Video Walkthrough"], ["community", "portal", "training", "office hours", "question"], {
    overview: "Use this page to help clients navigate the training community, find resources, and submit better questions.",
    applies: ["New clients learning where to find trainings.", "Clients who want to use office hours and portal resources more effectively."],
    facts: ["Client tier, onboarding status, and the topic they are trying to find."],
    documents: ["Question notes.", "Relevant training title.", "Screenshots or links when a portal issue occurs."],
    mistakes: ["Skipping available trainings before office hours.", "Submitting vague questions without facts.", "Not saving notes from prior guidance."],
    escalation: ["When access is broken.", "When the question needs personalized CPA review rather than navigation help."],
    questions: ["Where do I ask a question?", "How do I find the training?", "What should I watch first?"],
    links: [["IRS Small Business and Self-Employed Tax Center", "https://www.irs.gov/businesses/small-businesses-self-employed"]]
  })
];

function strategy(title, strategyKey, trainingPathIncludes, keywords, details) {
  return { title, strategyKey, trainingPathIncludes, keywords, ...details };
}

function parseArgs(argv) {
  const args = { mode: null, manifestPath: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run" || item === "--apply" || item === "--rollback" || item === "--validate") {
      args.mode = item.slice(2);
      continue;
    }
    if (item === "--manifest") {
      args.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--force") {
      args.force = true;
      continue;
    }
    throw new Error(`Unknown argument: ${item}`);
  }
  if (!args.mode) {
    throw new Error("Choose one mode: --dry-run, --apply, --validate, or --rollback.");
  }
  return args;
}

function contentHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

function quoted(values) {
  return values.map((value) => `'${sqlEscape(value)}'`).join(", ");
}

function slugFor(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function latestManifestPath() {
  return path.join(OUTPUT_DIR, "latest-manifest.json");
}

function assertRequiredEnvironment(mode) {
  if (mode === "dry-run") return;
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for ${mode}: ${missing.join(", ")}`);
  }
}

async function ensureOutputDir() {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function listMarkdownFiles(root) {
  const output = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        output.push(fullPath);
      }
    }
  }
  await walk(root);
  return output.sort();
}

async function loadTranscripts() {
  if (!existsSync(TRANSCRIPT_ROOT)) {
    throw new Error(`Transcript root not found: ${TRANSCRIPT_ROOT}`);
  }
  const files = await listMarkdownFiles(TRANSCRIPT_ROOT);
  const transcripts = [];
  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    transcripts.push(parseTranscript(filePath, raw));
  }
  return transcripts;
}

function parseTranscript(filePath, raw) {
  const relativePath = path.relative(TRANSCRIPT_ROOT, filePath);
  const firstHeading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const duration = raw.match(/^\*\*Duration:\*\*\s+(.+)$/m)?.[1]?.trim() ?? null;
  const sourceFile = raw.match(/^\*\*Source file:\*\*\s+`(.+)`/m)?.[1]?.trim() ?? relativePath;
  const cleanStart = raw.indexOf("## Clean Transcript");
  const segmentsStart = raw.indexOf("## Timestamped Segments");
  const cleanTranscript = cleanStart >= 0
    ? raw.slice(cleanStart + "## Clean Transcript".length, segmentsStart >= 0 ? segmentsStart : raw.length).trim()
    : raw;
  const segmentBlock = segmentsStart >= 0 ? raw.slice(segmentsStart) : "";
  const segments = [];
  const segmentRegex = /^-\s+\[([^\]]+)\]\s+(.+)$/gm;
  let match = segmentRegex.exec(segmentBlock);
  while (match) {
    const text = normalizeWhitespace(match[2]);
    if (text.length > 20) {
      segments.push({ timestamp: match[1], text, relativePath, title: firstHeading ?? path.basename(filePath, ".md") });
    }
    match = segmentRegex.exec(segmentBlock);
  }
  return {
    filePath,
    relativePath,
    title: firstHeading ?? path.basename(filePath, ".md"),
    sourceFile,
    duration,
    raw,
    cleanTranscript,
    segments,
    isOfficeHours: relativePath.startsWith("Office Hours Recordings/")
  };
}

function normalizeWhitespace(input) {
  return input.replace(/\s+/g, " ").trim();
}

function scoreText(text, keywords) {
  const lowered = text.toLowerCase();
  return keywords.reduce((score, keyword) => score + occurrences(lowered, keyword.toLowerCase()), 0);
}

function occurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function findTrainingTranscript(transcripts, definition) {
  return transcripts.find((transcript) =>
    definition.trainingPathIncludes.some((needle) => transcript.relativePath.includes(needle))
  );
}

function selectSegments(transcripts, definition, { sourceType, limit }) {
  const seen = new Set();
  return transcripts
    .filter((transcript) => (sourceType === "office" ? transcript.isOfficeHours : !transcript.isOfficeHours))
    .flatMap((transcript) => transcript.segments)
    .map((segment) => ({ ...segment, score: scoreText(segment.text, definition.keywords) }))
    .filter((segment) => segment.score > 0 && !isStaleSegment(segment.text))
    .sort((left, right) => right.score - left.score)
    .filter((segment) => {
      const key = segment.text.toLowerCase().slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function isStaleSegment(text) {
  return STALE_SEGMENT_PATTERNS.some((pattern) => pattern.test(text));
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function sourceBullets(segments) {
  if (segments.length === 0) {
    return "- No timestamped transcript excerpt was selected for this section.";
  }
  return segments
    .map((segment) => `- **${segment.title}** (${segment.timestamp}): ${segment.text}`)
    .join("\n");
}

function sourceList(transcripts) {
  return transcripts
    .map((transcript) => `- ${transcript.relativePath}${transcript.duration ? ` (${transcript.duration})` : ""}`)
    .join("\n");
}

function freshnessReview(definition) {
  const notes = freshnessNotes[definition.strategyKey] ?? [
    "Apply current-year federal, state, payroll, legal, and entity rules before treating transcript content as implementation guidance."
  ];
  const sources = official2026Sources.map(([label, url]) => `- [${label}](${url})`).join("\n");
  return `## 2026 Freshness Review

**Reviewed for 2026 preview:** ${FRESHNESS_REVIEW_DATE}  
**Freshness rule:** If a transcript excerpt mentions 2024 or 2025 amounts, rates, forms, or deadlines, treat that excerpt as historical context only. Use current official sources and Shona/Jay review before client action.

${bulletList(notes)}

**Official 2026 reference set used for this freshness pass:**

${sources}
`;
}

function buildStrategyMarkdown(definition, trainingTranscript, trainingSegments, officeSegments) {
  const sourceTranscripts = [trainingTranscript, ...officeSegments.map((segment) =>
    ({ relativePath: segment.relativePath, duration: null })
  )];
  const uniqueSources = Array.from(new Map(sourceTranscripts.filter(Boolean).map((item) => [item.relativePath, item])).values());
  const publicLinks = definition.links.map(([label, url]) => `- [${label}](${url})`).join("\n");

  return `# ${definition.title}

> ${PREVIEW_BANNER}

**Preview status:** Transcript-Derived Preview: Educational Only  
**Tax year label:** 2026 transcript library  
**Review owner:** ${REVIEW_OWNER}  
**Strategy key:** ${definition.strategyKey}  
**Source quality note:** Whisper transcripts may contain misheard terms. Verify current-year limits, forms, deadlines, and client-specific facts before acting.

## Overview

${definition.overview}

${freshnessReview(definition)}

## Who This Applies To

${bulletList(definition.applies)}

## How Shona/Jay Frame This

The notes below are derived from Shona/Jay transcript content and are preview positioning, not final approved firm doctrine. Use them to understand the teaching angle, then escalate before implementing client-specific advice.

${sourceBullets(trainingSegments.slice(0, 5))}

## Fact-Gathering Checklist

These prompts gather facts for review. They do not conclude that a client qualifies.

${bulletList(definition.facts)}

## Documents To Gather

${bulletList(definition.documents)}

## Step-By-Step Implementation Notes

Review the transcript-backed notes below before taking this to Shona/Jay:

${sourceBullets(trainingSegments.slice(5, 12))}

## Office Hours Questions And Examples

These office-hours excerpts show how the topic comes up with real clients:

${sourceBullets(officeSegments.slice(0, 8))}

## Common Mistakes

${bulletList(definition.mistakes)}

## Escalation Triggers

Escalate to Shona/Jay before acting when any of these are true:

${bulletList(definition.escalation)}

## Related Questions

${bulletList(definition.questions)}

## Source Transcripts

${sourceList(uniqueSources)}

## Public-Source Backup Links

${publicLinks}

## Preview Boundary

This page is built from Shona/Jay transcript material so the portal can feel real during preview. It is not a final client launch document. State rules, payroll rules, labor law, legal documents, plan documents, current-year limits, and client-specific facts may change the answer.
`;
}

function buildOfficeIndexMarkdown(transcripts, synthesizedPages) {
  const officeTranscripts = transcripts.filter((transcript) => transcript.isOfficeHours);
  const strategySummary = synthesizedPages
    .map((page) => `- [${page.title}](/trainings/${slugFor(page.title)}): ${page.officeSegments.length} office-hours excerpts mapped to ${page.strategyKey}.`)
    .join("\n");
  const repeatedTopics = strategies
    .map((definition) => {
      const count = officeTranscripts.reduce((sum, transcript) => sum + scoreText(transcript.cleanTranscript, definition.keywords), 0);
      return { definition, count };
    })
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .map((item) => `- **${item.definition.title}:** ${item.count} keyword hits across office-hours transcripts.`)
    .join("\n");
  const reviewQueue = strategies
    .filter((definition) => ["real-estate-professional", "short-term-rental", "late-s-corp-election", "medical-reimbursement", "entity-protection"].includes(definition.strategyKey))
    .map((definition) => `- ${definition.title}: keep advisor review mandatory because qualification, filings, payroll, legal, or current-year facts can change the answer.`)
    .join("\n");

  return `# Office Hours Strategy Q&A Index

> ${PREVIEW_BANNER}

**Preview status:** Transcript-Derived Preview: Educational Only  
**Tax year label:** 2026 transcript library  
**Review owner:** ${REVIEW_OWNER}  
**Strategy key:** office-hours-faq  
**Source quality note:** This page summarizes topic frequency and routing guidance from office-hours transcripts. It should be reviewed by Shona/Jay before final client launch.

## Overview

The office-hours recordings are best used as a living FAQ layer. They show where clients get stuck, which strategies need clearer documentation, and which questions should be routed to Shona/Jay instead of answered generally.

${freshnessReview({ strategyKey: "office-hours-faq" })}

## Strategy Pages Updated From Office Hours

${strategySummary}

## Repeated Topic Signals

${repeatedTopics}

## Common Client Question Patterns

- “Can I do this strategy with my entity type?”
- “What records do I need before I move money?”
- “Can I combine this strategy with another one?”
- “Is this a general rule, or do Shona/Jay need to review my facts?”
- “Where do I find the training, worksheet, memo, or template?”

## Admin Review Queue

${reviewQueue}

## Source Transcripts

${sourceList(officeTranscripts)}

## Preview Boundary

This index does not replace the individual strategy pages. It tells the portal which client questions recur often enough to deserve structured answers, better training references, or escalation guidance.
`;
}

function buildSynthesizedPages(transcripts) {
  const pages = [];
  for (const definition of strategies) {
    const trainingTranscript = findTrainingTranscript(transcripts, definition);
    const trainingSegments = selectSegments(trainingTranscript ? [trainingTranscript] : transcripts, definition, {
      sourceType: "training",
      limit: 14
    });
    const officeSegments = selectSegments(transcripts, definition, { sourceType: "office", limit: 10 });
    pages.push({
      title: definition.title,
      strategyKey: definition.strategyKey,
      sourceType: "training",
      markdown: buildStrategyMarkdown(definition, trainingTranscript, trainingSegments, officeSegments),
      trainingTranscript: trainingTranscript?.relativePath ?? null,
      trainingSegmentCount: trainingSegments.length,
      officeSegments
    });
  }
  pages.push({
    title: "Office Hours Strategy Q&A Index",
    strategyKey: "office-hours-faq",
    sourceType: "faq",
    markdown: buildOfficeIndexMarkdown(transcripts, pages),
    trainingTranscript: null,
    trainingSegmentCount: 0,
    officeSegments: []
  });
  return pages;
}

async function execWrangler(args, options = {}) {
  const { stdout } = await execFileAsync("npx", ["wrangler", ...args], {
    env: { ...process.env },
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024
  });
  return stdout;
}

async function d1(sql) {
  const stdout = await execWrangler([
    "d1",
    "execute",
    PRODUCTION_DB,
    "--env",
    "production",
    "--remote",
    "--json",
    "--command",
    sql
  ]);
  return JSON.parse(stdout || "[]");
}

async function d1Results(sql) {
  const json = await d1(sql);
  return json?.[0]?.results ?? [];
}

async function d1Run(sql) {
  const json = await d1(sql);
  if (!json?.[0]?.success) {
    throw new Error(`D1 command failed: ${sql}`);
  }
}

async function r2Exists(key) {
  try {
    await execWrangler(["r2", "object", "get", `${PRODUCTION_BUCKET}/${key}`, "--env", "production", "--remote", "--pipe"], {
      maxBuffer: 1024 * 1024
    });
    return true;
  } catch {
    return false;
  }
}

async function deleteR2Object(key) {
  await execWrangler(["r2", "object", "delete", `${PRODUCTION_BUCKET}/${key}`, "--env", "production", "--remote"]);
}

async function deleteVectors(vectorIds) {
  if (vectorIds.length === 0) return;
  for (let index = 0; index < vectorIds.length; index += 100) {
    const batch = vectorIds.slice(index, index + 100);
    await execWrangler(["vectorize", "delete-vectors", PRODUCTION_VECTOR_INDEX, "--env", "production", "--ids", ...batch]);
  }
}

async function portalFetch(pathname, options = {}, cookieJar = null) {
  const headers = { ...(options.headers ?? {}) };
  if (cookieJar?.cookie) headers.cookie = cookieJar.cookie;
  const response = await fetch(`${PORTAL_ORIGIN}${pathname}`, { ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (cookieJar && setCookie) cookieJar.cookie = setCookie.split(";")[0];
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, text, json };
}

async function adminLogin() {
  const cookieJar = {};
  const result = await portalFetch(
    ADMIN_AUTH_PATH,
    {
      method: "POST",
      headers: HEADERS_JSON,
      body: JSON.stringify({ password: process.env.ADMIN_MASTER_PASSWORD })
    },
    cookieJar
  );
  if (!result.response.ok || result.json?.role !== "admin") {
    throw new Error(`Admin authentication failed: ${result.response.status} ${result.text.slice(0, 160)}`);
  }
  return cookieJar;
}

async function preflight({ dryRun, transcripts, synthesizedPages }) {
  console.log("Preflight: checking transcript corpus.");
  if (transcripts.length !== 29) {
    throw new Error(`Expected 29 transcript Markdown files, found ${transcripts.length}.`);
  }

  console.log("Preflight: checking portal health.");
  const health = await portalFetch("/api/health");
  if (!health.response.ok || health.json?.ok !== true || health.json?.environment !== "production") {
    throw new Error(`Production health check failed: ${health.response.status} ${health.text.slice(0, 160)}`);
  }

  if (!dryRun) {
    console.log("Preflight: checking admin authentication.");
    await adminLogin();
  }

  const rawTitles = transcripts.map((transcript) => rawSourceTitle(transcript));
  const pageTitles = synthesizedPages.map((page) => page.title);
  const slugs = pageTitles.map(slugFor);

  console.log("Preflight: checking duplicate sources and pages.");
  const existingRawSources = await d1Results(
    `SELECT id, title, status FROM source_documents WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(rawTitles)}) ORDER BY title`
  );
  const existingSynthSources = await d1Results(
    `SELECT id, title, status FROM source_documents WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(pageTitles)}) ORDER BY title`
  );
  const existingPages = await d1Results(
    `SELECT id, slug, title, status FROM wiki_pages WHERE tenant_id = '${TENANT_ID}' AND slug IN (${quoted(slugs)}) ORDER BY title`
  );

  console.log(
    `Preflight: existing raw sources=${existingRawSources.length}, synthesized sources=${existingSynthSources.length}, pages=${existingPages.length}.`
  );
  return { existingRawSources, existingSynthSources, existingPages };
}

function rawSourceTitle(transcript) {
  return `Raw Transcript: ${transcript.title}`;
}

function rawTranscriptPayload(transcript) {
  return {
    title: rawSourceTitle(transcript),
    sourceType: "transcript",
    content: `${transcript.raw}\n\n## Preview Boundary\n\n${PREVIEW_BANNER}\n`,
    visibility: "client",
    visibilityTier: "all",
    strategyKey: transcript.isOfficeHours ? "office-hours" : inferStrategyKey(transcript),
    effectiveYear: "2026",
    audience: "preview clients",
    reviewOwner: REVIEW_OWNER
  };
}

function inferStrategyKey(transcript) {
  const matched = strategies.find((definition) =>
    definition.trainingPathIncludes.some((needle) => transcript.relativePath.includes(needle))
  );
  return matched?.strategyKey ?? "training-transcript";
}

function synthesizedPayload(page) {
  return {
    title: page.title,
    sourceType: page.sourceType,
    content: page.markdown,
    visibility: "client",
    visibilityTier: "all",
    strategyKey: page.strategyKey,
    effectiveYear: "2026",
    audience: "preview clients",
    reviewOwner: REVIEW_OWNER
  };
}

function buildManifestBase() {
  return {
    id: `${SEED_BATCH}-${randomUUID()}`,
    seedBatch: SEED_BATCH,
    portalOrigin: PORTAL_ORIGIN,
    database: PRODUCTION_DB,
    bucket: PRODUCTION_BUCKET,
    vectorIndex: PRODUCTION_VECTOR_INDEX,
    tenantId: TENANT_ID,
    transcriptRoot: TRANSCRIPT_ROOT,
    startedAt: nowIso(),
    completedAt: null,
    status: "started",
    rawTranscriptSources: [],
    synthesizedSources: []
  };
}

async function writeManifest(manifest) {
  await ensureOutputDir();
  const manifestPath = path.join(OUTPUT_DIR, `${manifest.id}.json`);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, json);
  await writeFile(latestManifestPath(), json);
  return manifestPath;
}

async function postAdmin(cookieJar, pathname, body = null) {
  const result = await portalFetch(
    pathname,
    {
      method: "POST",
      headers: HEADERS_JSON,
      body: body ? JSON.stringify(body) : undefined
    },
    cookieJar
  );
  if (!result.response.ok) {
    throw new Error(`Admin POST ${pathname} failed: ${result.response.status} ${result.text.slice(0, 240)}`);
  }
  return result.json;
}

async function putAdmin(cookieJar, pathname, body) {
  const result = await portalFetch(
    pathname,
    {
      method: "PUT",
      headers: HEADERS_JSON,
      body: JSON.stringify(body)
    },
    cookieJar
  );
  if (!result.response.ok) {
    throw new Error(`Admin PUT ${pathname} failed: ${result.response.status} ${result.text.slice(0, 240)}`);
  }
  return result.json;
}

async function createRawTranscript(cookieJar, transcript, manifest) {
  const payload = rawTranscriptPayload(transcript);
  console.log(`Importing raw transcript source: ${payload.title}`);
  const created = await postAdmin(cookieJar, ADMIN_SOURCES_PATH, payload);
  const sourceRows = await d1Results(`SELECT * FROM source_documents WHERE id = '${sqlEscape(created.id)}' LIMIT 1`);
  const sourceRow = sourceRows[0];
  if (!sourceRow) {
    throw new Error(`Raw transcript source missing after create: ${payload.title}`);
  }
  manifest.rawTranscriptSources.push({
    title: payload.title,
    relativePath: transcript.relativePath,
    sourceId: created.id,
    contentHash: contentHash(payload.content),
    r2Keys: { raw: sourceRow.r2_key },
    status: sourceRow.status
  });
  await writeManifest(manifest);
}

async function createProcessPublish(cookieJar, page, manifest) {
  const payload = synthesizedPayload(page);
  console.log(`Publishing transcript-derived page: ${page.title}`);

  const created = await postAdmin(cookieJar, ADMIN_SOURCES_PATH, payload);
  const sourceId = created.id;
  const ingested = await postAdmin(cookieJar, `/api/admin/sources/${encodeURIComponent(sourceId)}/ingest`);
  const wikiId = ingested.wikiId;
  await putAdmin(cookieJar, `/api/admin/wiki/${encodeURIComponent(wikiId)}`, { markdown: payload.content });
  await postAdmin(cookieJar, `/api/admin/wiki/${encodeURIComponent(wikiId)}/publish`);

  const sourceRows = await d1Results(`SELECT * FROM source_documents WHERE id = '${sqlEscape(sourceId)}' LIMIT 1`);
  const pageRows = await d1Results(`SELECT * FROM wiki_pages WHERE id = '${sqlEscape(wikiId)}' LIMIT 1`);
  const chunkRows = await d1Results(
    `SELECT id, vector_id FROM knowledge_chunks WHERE tenant_id = '${TENANT_ID}' AND wiki_page_id = '${sqlEscape(wikiId)}' ORDER BY chunk_index`
  );
  const auditRows = await d1Results(
    `SELECT id, action, metadata_json, created_at FROM audit_events WHERE tenant_id = '${TENANT_ID}' AND target_id = '${sqlEscape(wikiId)}' ORDER BY created_at`
  );
  const sourceRow = sourceRows[0];
  const pageRow = pageRows[0];
  if (!sourceRow || !pageRow || chunkRows.length === 0) {
    throw new Error(`Post-publish D1 validation failed for ${page.title}`);
  }

  manifest.synthesizedSources.push({
    title: page.title,
    slug: slugFor(page.title),
    strategyKey: page.strategyKey,
    sourceType: page.sourceType,
    sourceId,
    wikiId,
    contentHash: contentHash(payload.content),
    status: {
      source: sourceRow.status,
      wiki: pageRow.status
    },
    r2Keys: {
      raw: sourceRow.r2_key,
      normalized: sourceRow.normalized_r2_key,
      compiled: pageRow.compiled_r2_key
    },
    chunks: chunkRows.map((row) => ({ id: row.id, vectorId: row.vector_id })),
    auditEvents: auditRows
  });
  await writeManifest(manifest);
}

async function dryRun() {
  assertRequiredEnvironment("dry-run");
  await ensureOutputDir();
  const transcripts = await loadTranscripts();
  const synthesizedPages = buildSynthesizedPages(transcripts);
  const preflightResult = await preflight({ dryRun: true, transcripts, synthesizedPages });
  const preview = {
    seedBatch: SEED_BATCH,
    mode: "dry-run",
    transcriptCount: transcripts.length,
    rawSourceCount: transcripts.length,
    synthesizedPageCount: synthesizedPages.length,
    duplicateRawSourceCount: preflightResult.existingRawSources.length,
    duplicateSynthesizedSourceCount: preflightResult.existingSynthSources.length,
    duplicatePageCount: preflightResult.existingPages.length,
    pages: synthesizedPages.map((page) => ({
      title: page.title,
      slug: slugFor(page.title),
      strategyKey: page.strategyKey,
      sourceType: page.sourceType,
      trainingTranscript: page.trainingTranscript,
      trainingSegmentCount: page.trainingSegmentCount,
      officeSegmentCount: page.officeSegments.length,
      contentHash: contentHash(page.markdown),
      bytes: Buffer.byteLength(page.markdown, "utf8")
    }))
  };
  const dryRunPath = path.join(OUTPUT_DIR, `${SEED_BATCH}-dry-run.json`);
  await writeFile(dryRunPath, `${JSON.stringify(preview, null, 2)}\n`);
  console.log(`Dry run complete. Wrote ${dryRunPath}`);
}

async function apply(args) {
  assertRequiredEnvironment("apply");
  await ensureOutputDir();
  const transcripts = await loadTranscripts();
  const synthesizedPages = buildSynthesizedPages(transcripts);
  const preflightResult = await preflight({ dryRun: false, transcripts, synthesizedPages });
  const duplicateCount =
    preflightResult.existingRawSources.length + preflightResult.existingSynthSources.length + preflightResult.existingPages.length;
  if (duplicateCount > 0 && !args.force) {
    throw new Error("Matching transcript seed sources/pages already exist. Re-run with --force only for an intentional recovery run.");
  }

  const cookieJar = await adminLogin();
  const manifest = buildManifestBase();
  await writeManifest(manifest);

  try {
    for (const transcript of transcripts) {
      await createRawTranscript(cookieJar, transcript, manifest);
    }
    for (const page of synthesizedPages) {
      await createProcessPublish(cookieJar, page, manifest);
    }
    await postAdmin(cookieJar, ADMIN_HEALTH_PATH);
    manifest.status = "applied";
    manifest.completedAt = nowIso();
    const manifestPath = await writeManifest(manifest);
    console.log(`Apply complete. Wrote rollback manifest: ${manifestPath}`);
  } catch (error) {
    manifest.status = "failed";
    manifest.completedAt = nowIso();
    manifest.failure = error instanceof Error ? error.message : String(error);
    const manifestPath = await writeManifest(manifest);
    console.error(`Apply failed. Partial rollback manifest: ${manifestPath}`);
    throw error;
  }
}

async function validate(manifestPath = null) {
  assertRequiredEnvironment("validate");
  const manifest = await readManifest(manifestPath);
  const transcripts = await loadTranscripts();
  const synthesizedPages = buildSynthesizedPages(transcripts);
  const rawTitles = transcripts.map(rawSourceTitle);
  const pageTitles = synthesizedPages.map((page) => page.title);

  const rawCountRows = await d1Results(
    `SELECT COUNT(*) AS total FROM source_documents WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(rawTitles)}) AND source_type = 'transcript'`
  );
  const sourceCountRows = await d1Results(
    `SELECT COUNT(*) AS total FROM source_documents WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(pageTitles)}) AND status = 'published'`
  );
  const wikiCountRows = await d1Results(
    `SELECT COUNT(*) AS total FROM wiki_pages WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(pageTitles)}) AND status = 'published'`
  );
  const chunkRows = await d1Results(
    `SELECT w.title, COUNT(k.id) AS chunks FROM wiki_pages w LEFT JOIN knowledge_chunks k ON k.wiki_page_id = w.id AND k.published = 1 WHERE w.tenant_id = '${TENANT_ID}' AND w.title IN (${quoted(pageTitles)}) GROUP BY w.title ORDER BY w.title`
  );
  const missingChunks = chunkRows.filter((row) => Number(row.chunks) < 1);

  console.log(`Validation: raw transcript sources ${Number(rawCountRows[0]?.total ?? 0)}/${rawTitles.length}`);
  console.log(`Validation: published synthesized sources ${Number(sourceCountRows[0]?.total ?? 0)}/${pageTitles.length}`);
  console.log(`Validation: published synthesized wiki pages ${Number(wikiCountRows[0]?.total ?? 0)}/${pageTitles.length}`);
  console.log(`Validation: pages missing chunks ${missingChunks.length}`);

  if (Number(rawCountRows[0]?.total ?? 0) !== rawTitles.length) {
    throw new Error("Validation failed for raw transcript source count.");
  }
  if (Number(sourceCountRows[0]?.total ?? 0) !== pageTitles.length || Number(wikiCountRows[0]?.total ?? 0) !== pageTitles.length) {
    throw new Error("Validation failed for published synthesized source/wiki counts.");
  }
  if (missingChunks.length > 0) {
    throw new Error("Validation failed because at least one published page has no chunks.");
  }

  if (manifest.synthesizedSources?.length > 0) {
    await validateManifestObjects(manifest);
  }
  const clientTrainingCount = await fetchClientTrainingCount(pageTitles);
  console.log(`Validation: transcript-derived pages visible through client API ${clientTrainingCount}/${pageTitles.length}`);
  if (clientTrainingCount !== pageTitles.length) {
    throw new Error("Client trainings API did not return all transcript-derived pages.");
  }
}

async function validateManifestObjects(manifest) {
  const auditRows = await d1Results(
    `SELECT target_id, action, COUNT(*) AS total FROM audit_events WHERE tenant_id = '${TENANT_ID}' AND action IN ('source.ingest', 'wiki.edit', 'wiki.publish', 'vector.upsert', 'vector.skip') GROUP BY target_id, action`
  );
  for (const record of manifest.synthesizedSources) {
    const keys = [record.r2Keys.raw, record.r2Keys.normalized, record.r2Keys.compiled].filter(Boolean);
    for (const key of keys) {
      const exists = await r2Exists(key);
      if (!exists) throw new Error(`Missing R2 object for ${record.title}: ${key}`);
    }
    const actions = auditRows.filter((row) => row.target_id === record.wikiId).map((row) => row.action);
    if (!actions.includes("wiki.publish")) throw new Error(`Missing wiki.publish audit event for ${record.title}`);
    if (!actions.includes("vector.upsert") && !actions.includes("vector.skip")) {
      throw new Error(`Missing vector audit event for ${record.title}`);
    }
    if (actions.includes("vector.skip")) {
      console.warn(`Degraded vector mode recorded for ${record.title}; D1 retrieval fallback remains available.`);
    }
  }
  for (const record of manifest.rawTranscriptSources ?? []) {
    if (record.r2Keys.raw && !(await r2Exists(record.r2Keys.raw))) {
      throw new Error(`Missing raw transcript R2 object for ${record.title}: ${record.r2Keys.raw}`);
    }
  }
}

async function fetchClientTrainingCount(pageTitles) {
  const clientIdRows = await d1Results(
    `SELECT id FROM client_profiles WHERE tenant_id = '${TENANT_ID}' AND email = 'bowiee@jahinc.org' LIMIT 1`
  );
  const clientId = clientIdRows[0]?.id;
  if (!clientId) {
    throw new Error("Missing bowiee@jahinc.org client profile for client API validation.");
  }
  const sessionId = `sess_seed_transcripts_${randomUUID().replaceAll("-", "")}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await d1Run(
    `INSERT INTO sessions (id, tenant_id, client_id, admin_email, role, expires_at, created_at) VALUES ('${sessionId}', '${TENANT_ID}', '${sqlEscape(clientId)}', NULL, 'client', '${expiresAt}', '${nowIso()}')`
  );
  try {
    const result = await portalFetch("/api/trainings", {
      method: "GET",
      headers: { cookie: `__Host_ask_shona_session=${sessionId}` }
    });
    if (!result.response.ok) {
      throw new Error(`Client trainings API failed: ${result.response.status} ${result.text.slice(0, 160)}`);
    }
    const expected = new Set(pageTitles);
    return (result.json?.trainings ?? []).filter((training) => expected.has(training.title)).length;
  } finally {
    await d1Run(`DELETE FROM sessions WHERE id = '${sessionId}'`);
  }
}

async function readManifest(manifestPath = null) {
  const resolvedPath = manifestPath || latestManifestPath();
  if (!existsSync(resolvedPath)) {
    if (!manifestPath) return { rawTranscriptSources: [], synthesizedSources: [] };
    throw new Error(`Manifest not found: ${resolvedPath}`);
  }
  return JSON.parse(await readFile(resolvedPath, "utf8"));
}

async function rollback(manifestPath = null) {
  assertRequiredEnvironment("rollback");
  const manifest = await readManifest(manifestPath);
  const synthesized = manifest.synthesizedSources ?? [];
  const raw = manifest.rawTranscriptSources ?? [];
  if (synthesized.length === 0 && raw.length === 0) {
    throw new Error("Rollback manifest has no sources.");
  }
  console.log(`Rollback: synthesized pages=${synthesized.length}, raw transcript sources=${raw.length}.`);

  const vectorIds = synthesized.flatMap((source) => source.chunks.map((chunk) => chunk.vectorId).filter(Boolean));
  await deleteVectors(vectorIds);

  const chunkIds = synthesized.flatMap((source) => source.chunks.map((chunk) => chunk.id).filter(Boolean));
  if (chunkIds.length > 0) await d1Run(`DELETE FROM knowledge_chunks WHERE id IN (${quoted(chunkIds)})`);

  const wikiIds = synthesized.map((source) => source.wikiId).filter(Boolean);
  if (wikiIds.length > 0) await d1Run(`DELETE FROM wiki_pages WHERE id IN (${quoted(wikiIds)})`);

  const sourceIds = [...synthesized.map((source) => source.sourceId), ...raw.map((source) => source.sourceId)].filter(Boolean);
  if (sourceIds.length > 0) await d1Run(`DELETE FROM source_documents WHERE id IN (${quoted(sourceIds)})`);

  const r2Keys = [
    ...synthesized.flatMap((source) => [source.r2Keys.raw, source.r2Keys.normalized, source.r2Keys.compiled]),
    ...raw.flatMap((source) => [source.r2Keys.raw])
  ].filter(Boolean);
  for (const key of r2Keys) {
    await deleteR2Object(key);
  }

  await d1Run(
    `INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES ('audit_${randomUUID().replaceAll("-", "")}', '${TENANT_ID}', 'seed-transcript-knowledge-script', 'seed.rollback', 'seed_batch', '${sqlEscape(manifest.id)}', '${sqlEscape(JSON.stringify({ rawCount: raw.length, synthesizedCount: synthesized.length }))}', '${nowIso()}')`
  );
  console.log("Rollback complete.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "dry-run") {
    await dryRun();
    return;
  }
  if (args.mode === "apply") {
    await apply(args);
    return;
  }
  if (args.mode === "validate") {
    await validate(args.manifestPath);
    return;
  }
  if (args.mode === "rollback") {
    await rollback(args.manifestPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
