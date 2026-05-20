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
const SOURCE_ACCESSED_DATE = "2026-05-13";
const REVIEW_OWNER = "Codex public research starter";
const SEED_BATCH = "public-source-preview-2026-05-13-v1";
const REQUIRED_ENV = ["CLOUDFLARE_API_TOKEN", "ADMIN_MASTER_PASSWORD"];
const TENANT_ID = "tenant_beyond_freedom";
const ADMIN_AUTH_PATH = "/api/auth/admin-password";
const ADMIN_SOURCES_PATH = "/api/admin/sources";
const ADMIN_HEALTH_PATH = "/api/admin/health/run";
const HEADERS_JSON = { "content-type": "application/json" };

const seedSources = [
  {
    title: "Start Here: How to Use Ask Shona/Jay Safely",
    strategyKey: "portal-safety",
    overview:
      "This starter page explains how to use the Ask Shona/Jay portal during preview. The portal can summarize approved source material, point clients to training pages, and identify when a question needs advisor review. It should not be treated as a substitute for a personalized CPA engagement, legal review, payroll review, state tax review, or formal filing position.",
    whenThisMatters:
      "Use this page whenever a client wants to understand what the portal can and cannot do. The safest pattern is to use Ask Shona/Jay to gather facts, find the right education, prepare documents, and know when to ask the team for a decision.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame the portal as a way to help clients come to meetings better prepared, reduce repeated basic questions, and route fact-sensitive decisions to the team instead of guessing.",
    factChecklist: [
      "Name the tax topic or business decision you are asking about.",
      "Identify whether the question is general education or a decision about your specific facts.",
      "Gather the entity type, state, tax year, payroll facts, ownership facts, and relevant documents before asking for implementation guidance.",
      "Use the cited training page to understand the baseline rule before asking the team to apply it."
    ],
    documents: [
      "Entity documents and current ownership information when entity structure matters.",
      "Payroll records and compensation history when wages or worker classification matter.",
      "Receipts, logs, invoices, contracts, meeting agendas, or mileage records when deductions depend on substantiation.",
      "Prior tax returns and current-year income details when estimates, deductions, or planning thresholds matter."
    ],
    mistakes: [
      "Treating a public-source answer as personalized advice.",
      "Skipping state, payroll, labor-law, or entity-document review.",
      "Using a checklist as proof of eligibility instead of a fact-gathering tool.",
      "Relying on a stale dollar limit or deadline without confirming the current tax year."
    ],
    escalationTriggers: [
      "You need Shona/Jay to confirm whether you personally qualify.",
      "The question affects a filing position, audit risk, penalties, payroll setup, entity structure, or legal documents.",
      "The source answer says facts are missing or confidence is low.",
      "The question involves state or local rules that are not covered by the federal public-source preview."
    ],
    relatedQuestions: [
      "What information should I gather before asking a tax strategy question?",
      "When should I escalate instead of relying on the portal?",
      "Why does the portal keep saying federal public-source education?"
    ],
    sourceLinks: [
      ["IRS Small Business and Self-Employed Tax Center", "https://www.irs.gov/businesses/small-businesses-self-employed"],
      ["Taxpayer Advocate Service taxpayer rights overview", "https://www.taxpayeradvocate.irs.gov/get-help/taxpayer-rights/"]
    ]
  },
  {
    title: "Estimated Tax Readiness: 30-Day Checklist",
    strategyKey: "estimated-taxes",
    overview:
      "Estimated tax planning is a timing and cash-flow discipline. Public IRS guidance says taxpayers generally pay tax through withholding, estimated tax payments, or both. For business owners, the preview goal is not to calculate a final payment inside the portal; it is to prepare the facts Shona/Jay need before a quarterly deadline.",
    whenThisMatters:
      "This matters when income, withholding, profit, distributions, deductions, or business activity changed during the year. It is especially useful about 30 days before a quarterly payment date, before the client is rushed into guessing.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a recurring rhythm: update the numbers, compare the current year to prior-year assumptions, identify changes, and bring the clean fact pattern to the team before paying.",
    factChecklist: [
      "Gather year-to-date business profit, owner draws or distributions, and expected income for the rest of the year.",
      "List W-2 withholding, spouse withholding, prior estimated payments, and any one-time income events.",
      "Identify major new deductions, equipment purchases, retirement contributions, or entity changes that may affect estimates.",
      "Confirm whether the question is about federal estimates only or also state estimates."
    ],
    documents: [
      "Year-to-date profit and loss statement.",
      "Payroll reports or W-2 withholding details.",
      "Records of estimated tax payments already made.",
      "Prior-year tax return and current-year projected income changes."
    ],
    mistakes: [
      "Waiting until after the deadline to review cash flow and withholding.",
      "Assuming last quarter's payment still fits after income changes.",
      "Forgetting that state estimates may require separate review.",
      "Treating the portal as a calculator for exact payment amounts without advisor review."
    ],
    escalationTriggers: [
      "You need an exact amount to pay.",
      "Income changed materially or includes unusual items.",
      "You are worried about penalties or safe-harbor rules.",
      "You need federal and state estimates coordinated."
    ],
    relatedQuestions: [
      "What should I gather before my estimated tax review?",
      "How do withholding and estimated payments work together?",
      "When should I ask the team before making a quarterly payment?"
    ],
    sourceLinks: [
      ["IRS Publication 505, Tax Withholding and Estimated Tax", "https://www.irs.gov/publications/p505"],
      ["IRS estimated taxes overview", "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes"]
    ]
  },
  {
    title: "Hiring Your Kids: Real Work, Reasonable Pay, Payroll Basics",
    strategyKey: "hire-kids",
    overview:
      "Hiring children can be a legitimate family business topic when the child performs real work, the pay is reasonable, and records are clean. Public IRS family-employment guidance distinguishes how wages may be treated depending on the business structure and family relationship. This preview page is fact-gathering education, not a conclusion that the strategy fits a client.",
    whenThisMatters:
      "This matters when a business owner wants children to help in the business and wants to understand the records, payroll, and entity-type questions that must be reviewed before implementation.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a documentation-first strategy: define real duties, pay a reasonable amount for actual work, keep records, and confirm payroll treatment before money moves.",
    factChecklist: [
      "Identify the child's age, actual work performed, expected schedule, and how work will be supervised.",
      "Confirm the business entity type before assuming any payroll tax treatment.",
      "Compare proposed pay to the nature of the work and time records.",
      "Confirm whether state labor law, payroll registration, or workers compensation rules need review."
    ],
    documents: [
      "Written job description with age-appropriate duties.",
      "Time sheets or work logs.",
      "Payroll records, W-2 or payroll filing records when applicable.",
      "Examples of completed work, business purpose, and payment records."
    ],
    mistakes: [
      "Paying a child without real work or documentation.",
      "Using a flat allowance and calling it wages.",
      "Assuming every entity type gets the same payroll treatment.",
      "Ignoring state child labor and payroll requirements."
    ],
    escalationTriggers: [
      "The business is an S-corp, C-corp, partnership, or multi-owner entity.",
      "You need help deciding payroll setup or tax treatment.",
      "The work is irregular, hard to document, or not clearly tied to business activity.",
      "The question involves state labor law, payroll filings, or reasonable compensation."
    ],
    relatedQuestions: [
      "What work can my child actually do for the business?",
      "How should we document hours and duties?",
      "Does my entity type change the payroll treatment?"
    ],
    sourceLinks: [
      ["IRS family employees guidance", "https://www.irs.gov/businesses/small-businesses-self-employed/family-employees"],
      ["IRS Publication 15, Employer's Tax Guide", "https://www.irs.gov/publications/p15"]
    ]
  },
  {
    title: "Augusta Rule / 14-Day Rental: Documentation and Guardrails",
    strategyKey: "augusta-rule",
    overview:
      "The commonly named Augusta Rule relates to federal tax rules for renting a dwelling unit for fewer than 15 days during the year. This preview page uses public statutory and IRS-style substantiation principles to help clients gather facts. It must not be used as a plug-and-play deduction because business purpose, fair rental value, documentation, entity facts, and state treatment matter.",
    whenThisMatters:
      "This matters when a business owner is considering renting a personal residence or dwelling unit to the business for meetings or events and wants to understand the documentation questions to bring to Shona/Jay.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a proof file, not a shortcut: business purpose, agenda, minutes, fair rental value support, invoice, payment trail, and annual rental-day tracking.",
    factChecklist: [
      "Identify the dwelling unit, rental dates, and total personal-residence rental days for the year.",
      "Document the business purpose, meeting agenda, attendees, minutes, and outcome.",
      "Gather comparable local rental support for fair rental value.",
      "Confirm the entity, ownership, payment path, and state/local treatment before acting."
    ],
    documents: [
      "Meeting agenda and minutes.",
      "Comparable rental listings or event-space support.",
      "Invoice from the owner to the business and proof of payment.",
      "Annual log showing total rental days for the residence."
    ],
    mistakes: [
      "Treating a casual family gathering as a business meeting.",
      "Skipping fair rental value support.",
      "Failing to track total rental days.",
      "Assuming the federal rule automatically resolves state, entity, or documentation issues."
    ],
    escalationTriggers: [
      "You want to implement a business rental of your home.",
      "You need Shona/Jay to review fair rental value or business purpose.",
      "Your business entity, ownership, or reimbursement path is unclear.",
      "You are unsure whether the event qualifies as a legitimate business meeting."
    ],
    relatedQuestions: [
      "What should be in my meeting agenda and minutes?",
      "How do I support fair rental value?",
      "What rental-day records should I keep?"
    ],
    sourceLinks: [
      ["26 USC 280A, Disallowance of certain expenses in connection with business use of home", "https://www.law.cornell.edu/uscode/text/26/280A"],
      ["IRS Publication 527, Residential Rental Property", "https://www.irs.gov/publications/p527"]
    ]
  },
  {
    title: "S-Corp Owner Pay: Reasonable Compensation Before Distributions",
    strategyKey: "s-corp-compensation",
    overview:
      "Public IRS guidance warns that S-corp shareholder-employees must consider reasonable compensation for services before non-wage distributions. This preview page helps clients gather facts for review. It does not provide a percentage rule, salary formula, or final compensation amount.",
    whenThisMatters:
      "This matters when an S-corp owner takes distributions, works in the business, changes profit levels, or wants to understand why payroll and distributions cannot be evaluated casually.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a compensation support question: what services are performed, what the business can support, what comparable roles earn, and whether payroll is being run consistently.",
    factChecklist: [
      "List the services the shareholder performs and the time spent in the business.",
      "Gather business profit, distributions, payroll history, and role changes.",
      "Collect comparable compensation support for similar duties where possible.",
      "Confirm payroll timing, officer status, benefits, and reimbursement treatment."
    ],
    documents: [
      "Payroll reports and W-2 history.",
      "Profit and loss statement and distribution records.",
      "Job description or owner role summary.",
      "Comparable compensation support and advisor notes."
    ],
    mistakes: [
      "Taking only distributions while performing substantial services.",
      "Using an unsupported percentage rule.",
      "Ignoring payroll tax and benefit treatment.",
      "Assuming a prior-year wage is still reasonable after the business changes."
    ],
    escalationTriggers: [
      "You need a salary amount or compensation adjustment.",
      "You have distributions with little or no payroll.",
      "Profit, owner duties, or entity facts changed.",
      "You are concerned about audit exposure or payroll compliance."
    ],
    relatedQuestions: [
      "Why does S-corp payroll matter?",
      "What records support reasonable compensation?",
      "Can I take distributions if payroll is not current?"
    ],
    sourceLinks: [
      ["IRS S corporation compensation and medical insurance issues", "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporation-compensation-and-medical-insurance-issues"],
      ["IRS S corporations overview", "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations"]
    ]
  },
  {
    title: "Accountable Plan Reimbursements: Receipt and Return Rules",
    strategyKey: "accountable-plan",
    overview:
      "An accountable plan is a reimbursement arrangement that generally requires a business connection, timely substantiation, and returning amounts in excess of substantiated expenses. This preview page helps clients understand the records to keep before treating reimbursements as accountable-plan reimbursements.",
    whenThisMatters:
      "This matters when an owner or employee pays business expenses personally and wants the business to reimburse them without creating messy wage, draw, or undocumented expense treatment.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a clean reimbursement lane: business purpose, receipt, timely submission, business approval, and return of excess advances.",
    factChecklist: [
      "Identify who paid the expense and why it was business-connected.",
      "Confirm the reimbursement request includes receipts and a business purpose.",
      "Track whether advances exceed substantiated expenses.",
      "Confirm the timing rules and policy are being followed consistently."
    ],
    documents: [
      "Written reimbursement policy or accountable plan document.",
      "Receipts and business purpose notes.",
      "Expense reports and approval records.",
      "Proof that excess advances were returned when applicable."
    ],
    mistakes: [
      "Reimbursing without receipts or business purpose.",
      "Treating old personal expenses as current business reimbursements.",
      "Failing to return excess advances.",
      "Using reimbursements to disguise wages, draws, or distributions."
    ],
    escalationTriggers: [
      "You need to set up or revise a reimbursement policy.",
      "You have old unreimbursed expenses.",
      "Expenses involve meals, travel, vehicle use, home office, or mixed personal use.",
      "You are unsure whether reimbursement should be wages, draws, or business expenses."
    ],
    relatedQuestions: [
      "What makes a reimbursement accountable?",
      "What receipts should I keep?",
      "When do advances need to be returned?"
    ],
    sourceLinks: [
      ["IRS Publication 463, Travel, Gift, and Car Expenses", "https://www.irs.gov/publications/p463"],
      ["IRS Publication 15, Employer's Tax Guide", "https://www.irs.gov/publications/p15"]
    ]
  },
  {
    title: "Business Vehicle and Mileage Logs",
    strategyKey: "vehicle-mileage",
    overview:
      "Vehicle deductions and mileage claims depend heavily on records. Public IRS guidance emphasizes business purpose, mileage records, dates, destination, and separation of personal and business use. This preview page helps clients build a clean fact file before asking for tax treatment.",
    whenThisMatters:
      "This matters when a client uses a car, truck, or SUV for business and wants to understand what records are needed before deducting vehicle expenses or choosing a mileage method.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a log-first topic: if the mileage and purpose are not documented, the tax discussion starts from a weak place.",
    factChecklist: [
      "Track date, destination, business purpose, and miles for business trips.",
      "Separate commuting, personal, and business mileage.",
      "Identify the vehicle, ownership, business use pattern, and whether reimbursements are involved.",
      "Confirm whether listed property, depreciation, or actual-expense treatment needs review."
    ],
    documents: [
      "Mileage log or app export.",
      "Vehicle purchase or lease documents.",
      "Fuel, repairs, insurance, registration, and loan or lease records if actual expenses are reviewed.",
      "Calendar entries or client/job records supporting business purpose."
    ],
    mistakes: [
      "Recreating mileage after the fact without support.",
      "Counting commuting as business mileage.",
      "Mixing personal and business use without a consistent log.",
      "Assuming a large vehicle purchase automatically creates a deduction."
    ],
    escalationTriggers: [
      "You purchased or plan to purchase a vehicle for business.",
      "You want to compare mileage and actual expense methods.",
      "Vehicle use is mixed personal and business.",
      "The vehicle may involve listed property, depreciation, Section 179, or bonus depreciation."
    ],
    relatedQuestions: [
      "What should my mileage log include?",
      "Can commuting count as business mileage?",
      "What records should I keep for an actual-expense vehicle deduction?"
    ],
    sourceLinks: [
      ["IRS Publication 463, Travel, Gift, and Car Expenses", "https://www.irs.gov/publications/p463"],
      ["IRS business expenses overview", "https://www.irs.gov/businesses/small-businesses-self-employed/deducting-business-expenses"]
    ]
  },
  {
    title: "Travel, Meals, and Business Purpose Documentation",
    strategyKey: "travel-meals",
    overview:
      "Travel and meal deductions are documentation-sensitive. Public IRS guidance emphasizes ordinary and necessary business purpose, records, and substantiation. This preview page helps clients gather facts before treating expenses as deductible business travel or meals.",
    whenThisMatters:
      "This matters when clients travel for business, host business meals, attend events, or pay for expenses that can easily look personal without documentation.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a story-and-receipt question: who was there, why it was business, what happened, and what receipt supports it.",
    factChecklist: [
      "Identify the business purpose for each trip or meal.",
      "Record who attended, the business relationship, date, location, and discussion topic.",
      "Separate personal days, family travel, entertainment, and mixed-use expenses.",
      "Confirm whether employer reimbursement or accountable-plan rules apply."
    ],
    documents: [
      "Receipts and payment records.",
      "Calendar entries, agendas, conference registration, or client meeting notes.",
      "Travel itinerary and lodging records.",
      "Expense reports with business purpose and attendees."
    ],
    mistakes: [
      "Saving a receipt without documenting business purpose.",
      "Treating entertainment as a meal without review.",
      "Mixing family vacation costs with business travel.",
      "Forgetting accountable-plan substantiation when reimbursed."
    ],
    escalationTriggers: [
      "Travel mixes business and personal days.",
      "Meals, entertainment, spouse/family travel, or events are involved.",
      "You need to determine deductibility or percentage limits.",
      "You are reimbursing yourself or an employee."
    ],
    relatedQuestions: [
      "What business purpose notes should I keep?",
      "How do I document who attended a meal?",
      "When does travel become mixed personal and business?"
    ],
    sourceLinks: [
      ["IRS Publication 463, Travel, Gift, and Car Expenses", "https://www.irs.gov/publications/p463"],
      ["IRS business expenses overview", "https://www.irs.gov/businesses/small-businesses-self-employed/deducting-business-expenses"]
    ]
  },
  {
    title: "Business Use of Home: Office Deduction Basics",
    strategyKey: "home-office",
    overview:
      "The home office deduction is generally tied to business use of part of a home and requires careful review of regular, exclusive, and business-use facts. This preview page helps clients gather facts and distinguish home office education from personalized deduction advice.",
    whenThisMatters:
      "This matters when a self-employed person or business owner uses part of a home for business and wants to understand what facts Shona/Jay need before evaluating home office treatment.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a boundary question: what exact space is used, how regularly, whether it is exclusive, and what documentation supports the business use.",
    factChecklist: [
      "Identify the exact area used for business and whether it is used exclusively for business.",
      "Document how regularly the space is used and what business activities happen there.",
      "Gather home expense records if actual-expense treatment will be reviewed.",
      "Confirm whether the taxpayer is self-employed, an employee, or using an entity arrangement."
    ],
    documents: [
      "Floor plan, square footage notes, or photos of the business space.",
      "Mortgage interest, rent, utilities, insurance, repairs, and related home expense records if reviewed.",
      "Calendar or work records supporting regular business use.",
      "Entity or reimbursement policy documents when relevant."
    ],
    mistakes: [
      "Using a shared personal room and calling it exclusive business use.",
      "Forgetting that employee and owner facts can differ.",
      "Skipping records for the actual-expense method.",
      "Assuming the simplified option resolves all eligibility questions."
    ],
    escalationTriggers: [
      "You want to claim a home office deduction.",
      "The space has mixed personal and business use.",
      "You are an S-corp owner or employee seeking reimbursement treatment.",
      "You need to compare methods or review state treatment."
    ],
    relatedQuestions: [
      "What does exclusive use mean?",
      "What records support a home office?",
      "Can my entity reimburse home office expenses?"
    ],
    sourceLinks: [
      ["IRS Publication 587, Business Use of Your Home", "https://www.irs.gov/publications/p587"],
      ["IRS simplified option for home office deduction", "https://www.irs.gov/businesses/small-businesses-self-employed/simplified-option-for-home-office-deduction"]
    ]
  },
  {
    title: "Worker Classification: Employee vs Contractor",
    strategyKey: "worker-classification",
    overview:
      "Worker classification depends on the facts of the relationship, not just the label in a contract. Public IRS guidance focuses on behavioral control, financial control, and the relationship of the parties. This preview page is designed to prepare facts for advisor review, not to classify a worker inside the portal.",
    whenThisMatters:
      "This matters before hiring, paying, or reclassifying workers, and whenever a business relies on contractors who may look like employees under federal or state rules.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a control-and-risk review: who directs the work, who controls the economics, what the relationship documents say, and how the arrangement works in practice.",
    factChecklist: [
      "Describe who controls when, where, and how the work is performed.",
      "Identify who provides tools, bears expenses, advertises services, and has profit or loss opportunity.",
      "Gather contracts, invoices, payment records, and role descriptions.",
      "Confirm whether state labor, unemployment, payroll, or industry-specific rules also apply."
    ],
    documents: [
      "Independent contractor agreement or employment agreement.",
      "Invoices, payment records, and Form 1099 or payroll records.",
      "Job descriptions, onboarding documents, and supervision notes.",
      "Proof of business registration, insurance, tools, or multiple clients when relevant."
    ],
    mistakes: [
      "Assuming a contract label controls the tax result.",
      "Treating a long-term supervised worker as a contractor without review.",
      "Ignoring state labor and unemployment rules.",
      "Waiting until year-end to fix classification concerns."
    ],
    escalationTriggers: [
      "You are deciding whether a worker is an employee or contractor.",
      "The worker performs core business work under your supervision.",
      "You need to correct prior payments or filings.",
      "There is audit, penalty, unemployment, or labor-law concern."
    ],
    relatedQuestions: [
      "What factors does the IRS consider for classification?",
      "Does a signed contractor agreement settle the issue?",
      "When should we file or consider Form SS-8?"
    ],
    sourceLinks: [
      ["IRS Topic No. 762, Independent Contractor vs. Employee", "https://www.irs.gov/taxtopics/tc762"],
      ["IRS worker classification information", "https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee"]
    ]
  },
  {
    title: "Small Business Retirement Plan Options: SEP/SIMPLE/401(k) Starter",
    strategyKey: "retirement-plans",
    overview:
      "Small business retirement plans can support tax planning and owner retirement goals, but plan choice, eligibility, contribution timing, employee coverage, and current-year limits require review. This preview page helps clients gather facts before asking Shona/Jay about SEP, SIMPLE, or 401(k)-style options.",
    whenThisMatters:
      "This matters when a business owner wants to save for retirement, reduce taxable income where appropriate, coordinate employee benefits, or decide whether a plan should be set up before a deadline.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a cash-flow and team-coverage decision: owner goals, employee census, contribution flexibility, administrative burden, and deadlines all matter.",
    factChecklist: [
      "Gather owner income, desired savings amount, cash-flow constraints, and entity type.",
      "List employees, ages, compensation, hours, tenure, and ownership relationships.",
      "Identify existing retirement plans and prior contributions.",
      "Confirm current-year limits, setup deadlines, and plan document requirements before acting."
    ],
    documents: [
      "Payroll records and employee census.",
      "Entity and ownership information.",
      "Prior retirement plan documents and contribution history.",
      "Current-year income projection and cash-flow plan."
    ],
    mistakes: [
      "Choosing a plan based only on owner contribution goals.",
      "Ignoring employee eligibility and coverage requirements.",
      "Missing setup or contribution deadlines.",
      "Using stale contribution limits without current-year verification."
    ],
    escalationTriggers: [
      "You want to set up or change a retirement plan.",
      "You have employees or may hire soon.",
      "You need current-year contribution limits or deadlines.",
      "You need coordination with payroll, plan administrator, or investment advisor."
    ],
    relatedQuestions: [
      "What employee information matters before choosing a plan?",
      "How do SEP, SIMPLE, and 401(k) options differ at a high level?",
      "When should I involve Shona/Jay and a plan administrator?"
    ],
    sourceLinks: [
      ["IRS Publication 560, Retirement Plans for Small Business", "https://www.irs.gov/publications/p560"],
      ["IRS retirement plans for small entities and self-employed", "https://www.irs.gov/retirement-plans/retirement-plans-for-small-entities-and-self-employed"]
    ]
  },
  {
    title: "Self-Employed Health Insurance Deduction Basics",
    strategyKey: "self-employed-health-insurance",
    overview:
      "The self-employed health insurance deduction can be relevant for eligible self-employed taxpayers, but eligibility, entity type, plan setup, earned income, and other coverage facts matter. This preview page helps gather facts before the team reviews treatment.",
    whenThisMatters:
      "This matters when a business owner pays health insurance premiums personally or through the business and wants to understand what facts may affect deduction treatment.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a coordination question: who owns the policy, who pays premiums, what entity is involved, whether there is other coverage, and how the deduction is reported.",
    factChecklist: [
      "Identify who is covered by the policy and who pays the premiums.",
      "Confirm entity type, owner status, and whether wages or self-employment income are involved.",
      "Gather information about employer-subsidized coverage available to the taxpayer or spouse.",
      "Confirm whether premiums were paid personally, through payroll, or through the business."
    ],
    documents: [
      "Health insurance premium statements.",
      "Proof of payment.",
      "Entity ownership and payroll records where relevant.",
      "Information about other available employer coverage."
    ],
    mistakes: [
      "Assuming every owner-paid premium is deductible the same way.",
      "Ignoring other available employer coverage.",
      "Forgetting entity-specific handling, especially for S-corp owners.",
      "Mixing personal, payroll, and business payment paths without review."
    ],
    escalationTriggers: [
      "You want to claim or change health insurance deduction treatment.",
      "You are an S-corp shareholder-employee.",
      "You or your spouse had access to employer coverage.",
      "The policy payment path changed during the year."
    ],
    relatedQuestions: [
      "Who should pay health insurance premiums?",
      "Does entity type change the treatment?",
      "What records should I keep for premiums?"
    ],
    sourceLinks: [
      ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"],
      ["IRS S corporation compensation and medical insurance issues", "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporation-compensation-and-medical-insurance-issues"]
    ]
  },
  {
    title: "QBI Deduction: What Counts and What Does Not",
    strategyKey: "qbi-deduction",
    overview:
      "The qualified business income deduction is a federal deduction that can be valuable, but it is highly fact-sensitive. Business type, taxable income, W-2 wages, qualified property, specified service trade or business status, and current-year limits can affect the result. This preview page helps clients gather facts for review.",
    whenThisMatters:
      "This matters when a pass-through business owner wants to understand why QBI is not simply a flat benefit and why entity, income, and business activity facts matter.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a category-and-threshold review: what business generated the income, what taxable income range applies, whether SSTB limits matter, and what records support the calculation.",
    factChecklist: [
      "Identify each business, entity type, and income stream.",
      "Gather taxable income projection, W-2 wage information, and qualified property details where relevant.",
      "Identify whether the business may be a specified service trade or business.",
      "Verify current-year thresholds and limits before making decisions."
    ],
    documents: [
      "Business profit and loss statements.",
      "K-1s, Schedule C records, or pass-through income details.",
      "Payroll and W-2 wage data for the business.",
      "Qualified property records and depreciation schedules where relevant."
    ],
    mistakes: [
      "Assuming all business income qualifies.",
      "Ignoring taxable income thresholds and SSTB rules.",
      "Using stale limits without current-year verification.",
      "Treating QBI as a planning conclusion without reviewing all businesses."
    ],
    escalationTriggers: [
      "You need to calculate QBI or know whether a business qualifies.",
      "Your business may be an SSTB.",
      "Income is near a threshold or changed significantly.",
      "Multiple businesses, K-1s, wages, or property limits are involved."
    ],
    relatedQuestions: [
      "What facts affect QBI?",
      "What is an SSTB at a high level?",
      "Why does taxable income matter for QBI?"
    ],
    sourceLinks: [
      ["IRS qualified business income deduction overview", "https://www.irs.gov/newsroom/qualified-business-income-deduction"],
      ["IRS Publication 535, Business Expenses", "https://www.irs.gov/publications/p535"]
    ]
  },
  {
    title: "Section 179 and Depreciation: Equipment Purchase Guardrails",
    strategyKey: "section-179-depreciation",
    overview:
      "Equipment purchases can create depreciation or Section 179 planning questions, but the treatment depends on property type, business use, placed-in-service timing, taxable income limits, listed property rules, and current-year limits. This preview page helps clients gather purchase facts before asking for a deduction decision.",
    whenThisMatters:
      "This matters before buying equipment, vehicles, technology, furniture, or other business property with the expectation of a current-year tax benefit.",
    shonaJayFrame:
      "Preview positioning: Shona/Jay might frame this as a decision-before-purchase topic: what are you buying, when is it placed in service, how will it be used, what cash flow supports the purchase, and what current-year rules apply?",
    factChecklist: [
      "Describe the property, cost, purchase date, and placed-in-service date.",
      "Estimate business-use percentage and identify personal use.",
      "Confirm whether the property may be listed property or a vehicle.",
      "Verify current-year Section 179 and bonus depreciation rules before acting."
    ],
    documents: [
      "Purchase invoice, financing agreement, or lease agreement.",
      "Placed-in-service evidence.",
      "Business-use logs or asset-use records.",
      "Depreciation schedule and prior asset records."
    ],
    mistakes: [
      "Buying equipment only for a tax deduction without cash-flow review.",
      "Assuming payment date is the same as placed-in-service date.",
      "Ignoring listed property and business-use substantiation.",
      "Using stale Section 179 or bonus depreciation limits."
    ],
    escalationTriggers: [
      "You are considering a major equipment or vehicle purchase.",
      "You need to know current-year deduction limits.",
      "The asset has personal use or may be listed property.",
      "You need to coordinate depreciation with financing, cash flow, or entity strategy."
    ],
    relatedQuestions: [
      "What does placed in service mean?",
      "What records support business use of equipment?",
      "Should I buy equipment before year-end?"
    ],
    sourceLinks: [
      ["IRS Publication 946, How To Depreciate Property", "https://www.irs.gov/publications/p946"],
      ["IRS Topic No. 704, Depreciation", "https://www.irs.gov/taxtopics/tc704"]
    ]
  }
];

