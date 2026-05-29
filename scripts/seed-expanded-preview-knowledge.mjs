#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PORTAL_ORIGIN = "https://ask.beyondfreedomfinancial.com";
const PRODUCTION_DB = "ask-shona-jay-db-production";
const PRODUCTION_BUCKET = "ask-shona-jay-content-production";
const PRODUCTION_VECTOR_INDEX = "ask-shona-jay-knowledge-production";
const OUTPUT_DIR = ".seed-preview-knowledge";
const SOURCE_ACCESSED_DATE = "2026-05-24";
const REVIEW_OWNER = "Codex public research expansion";
const SEED_BATCH = "public-source-preview-expanded-2026-05-24-v1";
const REQUIRED_ENV = ["CLOUDFLARE_API_TOKEN", "ADMIN_MASTER_PASSWORD"];
const TENANT_ID = "tenant_beyond_freedom";
const HEADERS_JSON = { "content-type": "application/json" };

const seedSources = [
  page("Monthly Bookkeeping and Recordkeeping Rhythm", "recordkeeping", [
    "Set a monthly close rhythm that keeps income, expenses, assets, liabilities, and owner activity visible before year-end.",
    "Use this when a client has messy books, unreconciled bank feeds, missing receipts, or questions that depend on current profit."
  ], [
    "Bank and credit card statements for every business account.",
    "Receipt files, invoices, deposit records, merchant processor reports, and loan statements.",
    "A month-end checklist showing reconciliations, owner draws, reimbursements, payroll, and accounts receivable."
  ], [
    "What should be closed every month before Shona/Jay review planning?",
    "Which records matter most if the IRS asks for support?",
    "How do I separate business and personal spending?"
  ], [
    ["IRS recordkeeping: what kind of records should I keep", "https://www.irs.gov/businesses/small-businesses-self-employed/what-kind-of-records-should-i-keep"],
    ["IRS Publication 583, Starting a Business and Keeping Records", "https://www.irs.gov/publications/p583"]
  ]),
  page("Cash vs Accrual Accounting Method: Timing Questions", "accounting-methods", [
    "Cash and accrual methods affect when income and expenses are reported. The portal should gather facts before anyone changes timing assumptions.",
    "Use this when invoices, prepayments, inventory, receivables, payables, or year-end timing decisions affect taxable income."
  ], [
    "Current bookkeeping method and prior-year tax return method.",
    "Receivables, payables, inventory, prepaid expenses, and deferred revenue details.",
    "Notes about whether the business has separate and complete books for more than one activity."
  ], [
    "Can I switch from cash to accrual?",
    "Do prepaid expenses count this year?",
    "Does inventory change my accounting method?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS Publication 583, Starting a Business and Keeping Records", "https://www.irs.gov/publications/p583"]
  ]),
  page("Startup and Organizational Costs: Before the Business Is Open", "startup-costs", [
    "Costs paid before a business begins may need separate review from ordinary operating expenses.",
    "Use this when a founder has pre-launch legal, research, setup, domain, branding, equipment, travel, or entity costs."
  ], [
    "Business start date, first sale date, entity formation date, and date each cost was incurred.",
    "Receipts for legal, accounting, research, registration, domain, branding, software, equipment, and launch costs.",
    "Notes separating startup, organizational, capital asset, and ordinary post-launch costs."
  ], [
    "Can I deduct costs before I opened?",
    "What is the difference between startup costs and equipment?",
    "Which launch costs should Shona/Jay review?"
  ], [
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"],
    ["IRS starting a business", "https://www.irs.gov/businesses/small-businesses-self-employed/starting-a-business"]
  ]),
  page("1099-NEC and W-9 Vendor Compliance", "1099-w9-compliance", [
    "Businesses that pay independent contractors may need W-9s, TIN records, and Form 1099-NEC reporting.",
    "Use this before year-end so vendors are not being chased after payments have already gone out."
  ], [
    "Vendor list, payment totals, W-9 forms, TIN/name details, and payment method.",
    "Contracts, invoices, and notes explaining whether the vendor is a business, individual, attorney, or rent recipient.",
    "Year-end reporting calendar and e-file requirements."
  ], [
    "Who needs a 1099-NEC?",
    "When should I collect Form W-9?",
    "What if a contractor will not give me a TIN?"
  ], [
    ["IRS reporting payments to independent contractors", "https://www.irs.gov/businesses/small-businesses-self-employed/reporting-payments-to-independent-contractors"],
    ["IRS Form W-9", "https://www.irs.gov/forms-pubs/about-form-w-9"],
    ["IRS Form 1099-NEC", "https://www.irs.gov/forms-pubs/about-form-1099-nec"]
  ]),
  page("Backup Withholding and TIN Mismatch Readiness", "backup-withholding", [
    "Backup withholding can apply when reportable payments have missing or incorrect taxpayer identification information.",
    "Use this when a vendor will not provide a W-9, the IRS sends a notice, or the business has a messy contractor file."
  ], [
    "Copies of W-9s, IRS notices, vendor communications, and payment history.",
    "Reportable payment types and whether withholding has already started.",
    "Current process for onboarding vendors before paying them."
  ], [
    "What is backup withholding?",
    "What should I do after a TIN mismatch notice?",
    "How do I prevent vendor reporting problems?"
  ], [
    ["IRS backup withholding", "https://www.irs.gov/businesses/small-businesses-self-employed/backup-withholding"],
    ["IRS backup withholding B program", "https://www.irs.gov/businesses/small-businesses-self-employed/backup-withholding-b-program"]
  ]),
  page("Form 8300: Large Cash Payment Reporting", "form-8300-cash-reporting", [
    "Trades and businesses may have Form 8300 reporting duties when they receive more than $10,000 in cash in a transaction or related transactions.",
    "Use this for high-ticket services, event payments, retainers, vehicle/property sales, or any client who receives large cash or cash-equivalent payments."
  ], [
    "Payment date, payer identity, related transactions, amount, payment type, and business context.",
    "Copies of receipts, contracts, invoices, and Form 8300 confirmation if filed.",
    "Notes about whether e-filing requirements, customer statements, or suspicious activity are involved."
  ], [
    "When does Form 8300 apply?",
    "What counts as cash for this rule?",
    "What should I document if payments are split?"
  ], [
    ["IRS Form 8300 overview", "https://www.irs.gov/forms-pubs/about-form-8300"],
    ["IRS Form 8300 and reporting cash payments over $10,000", "https://www.irs.gov/businesses/small-businesses-self-employed/form-8300-and-reporting-cash-payments-of-over-10000"],
    ["IRS Form 8300 reference guide", "https://www.irs.gov/businesses/small-businesses-self-employed/irs-form-8300-reference-guide"]
  ]),
  page("Digital Asset Payments and Business Transactions", "digital-assets", [
    "Digital asset activity can create income, gain/loss, contractor, payment, and reporting questions.",
    "Use this when a client accepts crypto, pays vendors with digital assets, mines/stakes, receives airdrops, or trades business-held digital assets."
  ], [
    "Wallets, exchanges, transaction hashes, dates, fair market value records, and business purpose.",
    "Records showing whether digital assets were received for services, sold, exchanged, transferred, or used to pay expenses.",
    "Broker forms, gain/loss reports, and notes separating business and personal wallets."
  ], [
    "Do I report digital asset payments?",
    "What records should I keep for crypto transactions?",
    "What if I paid a vendor with digital assets?"
  ], [
    ["IRS digital assets", "https://www.irs.gov/businesses/small-businesses-self-employed/digital-assets"],
    ["IRS virtual currency and digital assets", "https://www.irs.gov/businesses/small-businesses-self-employed/virtual-currencies"]
  ]),
  page("Inventory and Cost of Goods Sold: Product Business Basics", "inventory-cogs", [
    "Product businesses need clean inventory and cost of goods sold records before gross profit can be trusted.",
    "Use this for retailers, ecommerce sellers, manufacturers, productized service businesses, or clients mixing personal and business inventory."
  ], [
    "Opening inventory, purchases, returns, allowances, items withdrawn for personal use, and ending inventory.",
    "SKU counts, inventory valuation method, freight-in, production labor, materials, packaging, and overhead records.",
    "Sales reports from Shopify, Amazon, Stripe, Square, POS, or merchant platforms."
  ], [
    "What belongs in cost of goods sold?",
    "How do I handle inventory I used personally?",
    "Why does gross profit need to be reviewed before deductions?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS Publication 583, Starting a Business and Keeping Records", "https://www.irs.gov/publications/p583"]
  ]),
  page("Business Insurance Premiums and Risk Coverage", "business-insurance", [
    "Insurance premiums can be ordinary business expenses when tied to the business, but policies and owners matter.",
    "Use this for liability, malpractice, property, cyber, workers compensation, business vehicle, overhead disability, or employee coverage questions."
  ], [
    "Policy declarations, premium invoices, proof of payment, covered party, covered asset, and business purpose.",
    "Notes separating personal insurance from business insurance.",
    "Payroll and employee benefit records where employee coverage is involved."
  ], [
    "Which insurance premiums are business expenses?",
    "What records should I keep for liability or malpractice coverage?",
    "When does owner health insurance need separate review?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"]
  ]),
  page("Legal and Professional Fees: Deductible, Capital, or Personal", "legal-professional-fees", [
    "Legal, accounting, consulting, and professional fees need context because some are ordinary expenses, some are capitalized, and some are personal.",
    "Use this when a client pays for entity formation, tax prep, contract review, lawsuits, acquisitions, bookkeeping, advisory, or mixed personal/business services."
  ], [
    "Invoice detail, engagement letter, matter description, business purpose, and payment source.",
    "Notes separating entity formation, tax compliance, personal planning, acquisition, litigation, and ordinary business advice.",
    "Prior-year treatment if the professional fee recurs."
  ], [
    "Are legal fees deductible?",
    "What professional fees should be capitalized?",
    "How should mixed personal and business invoices be documented?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"]
  ]),
  page("Advertising, Content, and Marketing Spend", "advertising-marketing", [
    "Marketing spend is usually easier to support when the business purpose, campaign, platform, and expected customer relationship are documented.",
    "Use this for ads, agency retainers, influencer campaigns, sponsorships, brand shoots, content factories, landing pages, webinars, and promotional events."
  ], [
    "Invoices, contracts, ad account reports, campaign objectives, landing pages, and business purpose notes.",
    "Records separating advertising from entertainment, gifts, meals, personal brand spend, or capitalized website/software work.",
    "Evidence of what was promoted and which business paid for it."
  ], [
    "How do I document ad spend?",
    "Is a brand shoot a business expense?",
    "When should sponsorships or events get special review?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS deducting business expenses", "https://www.irs.gov/businesses/small-businesses-self-employed/deducting-business-expenses"]
  ]),
  page("Rent, Lease, and Related-Party Payment File", "rent-lease-related-party", [
    "Rent and lease payments need clear business purpose, terms, payment trail, and related-party review when owner-controlled property is involved.",
    "Use this for office rent, equipment leases, storage, event space, related-party rentals, home-based reimbursements, or leasehold improvements."
  ], [
    "Lease agreement, invoices, payment records, property use, business purpose, and related-party ownership facts.",
    "Comparable rent support when related parties are involved.",
    "Records separating rent, utilities, repairs, improvements, security deposits, and personal use."
  ], [
    "What rent documents should I keep?",
    "How should related-party rent be supported?",
    "Is this a lease payment or an improvement?"
  ], [
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"],
    ["IRS Publication 587, Business Use of Your Home", "https://www.irs.gov/publications/p587"]
  ]),
  page("Business Debt, Interest, and Loan Documentation", "business-debt-interest", [
    "Interest and debt treatment depends on who borrowed, what the proceeds funded, payment terms, and whether the debt is business, personal, or mixed.",
    "Use this for credit cards, lines of credit, owner loans, equipment loans, shareholder loans, related-party debt, and refinance questions."
  ], [
    "Loan agreement, amortization schedule, statements, use of proceeds, interest paid, and borrower identity.",
    "Board/shareholder notes or promissory notes for owner or related-party loans.",
    "Records separating principal, interest, fees, personal charges, and business charges."
  ], [
    "Can the business deduct this interest?",
    "What makes an owner loan clean?",
    "How do I track mixed-use credit cards?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"]
  ]),
  page("Business Bad Debts and Unpaid Customer Balances", "business-bad-debts", [
    "Bad debt treatment depends on whether the amount was a bona fide business debt and how income was previously reported.",
    "Use this when customers do not pay, loans to vendors or employees go bad, or a business wants to write off receivables."
  ], [
    "Invoice, contract, payment history, collection attempts, write-off date, and accounting method.",
    "Evidence that the amount was included in income if accrual receivables are involved.",
    "Loan documents for any advances or notes."
  ], [
    "When is an unpaid invoice deductible?",
    "What records prove a debt became worthless?",
    "Does cash-basis accounting change the answer?"
  ], [
    ["IRS Publication 334, Tax Guide for Small Business", "https://www.irs.gov/publications/p334"],
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"]
  ]),
  page("Charitable Giving Substantiation for Business Owners", "charitable-giving", [
    "Charitable giving can involve personal itemized deductions, corporate giving, inventory donations, sponsorships, and quid pro quo issues.",
    "Use this when an owner donates cash, inventory, services, auction items, sponsorship money, or property and wants tax treatment reviewed."
  ], [
    "Qualified organization verification, receipts, written acknowledgments, payment records, and benefit received.",
    "Description and value support for noncash property or inventory.",
    "Notes separating advertising/sponsorship from charitable contribution treatment."
  ], [
    "What proof do I need for charitable gifts?",
    "Can my business donate inventory?",
    "Is this sponsorship advertising or a charitable contribution?"
  ], [
    ["IRS Publication 526, Charitable Contributions", "https://www.irs.gov/publications/p526"],
    ["IRS Tax Exempt Organization Search", "https://www.irs.gov/charities-non-profits/tax-exempt-organization-search"]
  ]),
  page("Hobby vs Business: Profit Motive and Losses", "hobby-vs-business", [
    "An activity with losses is not automatically a business. Profit motive, regularity, records, and businesslike conduct matter.",
    "Use this when a client has a side activity, creator business, horse activity, art, coaching, rentals, or repeated losses."
  ], [
    "Business plan, separate bank records, marketing activity, time spent, expertise, profit history, and changes made to improve profitability.",
    "Revenue, expenses, customer records, and evidence the activity is run in a businesslike manner.",
    "Prior-year losses and owner personal enjoyment facts."
  ], [
    "Is my side activity a business or a hobby?",
    "What records support profit motive?",
    "Can losses offset other income?"
  ], [
    ["IRS hobby or business guidance", "https://www.irs.gov/newsroom/know-the-difference-between-a-hobby-and-a-business"],
    ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"]
  ]),
  page("Passive Activity and Material Participation File", "passive-activity", [
    "Passive activity rules can limit losses even when expenses are real. Material participation, rental rules, and grouping choices are fact-heavy.",
    "Use this for businesses with losses, multiple activities, rental property, limited partners, real estate professionals, or owner time questions."
  ], [
    "Hours by activity, role descriptions, calendars, management logs, income/loss by activity, and ownership documents.",
    "Rental property records and any grouping or election history.",
    "Prior-year suspended losses and passive activity forms."
  ], [
    "What counts as material participation?",
    "Why are rental losses limited?",
    "What records support owner hours?"
  ], [
    ["IRS Publication 925, Passive Activity and At-Risk Rules", "https://www.irs.gov/publications/p925"],
    ["About Publication 925", "https://www.irs.gov/pub925"]
  ]),
  page("Short-Term Rental and Rental Property Tax Fact File", "short-term-rentals", [
    "Rental treatment depends on use, services, personal days, average rental period, passive activity rules, depreciation, and records.",
    "Use this when a client has Airbnb/VRBO income, mixed personal use, co-hosting, property managers, repairs, furnishings, or rental losses."
  ], [
    "Rental days, personal days, average stay length, services provided, income, platform statements, and property manager reports.",
    "Expense records, repairs vs improvements, furnishings, depreciation schedule, and mortgage/insurance/property tax records.",
    "Owner time logs and material participation notes."
  ], [
    "Is my short-term rental Schedule E or business income?",
    "What records should I keep for Airbnb income?",
    "Why do personal-use days matter?"
  ], [
    ["IRS Publication 527, Residential Rental Property", "https://www.irs.gov/publications/p527"],
    ["IRS Publication 925, Passive Activity and At-Risk Rules", "https://www.irs.gov/publications/p925"]
  ]),
  page("Business Tax Credits Starter: WOTC, Disabled Access, and General Credits", "business-tax-credits", [
    "Business credits can be valuable but often require pre-certification, eligibility records, forms, and current-year review.",
    "Use this when hiring targeted workers, improving accessibility, investing in energy property, or asking whether a credit may apply."
  ], [
    "Employee hiring facts, certification forms, expense invoices, project scope, and date work was performed.",
    "Business size, employee count, wages, and credit history.",
    "Current-year forms and advisor notes before claiming any credit."
  ], [
    "What business credits should I ask about?",
    "What records support disabled access improvements?",
    "When does WOTC need pre-screening?"
  ], [
    ["IRS credits and deductions for businesses", "https://www.irs.gov/credits-deductions/businesses"],
    ["IRS Work Opportunity Tax Credit", "https://www.irs.gov/businesses/small-businesses-self-employed/work-opportunity-tax-credit"],
    ["IRS tax benefits for businesses who have employees with disabilities", "https://www.irs.gov/businesses/small-businesses-self-employed/tax-benefits-for-businesses-who-have-employees-with-disabilities"]
  ]),
  page("Fringe Benefits: Owner-Employee Treatment and Payroll Review", "fringe-benefits", [
    "Fringe benefits may be taxable or excluded depending on the benefit type, plan rules, employee status, and owner status.",
    "Use this for company vehicles, phones, meals, parking, education assistance, health benefits, awards, discounts, and S-corp owner benefits."
  ], [
    "Benefit type, recipient, value, business reason, policy, payroll treatment, and owner relationship.",
    "Plan documents or written policy for recurring benefits.",
    "W-2, payroll, and reimbursement records."
  ], [
    "Are fringe benefits taxable?",
    "What owner benefits need payroll review?",
    "Can education or AI training be a working condition benefit?"
  ], [
    ["IRS Publication 15-B, Employer's Tax Guide to Fringe Benefits", "https://www.irs.gov/publications/p15b"],
    ["IRS Publication 15, Employer's Tax Guide", "https://www.irs.gov/publications/p15"]
  ]),
  page("HSA and Tax-Favored Health Plan Basics", "hsa-health-plans", [
    "Health savings accounts and related arrangements require eligibility, coverage, contribution, and distribution review.",
    "Use this when an owner or employee has an HSA, HDHP, FSA, HRA, spouse coverage, reimbursements, or year-end contribution questions."
  ], [
    "Health plan type, coverage months, employer contributions, employee contributions, distributions, and medical expense records.",
    "Forms 1099-SA, 5498-SA, W-2 benefit reporting, and plan documents.",
    "Spouse coverage and other health coverage facts."
  ], [
    "Can I contribute to an HSA?",
    "What records should I keep for HSA distributions?",
    "How do employer health benefits affect payroll?"
  ], [
    ["IRS Publication 969, HSAs and Other Tax-Favored Health Plans", "https://www.irs.gov/publications/p969"],
    ["About Publication 969", "https://www.irs.gov/pub969"]
  ]),
  page("Payroll Tax Deposits and Employment Tax Calendar", "payroll-tax-deposits", [
    "Payroll compliance requires deposit schedules, return filing, wage reporting, and clean payroll records.",
    "Use this when clients hire employees, run late payroll, change payroll providers, add household/family workers, or worry about missed deposits."
  ], [
    "Payroll provider reports, Forms 941/944/940, state payroll filings, deposit history, and W-2/W-3 records.",
    "Employee onboarding records, W-4s, I-9 process notes, and payroll calendar.",
    "Owner payroll and S-corp compensation notes."
  ], [
    "What payroll reports should I review monthly?",
    "What happens if payroll deposits are late?",
    "How does hiring employees change my tax calendar?"
  ], [
    ["IRS Publication 15, Employer's Tax Guide", "https://www.irs.gov/publications/p15"],
    ["IRS operating a business", "https://www.irs.gov/businesses/small-businesses-self-employed/operating-a-business"]
  ]),
  page("Federal Tax Deadlines, Extensions, and Electronic Payments", "tax-deadlines-extensions", [
    "Extensions, payment due dates, estimated payments, entity returns, and electronic payment options should be tracked as a calendar system.",
    "Use this when a client is unsure whether an extension delays payment, misses a deadline, or needs a payment route."
  ], [
    "Entity type, tax year, prior returns, estimated tax payments, payroll filings, extension status, and notices.",
    "Payment confirmations, IRS account transcripts, EFTPS records, and state payment records.",
    "Calendar reminders and responsible team member."
  ], [
    "Does an extension give me more time to pay?",
    "Which federal payment method should I use?",
    "What should I gather after missing a deadline?"
  ], [
    ["IRS payments", "https://www.irs.gov/payments"],
    ["IRS Publication 505, Tax Withholding and Estimated Tax", "https://www.irs.gov/publications/p505"],
    ["IRS operating a business", "https://www.irs.gov/businesses/small-businesses-self-employed/operating-a-business"]
  ]),
  page("Entity Choice and Tax Classification Starter", "entity-choice", [
    "Business structure affects tax forms, payroll, owner pay, liability conversations, and state law. The portal should gather facts, not recommend an entity.",
    "Use this when a client asks LLC vs S-corp, sole proprietor vs partnership, multiple owners, adding a spouse, or changing tax classification."
  ], [
    "Current legal entity, tax classification, owners, state registration, operating agreement, and election history.",
    "Profit projection, payroll readiness, owner services, distributions, and liability/legal concerns.",
    "Prior-year returns and notices."
  ], [
    "Should I become an S-corp?",
    "Does an LLC change my taxes automatically?",
    "What facts matter before changing entity classification?"
  ], [
    ["IRS business structures", "https://www.irs.gov/businesses/small-businesses-self-employed/business-structures"],
    ["IRS S corporations overview", "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations"],
    ["IRS Limited Liability Company", "https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc"]
  ]),
  page("Selling Business Assets and Depreciation Recapture", "asset-sales-recapture", [
    "Selling business assets can trigger gain/loss, depreciation recapture, installment sale, and reporting questions.",
    "Use this before selling equipment, vehicles, real estate, customer lists, websites, or a business line."
  ], [
    "Asset description, original cost, depreciation schedule, business-use percentage, sale contract, proceeds, and debt payoff.",
    "Prior Section 179, bonus depreciation, listed property records, and improvements.",
    "Allocation of purchase price if multiple assets are sold."
  ], [
    "What happens when I sell depreciated equipment?",
    "Why does depreciation recapture matter?",
    "What documents should I gather before selling business assets?"
  ], [
    ["IRS Publication 544, Sales and Other Dispositions of Assets", "https://www.irs.gov/publications/p544"],
    ["IRS Publication 946, How To Depreciate Property", "https://www.irs.gov/publications/p946"]
  ]),
  page("Business Losses, At-Risk Limits, and NOL Questions", "business-losses-nol", [
    "A business loss may be limited by basis, at-risk, passive activity, excess business loss, or net operating loss rules.",
    "Use this when clients have large losses, multiple entities, rental losses, prior suspended losses, or want to know whether losses offset other income."
  ], [
    "Business income/loss by entity, capital contributions, loans, basis schedules, at-risk amounts, and passive activity records.",
    "Prior-year returns, suspended losses, NOL carryforward information, and ownership changes.",
    "Material participation and real estate professional records where relevant."
  ], [
    "Can my business loss offset other income?",
    "Why might a real loss be suspended?",
    "What records support basis and at-risk amounts?"
  ], [
    ["IRS Publication 925, Passive Activity and At-Risk Rules", "https://www.irs.gov/publications/p925"],
    ["IRS Publication 536, Net Operating Losses", "https://www.irs.gov/pub536"]
  ])
];