const slugFor = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const seedTitles = seedSources.map((source) => source.title);
const seedSlugs = seedSources.map((source) => slugFor(source.title));

function parseArgs(argv) {
  const args = {
    mode: null,
    manifestPath: null,
    force: false
  };
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
  return path.join(OUTPUT_DIR, "latest-manifest.json");
}

function assertRequiredEnvironment(mode) {
  if (mode === "dry-run") {
    return;
  }
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for ${mode}: ${missing.join(", ")}`);
  }
}

async function ensureOutputDir() {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

async function execWrangler(args, options = {}) {
  const env = { ...process.env };
  const { stdout, stderr } = await execFileAsync("npx", ["wrangler", ...args], {
    env,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024
  });
  return { stdout, stderr };
}

async function d1(sql) {
  const { stdout } = await execWrangler([
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
  const success = json?.[0]?.success;
  if (!success) {
    throw new Error(`D1 command failed: ${sql}`);
  }
  return json;
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
  if (vectorIds.length === 0) {
    return;
  }
  await execWrangler(["vectorize", "delete-vectors", PRODUCTION_VECTOR_INDEX, "--env", "production", "--ids", ...vectorIds]);
}

async function portalFetch(pathname, options = {}, cookieJar = null) {
  const headers = { ...(options.headers ?? {}) };
  if (cookieJar?.cookie) {
    headers.cookie = cookieJar.cookie;
  }
  const response = await fetch(`${PORTAL_ORIGIN}${pathname}`, { ...options, headers });
  const setCookie = response.headers.get("set-cookie");
  if (cookieJar && setCookie) {
    cookieJar.cookie = setCookie.split(";")[0];
  }
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

async function preflight({ dryRun }) {
  console.log("Preflight: checking portal health.");
  const health = await portalFetch("/api/health");
  if (!health.response.ok || health.json?.ok !== true || health.json?.environment !== "production") {
    throw new Error(`Production health check failed: ${health.response.status} ${health.text.slice(0, 160)}`);
  }

  if (!dryRun) {
    console.log("Preflight: checking admin authentication.");
    await adminLogin();
  }

  console.log("Preflight: checking existing seed titles and slugs.");
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
  const sourceList = source.sourceLinks.map(([label, url]) => `- [${label}](${url})`).join("\n");
  const factChecklist = source.factChecklist.map((item) => `- ${item}`).join("\n");
  const documents = source.documents.map((item) => `- ${item}`).join("\n");
  const mistakes = source.mistakes.map((item) => `- ${item}`).join("\n");
  const escalation = source.escalationTriggers.map((item) => `- ${item}`).join("\n");
  const questions = source.relatedQuestions.map((item) => `- ${item}`).join("\n");

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

${factChecklist}

## Documents To Gather

${documents}

## Common Mistakes

${mistakes}

## Escalation Triggers

Escalate to Shona/Jay before acting when any of these are true:

${escalation}

## Related Questions

${questions}

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

  const created = await postAdmin(cookieJar, ADMIN_SOURCES_PATH, payload);
  const sourceId = created.id;
  if (!sourceId) {
    throw new Error(`Source creation returned no id for ${source.title}`);
  }

  const ingested = await postAdmin(cookieJar, `/api/admin/sources/${encodeURIComponent(sourceId)}/ingest`);
  const wikiId = ingested.wikiId;
  if (!wikiId) {
    throw new Error(`Ingest returned no wikiId for ${source.title}`);
  }

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
    throw new Error(`Post-publish D1 validation failed for ${source.title}`);
  }

  const record = {
    title: source.title,
    slug: slugFor(source.title),
    strategyKey: source.strategyKey,
    contentHash: payloadHash,
    sourceId,
    wikiId,
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
  };

  manifest.sources.push(record);
  await writeManifest(manifest);
  return record;
}

async function writeManifest(manifest) {
  await ensureOutputDir();
  const manifestPath = path.join(OUTPUT_DIR, `${manifest.id}.json`);
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, json);
  await writeFile(latestManifestPath(), json);
  return manifestPath;
}

async function dryRun() {
  assertRequiredEnvironment("dry-run");
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
  await ensureOutputDir();
  const preflightResult = await preflight({ dryRun: false });
  if ((preflightResult.existingSources.length > 0 || preflightResult.existingPages.length > 0) && !args.force) {
    throw new Error("Matching seed titles/slugs already exist. Re-run with --force only if you intend an idempotent/recovery run.");
  }

  const cookieJar = await adminLogin();
  const manifest = buildSeedManifestBase();
  await writeManifest(manifest);

  try {
    for (const source of seedSources) {
      await createProcessPublish(cookieJar, source, manifest);
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
  const auditRows = await d1Results(
    `SELECT target_id, action, COUNT(*) AS total FROM audit_events WHERE tenant_id = '${TENANT_ID}' AND action IN ('source.ingest', 'wiki.publish', 'vector.upsert', 'vector.skip') GROUP BY target_id, action`
  );

  const expected = titles.length;
  const sourceCount = Number(sourceCountRows[0]?.total ?? 0);
  const wikiCount = Number(wikiCountRows[0]?.total ?? 0);
  const missingChunks = chunkRows.filter((row) => Number(row.chunks) < 1);

  console.log(`Validation: published sources ${sourceCount}/${expected}`);
  console.log(`Validation: published wiki pages ${wikiCount}/${expected}`);
  console.log(`Validation: chunk rows with missing chunks ${missingChunks.length}`);

  if (sourceCount !== expected || wikiCount !== expected || missingChunks.length > 0) {
    throw new Error("Validation failed for published source/wiki/chunk counts.");
  }

  if (manifest.sources.length > 0) {
    for (const record of manifest.sources) {
      const keys = [record.r2Keys.raw, record.r2Keys.normalized, record.r2Keys.compiled].filter(Boolean);
      for (const key of keys) {
        const exists = await r2Exists(key);
        if (!exists) {
          throw new Error(`Missing R2 object for ${record.title}: ${key}`);
        }
      }
      const eventActions = auditRows.filter((row) => row.target_id === record.wikiId).map((row) => row.action);
      if (!eventActions.includes("wiki.publish")) {
        throw new Error(`Missing wiki.publish audit event for ${record.title}`);
      }
      if (!eventActions.includes("vector.upsert") && !eventActions.includes("vector.skip")) {
        throw new Error(`Missing vector audit event for ${record.title}`);
      }
      if (eventActions.includes("vector.skip")) {
        console.warn(`Degraded vector mode recorded for ${record.title}; D1 retrieval fallback remains available.`);
      }
    }
  }

  const clientTrainings = await fetchClientTrainingCount();
  console.log(`Validation: client-visible trainings found through API: ${clientTrainings}`);
  if (clientTrainings < expected) {
    throw new Error(`Client trainings API returned ${clientTrainings}, expected at least ${expected}.`);
  }
}

async function fetchClientTrainingCount() {
  const clientIdRows = await d1Results(
    `SELECT id FROM client_profiles WHERE tenant_id = '${TENANT_ID}' AND email = 'bowiee@jahinc.org' LIMIT 1`
  );
  const clientId = clientIdRows[0]?.id;
  if (!clientId) {
    throw new Error("Missing bowiee@jahinc.org client profile for client API validation.");
  }
  const sessionId = `sess_seed_preview_${randomUUID().replaceAll("-", "")}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await d1Run(
    `INSERT INTO sessions (id, tenant_id, client_id, admin_email, role, expires_at, created_at) VALUES ('${sessionId}', '${TENANT_ID}', '${sqlEscape(clientId)}', NULL, 'client', '${expiresAt}', '${nowIso()}')`
  );
  try {
    const result = await portalFetch("/api/trainings", {
      method: "GET",
      headers: {
        cookie: `__Host_ask_shona_session=${sessionId}`
      }
    });
    if (!result.response.ok) {
      throw new Error(`Client trainings API failed: ${result.response.status} ${result.text.slice(0, 160)}`);
    }
    const seededTitles = new Set(seedTitles);
    const trainings = result.json?.trainings ?? [];
    return trainings.filter((training) => seededTitles.has(training.title)).length;
  } finally {
    await d1Run(`DELETE FROM sessions WHERE id = '${sessionId}'`);
  }
}