function page(title, strategyKey, coreNotes, documents, relatedQuestions, sourceLinks) {
  return {
    title,
    strategyKey,
    overview: coreNotes[0],
    whenThisMatters: coreNotes[1],
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a preparation file: understand the federal baseline, gather the facts, and escalate before using it as a client-specific tax position.",
    factChecklist: [
      "Identify the tax year, entity type, owner status, state/local context, and whether this is a general question or a client-specific decision.",
      "Gather the documents listed below before asking the portal to summarize the topic.",
      "Separate personal, business, payroll, entity, and state-law facts so Shona/Jay can review the right lane.",
      "Verify current-year limits, forms, deadlines, and filing requirements before acting."
    ],
    documents,
    mistakes: [
      "Treating federal public-source education as personalized advice.",
      "Using stale dollar limits, deadlines, or forms without current-year verification.",
      "Skipping payroll, state, legal, entity, or plan-document review when those facts matter.",
      "Keeping a receipt but failing to document business purpose, timing, payer/payee, or ownership."
    ],
    escalationTriggers: [
      "The answer affects a filing position, payroll setup, entity classification, legal document, depreciation choice, credit claim, or audit-sensitive deduction.",
      "The source material says facts, thresholds, or current-year rules must be verified.",
      "The client needs Shona/Jay to decide whether they personally qualify.",
      "The question involves state/local law, labor law, sales tax, payroll deposits, securities, legal liability, or non-tax advice."
    ],
    relatedQuestions,
    sourceLinks
  };
}

const slugFor = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const seedTitles = seedSources.map((source) => source.title);
const seedSlugs = seedSources.map((source) => slugFor(source.title));

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

function sqlEscape(value) {
  return String(value).replaceAll("'", "''");
}

function quoted(values) {
  return values.map((value) => `'${sqlEscape(value)}'`).join(", ");
}

function nowIso() {
  return new Date().toISOString();
}

function latestManifestPath() {
  return path.join(OUTPUT_DIR, "latest-expanded-manifest.json");
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

async function execWrangler(args, options = {}) {
  const { stdout } = await execFileAsync("npx", ["wrangler", ...args], {
    env: { ...process.env },
    maxBuffer: options.maxBuffer ?? 12 * 1024 * 1024
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
    "/api/auth/admin-password",
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

async function preflight({ dryRun }) {
  console.log("Preflight: production health.");
  const health = await portalFetch("/api/health");
  if (!health.response.ok || health.json?.ok !== true || health.json?.environment !== "production") {
    throw new Error(`Production health check failed: ${health.response.status} ${health.text.slice(0, 160)}`);
  }
  if (!dryRun) {
    console.log("Preflight: admin auth.");
    await adminLogin();
  }
  const existingSources = await d1Results(
    `SELECT id, title, status FROM source_documents WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(seedTitles)}) ORDER BY title`
  );
  const existingPages = await d1Results(
    `SELECT id, slug, title, status FROM wiki_pages WHERE tenant_id = '${TENANT_ID}' AND slug IN (${quoted(seedSlugs)}) ORDER BY title`
  );
  console.log(`Preflight: existing matching sources=${existingSources.length}, pages=${existingPages.length}.`);
  return { existingSources, existingPages };
}

function buildMarkdown(source) {
  const list = (items) => items.map((item) => `- ${item}`).join("\n");
  const sourceList = source.sourceLinks.map(([label, url]) => `- [${label}](${url})`).join("\n");
  return `# ${source.title}

> Federal public-source education. Not personalized tax, legal, payroll, or state-law advice. Ask Shona/Jay before acting.

**Preview status:** Public-Source Preview: Educational Only  
**Tax year label:** 2026 starter library  
**Source accessed date:** ${SOURCE_ACCESSED_DATE}  
**Review owner:** ${REVIEW_OWNER}  
**Strategy key:** ${source.strategyKey}

## Overview

${source.overview}

## When This Matters

${source.whenThisMatters}

## How Shona/Jay Might Frame This

${source.shonaJayFrame} This is preview positioning, not confirmed Beyond Freedom firm guidance.

## Fact-Gathering Checklist

These prompts gather facts for review. They do not conclude that a client qualifies.

${list(source.factChecklist)}

## Documents To Gather

${list(source.documents)}

## Common Mistakes

${list(source.mistakes)}

## Escalation Triggers

Escalate to Shona/Jay before acting when any of these are true:

${list(source.escalationTriggers)}

## Related Questions

${list(source.relatedQuestions)}

## Sources Used

${sourceList}

## Preview Boundary

This page is based on federal public-source material and is meant to make the portal feel real during preview. State rules, payroll rules, labor law, legal documents, plan documents, current-year limits, and client-specific facts may change the answer. Shona/Jay should review this page before it is treated as firm-approved client guidance.
`;
}

function sourcePayload(source) {
  return {
    title: source.title,
    sourceType: "strategy_doc",
    content: buildMarkdown(source),
    visibility: "client",
    visibilityTier: "all",
    strategyKey: source.strategyKey,
    effectiveYear: "2026",
    audience: "preview clients",
    reviewOwner: REVIEW_OWNER
  };
}

function buildSeedManifestBase() {
  return {
    id: `${SEED_BATCH}-${randomUUID()}`,
    seedBatch: SEED_BATCH,
    portalOrigin: PORTAL_ORIGIN,
    database: PRODUCTION_DB,
    bucket: PRODUCTION_BUCKET,
    vectorIndex: PRODUCTION_VECTOR_INDEX,
    tenantId: TENANT_ID,
    startedAt: nowIso(),
    completedAt: null,
    status: "started",
    sources: []
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

async function createProcessPublish(cookieJar, source, manifest) {
  const payload = sourcePayload(source);
  const payloadHash = contentHash(payload.content);
  console.log(`Seeding: ${source.title}`);
  const created = await postAdmin(cookieJar, "/api/admin/sources", payload);
  const sourceId = created.id;
  const ingested = await postAdmin(cookieJar, `/api/admin/sources/${encodeURIComponent(sourceId)}/ingest`);
  const wikiId = ingested.wikiId;
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
    throw new Error(`Post-publish validation failed for ${source.title}`);
  }

  const record = {
    title: source.title,
    slug: slugFor(source.title),
    strategyKey: source.strategyKey,
    contentHash: payloadHash,
    sourceId,
    wikiId,
    status: { source: sourceRow.status, wiki: pageRow.status },
    r2Keys: {
      raw: sourceRow.r2_key,
      normalized: sourceRow.normalized_r2_key,
      compiled: pageRow.compiled_r2_key
    },
    chunks: chunkRows.map((row) => ({ id: row.id, vectorId: row.vector_id })),
    auditEvents: auditRows
  };
  manifest.sources.push(record);
  await writeManifest(manifest);
  return record;
}

async function dryRun() {
  await ensureOutputDir();
  const preflightResult = await preflight({ dryRun: true });
  const preview = {
    seedBatch: SEED_BATCH,
    mode: "dry-run",
    sourceCount: seedSources.length,
    duplicateSourceCount: preflightResult.existingSources.length,
    duplicatePageCount: preflightResult.existingPages.length,
    sources: seedSources.map((source) => {
      const payload = sourcePayload(source);
      return {
        title: source.title,
        slug: slugFor(source.title),
        strategyKey: source.strategyKey,
        contentHash: contentHash(payload.content),
        bytes: Buffer.byteLength(payload.content, "utf8"),
        sourceLinks: source.sourceLinks.map(([, url]) => url)
      };
    })
  };
  const dryRunPath = path.join(OUTPUT_DIR, `${SEED_BATCH}-dry-run.json`);
  await writeFile(dryRunPath, `${JSON.stringify(preview, null, 2)}\n`);
  console.log(`Dry run complete. Wrote ${dryRunPath}`);
}

async function apply(args) {
  assertRequiredEnvironment("apply");
  if (process.env.ALLOW_SCAFFOLD_SEEDS !== "YES") {
    throw new Error("This public-source preview seed is retired for client-facing publishing. Set ALLOW_SCAFFOLD_SEEDS=YES only for an intentional internal recovery run.");
  }
  await ensureOutputDir();
  const preflightResult = await preflight({ dryRun: false });
  if ((preflightResult.existingSources.length > 0 || preflightResult.existingPages.length > 0) && !args.force) {
    throw new Error("Matching expanded seed titles/slugs already exist. Re-run with --force only for recovery.");
  }
  const cookieJar = await adminLogin();
  const manifest = buildSeedManifestBase();
  await writeManifest(manifest);
  try {
    for (const source of seedSources) {
      await createProcessPublish(cookieJar, source, manifest);
    }
    await postAdmin(cookieJar, "/api/admin/health/run");
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
  const titles = manifest.sources.length > 0 ? manifest.sources.map((source) => source.title) : seedTitles;
  const sourceCountRows = await d1Results(
    `SELECT COUNT(*) AS total FROM source_documents WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(titles)}) AND status = 'published'`
  );
  const wikiCountRows = await d1Results(
    `SELECT COUNT(*) AS total FROM wiki_pages WHERE tenant_id = '${TENANT_ID}' AND title IN (${quoted(titles)}) AND status = 'published'`
  );
  const chunkRows = await d1Results(
    `SELECT w.title, COUNT(k.id) AS chunks FROM wiki_pages w LEFT JOIN knowledge_chunks k ON k.wiki_page_id = w.id AND k.published = 1 WHERE w.tenant_id = '${TENANT_ID}' AND w.title IN (${quoted(titles)}) GROUP BY w.title ORDER BY w.title`
  );
  const expected = titles.length;
  const sourceCount = Number(sourceCountRows[0]?.total ?? 0);
  const wikiCount = Number(wikiCountRows[0]?.total ?? 0);
  const missingChunks = chunkRows.filter((row) => Number(row.chunks) < 1);
  console.log(`Validation: published sources ${sourceCount}/${expected}`);
  console.log(`Validation: published wiki pages ${wikiCount}/${expected}`);
  console.log(`Validation: chunk rows with missing chunks ${missingChunks.length}`);
  if (sourceCount !== expected || wikiCount !== expected || missingChunks.length > 0) {
    throw new Error("Validation failed for expanded seed source/wiki/chunk counts.");
  }
  const clientTrainings = await fetchClientTrainingCount(titles);
  console.log(`Validation: expanded client-visible trainings found through API: ${clientTrainings}/${expected}`);
  if (clientTrainings < expected) {
    throw new Error(`Client trainings API returned ${clientTrainings}, expected at least ${expected}.`);
  }
}

async function fetchClientTrainingCount(titles) {
  const clientIdRows = await d1Results(
    `SELECT id FROM client_profiles WHERE tenant_id = '${TENANT_ID}' AND email = 'bowiee@jahinc.org' LIMIT 1`
  );
  const clientId = clientIdRows[0]?.id;
  if (!clientId) {
    throw new Error("Missing bowiee@jahinc.org client profile for client API validation.");
  }
  const sessionId = `sess_seed_expanded_${randomUUID().replaceAll("-", "")}`;
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
    const titleSet = new Set(titles);
    const trainings = result.json?.trainings ?? [];
    return trainings.filter((training) => titleSet.has(training.title)).length;
  } finally {
    await d1Run(`DELETE FROM sessions WHERE id = '${sessionId}'`);
  }
}

async function readManifest(manifestPath = null) {
  const resolvedPath = manifestPath || latestManifestPath();
  if (!existsSync(resolvedPath)) {
    if (!manifestPath) return { sources: [] };
    throw new Error(`Manifest not found: ${resolvedPath}`);
  }
  return JSON.parse(await readFile(resolvedPath, "utf8"));
}

async function rollback(manifestPath = null) {
  assertRequiredEnvironment("rollback");
  const manifest = await readManifest(manifestPath);
  if (!manifest.sources?.length) {
    throw new Error("Rollback manifest has no sources.");
  }
  const vectorIds = manifest.sources.flatMap((source) => source.chunks.map((chunk) => chunk.vectorId).filter(Boolean));
  if (vectorIds.length > 0) {
    for (let index = 0; index < vectorIds.length; index += 100) {
      const batch = vectorIds.slice(index, index + 100);
      await execWrangler(["vectorize", "delete-vectors", PRODUCTION_VECTOR_INDEX, "--env", "production", "--ids", ...batch]);
    }
  }
  const chunkIds = manifest.sources.flatMap((source) => source.chunks.map((chunk) => chunk.id).filter(Boolean));
  if (chunkIds.length > 0) await d1Run(`DELETE FROM knowledge_chunks WHERE id IN (${quoted(chunkIds)})`);
  const wikiIds = manifest.sources.map((source) => source.wikiId).filter(Boolean);
  if (wikiIds.length > 0) await d1Run(`DELETE FROM wiki_pages WHERE id IN (${quoted(wikiIds)})`);
  const sourceIds = manifest.sources.map((source) => source.sourceId).filter(Boolean);
  if (sourceIds.length > 0) await d1Run(`DELETE FROM source_documents WHERE id IN (${quoted(sourceIds)})`);
  await d1Run(
    `INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES ('audit_${randomUUID().replaceAll("-", "")}', '${TENANT_ID}', 'seed-expanded-preview-knowledge-script', 'seed.rollback', 'seed_batch', '${sqlEscape(manifest.id)}', '${sqlEscape(JSON.stringify({ sourceCount: manifest.sources.length }))}', '${nowIso()}')`
  );
  console.log("Rollback complete.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "dry-run") return dryRun();
  if (args.mode === "apply") return apply(args);
  if (args.mode === "validate") return validate(args.manifestPath);
  if (args.mode === "rollback") return rollback(args.manifestPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