async function readManifest(manifestPath = null) {
  const resolvedPath = manifestPath || latestManifestPath();
  if (!existsSync(resolvedPath)) {
    if (!manifestPath) {
      return { sources: [] };
    }
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
  console.log(`Rollback: ${manifest.sources.length} sources from ${manifest.id}`);

  const vectorIds = manifest.sources.flatMap((source) => source.chunks.map((chunk) => chunk.vectorId).filter(Boolean));
  if (vectorIds.length > 0) {
    console.log(`Rollback: deleting ${vectorIds.length} vector ids.`);
    await deleteVectors(vectorIds);
  }

  const chunkIds = manifest.sources.flatMap((source) => source.chunks.map((chunk) => chunk.id).filter(Boolean));
  if (chunkIds.length > 0) {
    await d1Run(`DELETE FROM knowledge_chunks WHERE id IN (${quoted(chunkIds)})`);
  }

  const wikiIds = manifest.sources.map((source) => source.wikiId).filter(Boolean);
  if (wikiIds.length > 0) {
    await d1Run(`DELETE FROM wiki_pages WHERE id IN (${quoted(wikiIds)})`);
  }

  const sourceIds = manifest.sources.map((source) => source.sourceId).filter(Boolean);
  if (sourceIds.length > 0) {
    await d1Run(`DELETE FROM source_documents WHERE id IN (${quoted(sourceIds)})`);
  }

  const r2Keys = manifest.sources
    .flatMap((source) => [source.r2Keys.raw, source.r2Keys.normalized, source.r2Keys.compiled])
    .filter(Boolean);
  for (const key of r2Keys) {
    await deleteR2Object(key);
  }

  await d1Run(
    `INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at) VALUES ('audit_${randomUUID().replaceAll("-", "")}', '${TENANT_ID}', 'seed-preview-knowledge-script', 'seed.rollback', 'seed_batch', '${sqlEscape(manifest.id)}', '${sqlEscape(JSON.stringify({ sourceCount: manifest.sources.length }))}', '${nowIso()}')`
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
    assertRequiredEnvironment("validate");
    await validate(args.manifestPath);
    return;
  }
  if (args.mode === "rollback") {
    await rollback(args.manifestPath);
    return;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
