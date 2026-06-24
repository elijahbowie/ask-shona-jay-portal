#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
const root = process.cwd();
const tenantId = "tenant_beyond_freedom";
const database = process.env.D1_DATABASE || "ask-shona-jay-db-production";
const bucket = process.env.R2_BUCKET || "ask-shona-jay-content-production";
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = join(root, ".tax-game-advanced-runs", runId);
const generatedDir = join(runDir, "generated-assets");

const pages = [
  {
    title: "Defined Benefit and Cash Balance Plan Review",
    slug: "defined-benefit-and-cash-balance-plan-review",
    strategyKey: "defined-benefit-cash-balance-plan",
    summary: "Use this page to gather the facts needed before Shona/Jay, an actuary, plan administrator, and investment/benefits professionals review whether a defined benefit or cash balance plan belongs in the client's tax and retirement strategy.",
    overview: "Defined benefit and cash balance plans can create larger employer-funded retirement contributions than ordinary defined contribution plans, but they are not simple write-offs. The plan has to be designed, funded, administered, tested, and maintained. A cash balance plan is a defined benefit plan that states the promised benefit as a hypothetical account balance with pay credits and interest credits. The employer bears funding and investment risk.",
    applies: [
      "Business owners with stable, meaningful profit who want to evaluate larger retirement funding.",
      "Owners who can commit to ongoing funding, actuarial review, plan administration, and employee coverage rules.",
      "Clients who already have clean payroll, reliable books, and a year-end projection.",
      "Clients who need a review of owner age, compensation, employee census, cash flow, and retirement goals."
    ],
    notFit: [
      "Businesses with unstable cash flow or no ability to fund required contributions.",
      "Clients who want to use a plan only for a one-year deduction without ongoing administration.",
      "Clients with employees whose census, eligibility, or testing facts have not been reviewed.",
      "Clients who need investment, ERISA, or plan-document advice but have not engaged the appropriate professionals."
    ],
    inputs: [
      "Owner age, compensation history, desired retirement age, entity type, and ownership.",
      "Employee census with dates of birth, dates of hire, hours, compensation, ownership, and family relationships.",
      "Current and projected profit, cash reserves, payroll reports, and existing retirement plan documents.",
      "Desired contribution range, funding capacity, investment constraints, and timeline."
    ],
    workflow: [
      "Gather the census, compensation, owner goals, current plan documents, and profit projection.",
      "Confirm whether the business can fund a recurring plan obligation without starving operations or taxes.",
      "Send the packet to Shona/Jay before any plan vendor quote is treated as tax guidance.",
      "Have the actuary or plan administrator model required contributions, testing, funding, PBGC or ERISA requirements, and employee impact.",
      "Review the deduction, cash-flow, payroll, entity, and employee communication consequences before adoption.",
      "If approved, save the plan document, adoption agreement, funding schedule, annual valuation, Form 5500 materials, and contribution proof in the tax vault."
    ],
    documents: [
      "Payroll registers, W-2s, owner compensation records, employee census, and prior retirement plan documents.",
      "Current-year profit projection, tax estimate, balance sheet, cash-flow plan, and bank statements.",
      "Plan illustrations, actuarial reports, adoption documents, investment policy notes, and employee notices.",
      "Evidence of contributions, filing confirmations, and annual administration records."
    ],
    timing: [
      "Start review well before year-end because plan design, documents, census cleanup, and funding decisions take time.",
      "Confirm adoption, funding, filing, and extension deadlines with the plan administrator and Shona/Jay.",
      "Update the census and compensation data annually before contribution and filing calculations."
    ],
    caveats: [
      "For 2026, the IRS defined benefit annual benefit limit is generally the lesser of 100% of highest three-year average compensation or $290,000, subject to future cost-of-living adjustments.",
      "Cash balance plans are defined benefit plans; they are more complex and costly than many defined contribution plans.",
      "Employee coverage, nondiscrimination, controlled-group, affiliated-service-group, ERISA, PBGC, funding, and plan-document rules can change the outcome.",
      "Do not rely on transcript examples or vendor illustrations without current-year professional review."
    ],
    mistakes: [
      "Treating a cash balance illustration as an approved tax plan.",
      "Ignoring employee census and controlled-group rules.",
      "Overfunding or underfunding because the plan was not coordinated with cash flow.",
      "Missing Form 5500, actuarial, notice, or funding deadlines.",
      "Assuming money can be accessed like an ordinary bank account."
    ],
    review: [
      "Shona/Jay must review the tax projection before adoption.",
      "An actuary or qualified plan administrator must review plan design, contributions, testing, and filing requirements.",
      "Investment, legal, ERISA, and benefits professionals should review plan documents, employee communications, and fiduciary duties.",
      "No contribution, deduction, plan adoption, or employee communication should happen from the wiki page alone."
    ],
    checklist: [
      "Employee census completed and reviewed.",
      "Profit projection and tax estimate prepared.",
      "Existing retirement plans identified.",
      "Actuarial/administrator illustration reviewed.",
      "Advisor review gate cleared before adoption or funding.",
      "Plan documents and contribution proof saved in the tax vault."
    ],
    sources: [
      ["IRS defined benefit plan overview", "https://www.irs.gov/retirement-plans/defined-benefit-plan"],
      ["IRS defined benefit plan benefit limits", "https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-defined-benefit-plan-benefit-limits"],
      ["DOL cash balance pension plan fact sheet", "https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/resource-center/fact-sheets/cash-balance-pension-plans"]
    ]
  },
  {
    title: "QSBS and Exit Planning Review",
    slug: "qsbs-and-exit-planning-review",
    strategyKey: "qsbs-exit-planning",
    summary: "Use this page to gather entity, stock, business activity, holding-period, and exit facts before anyone relies on qualified small business stock or a business sale strategy.",
    overview: "Qualified Small Business Stock planning under section 1202 can be powerful, but it is technical and fact-sensitive. It generally starts with C corporation stock, original issuance, active-business requirements, excluded-business checks, gross-asset limits, holding-period review, and owner-level eligibility. Exit planning also requires coordination before a sale, redemption, rollover, equity grant, restructuring, or investor transaction.",
    applies: [
      "Founders, owners, or investors who hold or may issue C corporation stock.",
      "Clients considering a business sale, equity raise, C corporation conversion, stock issuance, or ownership restructuring.",
      "Clients who need a clean record of stock issuance, basis, holding period, gross assets, and active business use.",
      "Clients who want to understand whether section 1202, section 1045 rollover, or other exit planning concepts should be reviewed."
    ],
    notFit: [
      "S corporation, partnership, LLC, or sole proprietor interests that have not been reviewed for C corporation stock treatment.",
      "Businesses in excluded or uncertain activities without legal and tax review.",
      "Clients close to a sale who have not preserved original issuance and holding-period documentation.",
      "Clients seeking a guaranteed tax-free exit based only on a webinar example."
    ],
    inputs: [
      "Entity history, formation documents, tax elections, capitalization table, stock ledger, and shareholder agreements.",
      "Stock issuance dates, purchase documents, contribution records, option/grant documents, and basis support.",
      "Balance sheets at issuance and during the holding period, gross asset support, business activity description, and revenue streams.",
      "Potential sale timeline, buyer structure, asset-vs-stock sale expectations, redemptions, transfers, and related-party transactions."
    ],
    workflow: [
      "Build a timeline from formation through current ownership and any planned exit.",
      "Identify each stock issuance, owner, basis, holding period, and transfer.",
      "Confirm C corporation status, original issuance facts, gross assets, active-business facts, and excluded-business concerns.",
      "Send the packet to Shona/Jay and legal counsel before changing entity structure, issuing stock, redeeming shares, or negotiating sale tax terms.",
      "Model federal, state, NIIT, installment sale, rollover, and alternative deal structures before signing documents.",
      "Save the final legal/tax memo, sale documents, K-1s or 1099s, stock records, and advisor conclusions."
    ],
    documents: [
      "Articles, bylaws, operating history, tax elections, stock ledger, cap table, board approvals, and shareholder agreements.",
      "Issuance documents, option plans, subscription agreements, purchase records, and basis support.",
      "Financial statements, gross asset support, business activity descriptions, and revenue classifications.",
      "Letters of intent, purchase agreements, waterfall schedules, escrow notes, installment terms, and legal opinions."
    ],
    timing: [
      "Start review before issuing stock, converting entity type, raising capital, granting equity, redeeming shares, or signing exit terms.",
      "Holding-period and original-issuance issues cannot usually be fixed at closing.",
      "Confirm current section 1202 and state treatment before the sale year."
    ],
    caveats: [
      "IRS materials still describe historic 50%, 75%, and 100% exclusion rules by acquisition period, and IRS OBBB materials indicate post-July 4, 2025 section 1202 changes and guidance are developing.",
      "Section 1202 has strict stock, corporation, business, gross asset, holding period, and shareholder requirements.",
      "Many states do not follow federal treatment exactly.",
      "QSBS planning is legal/tax planning, not a self-implementation checklist."
    ],
    mistakes: [
      "Assuming an LLC interest or S corporation share is QSBS.",
      "Ignoring original issuance, redemptions, gross assets, or excluded-business rules.",
      "Waiting until a buyer letter of intent is signed to start the review.",
      "Not preserving stock certificates, cap tables, and board approvals.",
      "Assuming federal exclusion automatically produces state exclusion."
    ],
    review: [
      "Shona/Jay must review the tax impact before the client relies on section 1202 or exit treatment.",
      "Business counsel must review entity documents, stock issuance, sale structure, and owner rights.",
      "Do not sign conversion, issuance, redemption, sale, or rollover documents before the review gate clears."
    ],
    checklist: [
      "Entity and tax history timeline completed.",
      "Stock ledger and issuance records gathered.",
      "Gross asset and active-business support gathered.",
      "Exit timeline and likely deal structure documented.",
      "Federal and state review completed before signing.",
      "Advisor conclusion saved with supporting records."
    ],
    sources: [
      ["IRS Publication 550, qualified small business stock discussion", "https://www.irs.gov/publications/p550"],
      ["IRS OBBB business provisions script, section 1202 discussion", "https://www.irs.gov/newsroom/one-big-beautiful-bill-business-tax-provisions-youtube-video-text-script"],
      ["IRS 2025-2026 Priority Guidance Plan", "https://www.irs.gov/pub/irs-counsel/2025-2026-initial-pgp.pdf"]
    ]
  },
  {
    title: "R&D and Software Development Cost Review",
    slug: "r-and-d-and-software-development-cost-review",
    strategyKey: "research-development-software-costs",
    summary: "Use this page to gather research, experimentation, software development, payroll, contractor, and project records before claiming a research deduction, amortization method, or credit.",
    overview: "Research and software development costs are current-law sensitive. Under OBBBA, new section 174A allows domestic research or experimental expenditures paid or incurred in tax years beginning after December 31, 2024 to be deducted currently, with an election available to capitalize and amortize. Foreign research treatment remains different. The research credit is a separate issue that uses Form 6765 and requires project-level support.",
    applies: [
      "Businesses developing software, products, processes, formulas, prototypes, technical designs, or improved functionality.",
      "Startups or small businesses that may have little income tax liability but payroll and qualifying research expenses.",
      "Clients with engineers, developers, technical contractors, supplies, cloud tools, testing records, or project logs.",
      "Clients who capitalized prior-year section 174 costs and need current-year transition review."
    ],
    notFit: [
      "Ordinary marketing, training, routine maintenance, quality control, or customer support with no technical uncertainty.",
      "Clients who cannot identify projects, people, wages, supplies, contractor costs, and technical work performed.",
      "Foreign research or mixed domestic/foreign teams without location and cost allocation records.",
      "Clients seeking a credit claim without Form 6765-level documentation."
    ],
    inputs: [
      "Project list, technical objectives, uncertainties, experiments, alternatives tested, and project outcomes.",
      "Employee wages by project, contractor invoices, supply costs, cloud/software costs, and location of work.",
      "Prior-year section 174 amortization schedules, accounting method history, and prior Form 6765 filings.",
      "Payroll tax filings if reviewing qualified small business payroll tax credit options."
    ],
    workflow: [
      "Separate research projects from routine business operations.",
      "Map each project to people, dates, costs, technical uncertainty, experimentation, and results.",
      "Classify costs as domestic, foreign, software development, contractor, supplies, or non-qualifying support.",
      "Review whether the issue is a current deduction, amortization election, method change, research credit, payroll tax credit, or all of the above.",
      "Send the project file to Shona/Jay before filing or amending.",
      "If a credit is pursued, prepare Form 6765 support and payroll-tax-credit timing documents where applicable.",
      "Save the calculation, advisor review, forms, workpapers, and project evidence."
    ],
    documents: [
      "Project charters, tickets, engineering notes, test plans, repositories, prototypes, and design records.",
      "Payroll reports, time allocations, contractor invoices, supply receipts, cloud bills, and location records.",
      "Prior-year returns, Form 6765, Form 8974 if applicable, Form 3800, and section 174 schedules.",
      "Accounting method notes and advisor correspondence."
    ],
    timing: [
      "Gather project records during the work, not after filing season.",
      "Payroll tax credit elections generally require timely filed returns and cannot be made late on an amended return.",
      "Review method changes and transition options before filing the first affected return."
    ],
    caveats: [
      "Domestic R&E under section 174A and foreign R&E under section 174 are not the same.",
      "Software development is treated as research or experimental expenditure for this area.",
      "A deduction and a credit are different; claiming one does not automatically qualify the other.",
      "The research credit is documentation-heavy and can be challenged without project-level support."
    ],
    mistakes: [
      "Calling all software or product work R&D without technical uncertainty records.",
      "Ignoring contractor, foreign, or cloud-cost allocation.",
      "Missing payroll tax credit election timing.",
      "Not coordinating deductions, credits, wage addbacks, and accounting methods.",
      "Filing a credit claim with only a percentage estimate and no project file."
    ],
    review: [
      "Shona/Jay must review the project file before a deduction, credit, payroll tax election, amended return, or method change is filed.",
      "Escalate when the client has foreign teams, prior-year capitalization, amended claims, large credits, or weak project records.",
      "Technical and legal review may be required for high-dollar or complex claims."
    ],
    checklist: [
      "Project list and technical uncertainty documented.",
      "Costs mapped to projects and locations.",
      "Prior-year section 174 treatment identified.",
      "Credit-vs-deduction question separated.",
      "Form 6765/Form 8974 timing reviewed where applicable.",
      "Advisor review completed before filing."
    ],
    sources: [
      ["IRS Revenue Procedure 2025-28", "https://www.irs.gov/pub/irs-drop/rp-25-28.pdf"],
      ["IRS Instructions for Form 6765", "https://www.irs.gov/instructions/i6765"],
      ["IRS qualified small business payroll tax credit for increasing research activities", "https://www.irs.gov/businesses/small-businesses-self-employed/qualified-small-business-payroll-tax-credit-for-increasing-research-activities"]
    ]
  },
  {
    title: "PTET and SALT Workaround Review",
    slug: "ptet-and-salt-workaround-review",
    strategyKey: "ptet-salt-workaround",
    summary: "Use this page to gather state, entity, owner, income, payment, and election facts before a partnership or S corporation makes a pass-through entity tax election or payment.",
    overview: "Pass-through entity tax planning can allow certain state and local income tax payments to be deducted by a partnership or S corporation at the entity level, but the result depends on state law and owner facts. IRS Notice 2020-75 provides federal guidance for specified income tax payments, but each state election, credit, deduction, deadline, and K-1 reporting result must be reviewed separately.",
    applies: [
      "Partnerships and S corporations in states with pass-through entity tax regimes.",
      "Owners affected by state income tax, SALT deduction limitations, and K-1 state allocations.",
      "Businesses with reliable current-year income projections and cash to make timely state payments.",
      "Clients who need to compare entity-level tax payment, owner credit, cash-flow, and federal deduction impact."
    ],
    notFit: [
      "Sole proprietors or single-member LLCs that are not taxed as eligible pass-through entities unless state law says otherwise.",
      "Entities with uncertain income, ownership changes, multi-state allocation issues, or no state PTET election available.",
      "Owners who cannot use the state credit or who may be harmed by cash-flow/timing differences.",
      "Clients trying to make a late election without checking state rules."
    ],
    inputs: [
      "Entity type, state registrations, owner residency, ownership percentages, and state filing history.",
      "Current-year taxable income projection, apportionment, K-1 allocations, and prior-year state taxes.",
      "State PTET election deadline, payment deadline, estimated payment rules, and owner credit mechanics.",
      "Owner-level tax projections showing federal, state, cash-flow, and credit effects."
    ],
    workflow: [
      "Identify every state where the entity files or may owe tax.",
      "Confirm whether the state has a PTET regime and whether the entity and owners qualify.",
      "Gather current-year income projection and owner allocations.",
      "Model the entity-level payment, federal deduction, owner credit, state addback, and cash-flow impact.",
      "Send the packet to Shona/Jay before the election or payment is made.",
      "If approved, make the election/payment by the state deadline and save confirmations.",
      "Reconcile K-1 reporting, owner credits, and state return treatment at filing."
    ],
    documents: [
      "Entity documents, state registrations, prior state returns, K-1s, ownership records, and current-year books.",
      "State PTET election forms, payment vouchers, confirmation numbers, and state guidance.",
      "Owner tax projections, state credit calculations, apportionment workpapers, and cash-flow notes.",
      "Final K-1s and state return workpapers."
    ],
    timing: [
      "PTET election and payment deadlines vary by state and often cannot be fixed after the deadline.",
      "Review before year-end and before state estimated tax dates.",
      "Revisit after ownership, residency, income, or state filing facts change."
    ],
    caveats: [
      "Notice 2020-75 addresses specified entity-level income tax payments, but state law controls availability and mechanics.",
      "Owner-level benefits can differ by resident/nonresident status, state credit rules, entity type, and income allocation.",
      "Federal benefit can be reduced or reversed by state addbacks, owner credit limitations, or cash-flow timing."
    ],
    mistakes: [
      "Making a state election without modeling all owners.",
      "Missing the state election deadline.",
      "Assuming every state works like the prior state reviewed.",
      "Ignoring owner residency and nonresident withholding.",
      "Not reconciling the K-1 and owner state credit."
    ],
    review: [
      "Shona/Jay must review the state-specific election, payment, owner impact, and return reporting before action.",
      "Escalate when there are multiple owners, multiple states, ownership changes, nonresident owners, or large payments.",
      "Do not make a PTET election or payment from this page alone."
    ],
    checklist: [
      "Eligible entity and state identified.",
      "Owner residency and allocation facts gathered.",
      "State deadline confirmed from official source.",
      "Federal/state cash-flow model prepared.",
      "Advisor review gate cleared before payment/election.",
      "Payment confirmation and K-1 reporting saved."
    ],
    sources: [
      ["IRS Notice 2020-75", "https://www.irs.gov/pub/irs-drop/n-20-75.pdf"],
      ["IRS TCJA business resources mentioning Notice 2020-75", "https://www.irs.gov/newsroom/tax-cuts-and-jobs-act-businesses"]
    ]
  },
  {
    title: "Business Tax Credits Intake",
    slug: "business-tax-credits-intake",
    strategyKey: "business-tax-credits-intake",
    summary: "Use this page to identify possible business credits and gather the forms, timing, eligibility, wage, expense, certification, and documentation facts before Shona/Jay reviews a credit claim.",
    overview: "Business credits are dollar-for-dollar tax benefits, but they usually have narrow eligibility rules, forms, timing traps, carryforward rules, and documentation requirements. This intake page does not approve a credit. It helps clients identify whether a credit should be reviewed for research activity, hiring, accessibility, retirement plan startup costs, health coverage, or other business activity.",
    applies: [
      "Businesses hiring employees from targeted groups, improving accessibility, starting retirement plans, performing research, or exploring other credits.",
      "Clients who can gather the specific form, certification, wage, expense, and timing records required for the credit.",
      "Businesses that need to separate credits from ordinary deductions and cash reimbursements.",
      "Clients with prior unused credits or carryforward questions."
    ],
    notFit: [
      "Clients who want to claim a credit without eligibility records or required forms.",
      "Businesses that missed pre-certification or timely election deadlines.",
      "Clients relying on generic refund promises or credit mills.",
      "Expenses that are personal, unsupported, reimbursed, or already used for another incompatible benefit."
    ],
    inputs: [
      "Credit being considered, tax year, entity type, employee count, wages, qualified expenses, and filing status.",
      "Forms, certifications, state agency documents, payroll records, receipts, invoices, and prior-year credit schedules.",
      "Research project records if claiming research credits.",
      "Retirement plan setup/admin costs, employee eligibility, and plan contribution details if claiming plan credits."
    ],
    workflow: [
      "List possible credits and separate them by category: research, hiring, accessibility, retirement plan, health, energy, or other.",
      "For each credit, identify the required form, deadline, certification, wage/expense base, and whether pre-approval is needed.",
      "Gather records before the return is prepared.",
      "Check whether the same expense is being used for another credit, deduction, reimbursement, or grant.",
      "Send the intake packet to Shona/Jay before claiming the credit.",
      "Save final forms, calculations, certifications, carryforward schedules, and advisor notes."
    ],
    documents: [
      "Payroll reports, employee certifications, Form 8850, Form 5884, Form 3800, Form 6765, Form 8974, Form 8826, Form 8881, or other applicable forms.",
      "Invoices, receipts, plan documents, project records, wage support, state certifications, and prior-year credit carryforward schedules.",
      "Advisor notes explaining why the credit applies and how the calculation was made."
    ],
    timing: [
      "Some credits require pre-certification or timely elections before or shortly after hiring, filing, or plan adoption.",
      "WOTC generally requires Form 8850 submission to the state workforce agency within 28 days of the new employee's start date.",
      "Research payroll tax credit elections generally require timely filed income tax returns."
    ],
    caveats: [
      "IRS says OBBBA may affect business credits and deductions; current-year review is required.",
      "Credits are different from deductions and may be limited by tax liability, payroll tax liability, or carryforward rules.",
      "Credit claims often need more documentation than ordinary deductions."
    ],
    mistakes: [
      "Missing pre-certification or timely election deadlines.",
      "Double-counting the same expense.",
      "Claiming credits based on vendor marketing without source documents.",
      "Not keeping project-level records for research credits.",
      "Ignoring credit carryforward/carryback and limitation rules."
    ],
    review: [
      "Shona/Jay must review eligibility, timing, forms, and records before any credit is claimed.",
      "Escalate any amended credit claim, large refund claim, research credit, ERC-related issue, or vendor-prepared claim.",
      "No credit should be claimed from this intake checklist alone."
    ],
    checklist: [
      "Possible credit identified.",
      "Applicable form and deadline confirmed.",
      "Required certification/election gathered.",
      "Wage/expense support attached.",
      "Double-benefit conflicts reviewed.",
      "Advisor review completed before filing."
    ],
    sources: [
      ["IRS business tax credits", "https://www.irs.gov/businesses/small-businesses-self-employed/business-tax-credits"],
      ["IRS credits and deductions for businesses", "https://www.irs.gov/credits-deductions/businesses"],
      ["IRS Work Opportunity Tax Credit", "https://www.irs.gov/newsroom/small-businesses-can-benefit-from-the-work-opportunity-tax-credit"],
      ["IRS disabled access and barrier removal tax incentives", "https://www.irs.gov/newsroom/tax-benefits-of-making-a-business-accessible-to-workers-and-customers-with-disabilities"],
      ["IRS retirement plans startup costs tax credit", "https://www.irs.gov/retirement-plans/retirement-plans-startup-costs-tax-credit"]
    ]
  },
  {
    title: "Key Person and Business Insurance Planning",
    slug: "key-person-and-business-insurance-planning",
    strategyKey: "key-person-business-insurance",
    summary: "Use this page to gather policy, beneficiary, business purpose, ownership, and deduction facts before treating insurance as a business expense, continuity plan, or owner-benefit strategy.",
    overview: "Business insurance planning can protect continuity, loans, buy-sell obligations, employees, and owners, but it is not automatically a tax deduction. IRS small-business guidance says life insurance, endowment, or annuity premiums generally are not deductible when the taxpayer or business is directly or indirectly a beneficiary. That makes beneficiary, ownership, loan, compensation, and plan-document review essential.",
    applies: [
      "Businesses reviewing key person coverage, buy-sell funding, loan protection, disability coverage, liability coverage, or employee benefits.",
      "Clients who need to separate risk management from deductible expense treatment.",
      "Owners considering business-owned policies, personally owned policies, split-dollar arrangements, or insurance inside retirement/benefit structures.",
      "Clients with lenders, partners, investors, or employees who require continuity planning."
    ],
    notFit: [
      "Clients who want to deduct life insurance premiums while the business or owner is a beneficiary without review.",
      "Clients using insurance primarily as an investment, estate, or personal wealth strategy without legal/tax review.",
      "Policies with unclear owner, insured, beneficiary, loan, or compensation treatment.",
      "Arrangements marketed as easy deductions or tax-free banking without documentation."
    ],
    inputs: [
      "Policy type, owner, insured, beneficiary, premium payer, business purpose, and loan or buy-sell connection.",
      "Entity type, ownership, shareholder/partner agreements, employment agreements, and compensation arrangements.",
      "Policy illustrations, applications, premium schedules, cash value projections, and beneficiary forms.",
      "Whether the policy relates to a loan, continuity plan, employee benefit, retirement plan, or personal planning."
    ],
    workflow: [
      "Identify the risk the policy is meant to solve: key person, loan, buy-sell, disability, liability, employee benefit, or personal planning.",
      "Map policy owner, insured, premium payer, beneficiary, and who benefits directly or indirectly.",
      "Separate ordinary business insurance from life insurance, annuity, endowment, investment, or owner-benefit arrangements.",
      "Send the policy packet to Shona/Jay and legal/insurance professionals before deducting premiums or changing ownership.",
      "Document final tax treatment, bookkeeping category, beneficiary, and plan documents.",
      "Review annually and after ownership, loan, employee, or business changes."
    ],
    documents: [
      "Policy application, declarations, illustrations, premium invoices, beneficiary forms, and assignment documents.",
      "Loan agreements, buy-sell agreements, operating/shareholder agreements, employment agreements, and board approvals.",
      "Bookkeeping entries, payroll treatment, compensation notes, and advisor memo.",
      "Annual policy statements and changes in ownership or beneficiary."
    ],
    timing: [
      "Review before the policy is purchased, assigned, used as collateral, or deducted.",
      "Update after ownership changes, new loans, buy-sell amendments, executive changes, or beneficiary changes.",
      "Confirm year-end bookkeeping before filing."
    ],
    caveats: [
      "IRS Publication 334 says premiums on life insurance, endowment contracts, or annuity contracts generally are not deductible if the taxpayer is directly or indirectly a beneficiary.",
      "Loan-protection life insurance premiums are not deductible as business expense or loan interest when the taxpayer is a beneficiary.",
      "Insurance planning can involve tax, legal, ERISA, estate, compensation, securities, and state insurance issues."
    ],
    mistakes: [
      "Deducting premiums because the business paid them.",
      "Ignoring indirect beneficiary status.",
      "Using policy illustrations as tax advice.",
      "Not coordinating buy-sell, lender, payroll, and bookkeeping treatment.",
      "Failing to update beneficiary and ownership records."
    ],
    review: [
      "Shona/Jay must review tax treatment before premiums are deducted or booked.",
      "Insurance, legal, estate, and benefits professionals should review policy design and documents.",
      "Do not implement insurance-based planning from this page alone."
    ],
    checklist: [
      "Policy purpose documented.",
      "Owner, insured, beneficiary, payer, and indirect beneficiary facts mapped.",
      "Loan/buy-sell/employment documents gathered.",
      "Tax treatment reviewed before deduction.",
      "Bookkeeping category confirmed.",
      "Annual review scheduled."
    ],
    sources: [
      ["IRS Publication 334, insurance premium rules", "https://www.irs.gov/publications/p334"],
      ["IRS guide to business expense resources", "https://www.irs.gov/forms-pubs/guide-to-business-expense-resources"]
    ]
  },
  {
    title: "Capital Asset Expensing and Bonus Depreciation Review",
    slug: "capital-asset-expensing-and-bonus-depreciation-review",
    strategyKey: "capital-asset-expensing-bonus-depreciation",
    summary: "Use this page before buying, placing in service, financing, or deducting equipment, vehicles, qualified property, or large business assets under Section 179, bonus depreciation, or regular depreciation rules.",
    overview: "Capital purchases can create timing deductions through Section 179, bonus depreciation, qualified production property rules, or regular depreciation. The decision depends on property type, placed-in-service date, business use, taxable income, financing, listed property rules, state conformity, depreciation recapture, and current IRS guidance. This page is the current-law review packet for Jay's bonus-depreciation and first-year write-off examples.",
    applies: [
      "Businesses considering equipment, machinery, furniture, vehicles, technology, production property, or major improvements.",
      "Clients deciding whether to buy before year-end, finance a purchase, or elect Section 179/bonus depreciation.",
      "Clients with real estate improvements, listed property, vehicles, or mixed-use assets.",
      "Clients who need to compare cash flow, deduction timing, and state treatment before purchase."
    ],
    notFit: [
      "Personal assets or assets not used in the trade or business.",
      "Assets not placed in service during the tax year under review.",
      "Vehicles or listed property without business-use logs.",
      "Purchases made only for a deduction without cash-flow, financing, business-purpose, and recapture review."
    ],
    inputs: [
      "Asset description, vendor quote, invoice, financing terms, purchase date, placed-in-service date, and business purpose.",
      "Business-use percentage, mileage or usage logs, location, serial numbers, and owner/entity paying for the asset.",
      "Current-year taxable income projection, prior depreciation schedule, state, and expected disposition timeline.",
      "Whether the asset is vehicle/listed property, qualified production property, real estate component, improvement, software, or ordinary equipment."
    ],
    workflow: [
      "Identify the property and confirm it is a business asset with a real business purpose.",
      "Confirm purchase, financing, and placed-in-service dates.",
      "Classify the asset for depreciation, Section 179, bonus depreciation, listed property, vehicle limits, qualified improvement, or qualified production property review.",
      "Model deduction timing, taxable income limits, state conformity, cash-flow effect, and future recapture.",
      "Send the packet to Shona/Jay before relying on first-year deduction treatment.",
      "After approval, save invoices, proof of payment, financing, placed-in-service support, and depreciation workpapers."
    ],
    documents: [
      "Quotes, invoices, receipts, purchase contracts, financing documents, serial numbers, and proof of payment.",
      "Placed-in-service evidence, photos, setup records, usage logs, mileage logs, and business-purpose notes.",
      "Prior depreciation schedule, asset ledger, current-year projection, and state conformity notes.",
      "Disposal, trade-in, sale, or conversion-to-personal-use records when applicable."
    ],
    timing: [
      "Review before purchase when the decision is tax-motivated.",
      "Placed-in-service timing matters; ordering or paying is not always enough.",
      "Year-end purchases need enough time for delivery, installation, business use, and recordkeeping.",
      "Review again before sale, trade-in, or personal conversion."
    ],
    caveats: [
      "IRS 2026 guidance describes permanent 100% additional first-year depreciation for eligible property acquired after January 19, 2025, but eligibility still depends on property type and facts.",
      "For 2026, IRS Publication 946 lists a Section 179 maximum deduction of $2,560,000 with phase-out after $4,090,000 of qualifying property, subject to detailed limits.",
      "Vehicles, listed property, real estate, state conformity, taxable income, and recapture rules can materially change the result.",
      "Do not use transcript percentages or examples without current-year review."
    ],
    mistakes: [
      "Buying assets the business does not need just to create a deduction.",
      "Missing placed-in-service support.",
      "Ignoring business-use percentage and vehicle/listed property limits.",
      "Assuming federal bonus depreciation matches state treatment.",
      "Forgetting recapture when an asset is sold or converted to personal use."
    ],
    review: [
      "Shona/Jay must review high-dollar purchases, vehicles, real estate-related assets, mixed-use assets, and year-end purchases before deduction treatment is assumed.",
      "Escalate when financing, entity ownership, state conformity, taxable income limits, cost segregation, or recapture matters.",
      "Do not claim Section 179, bonus depreciation, or qualified production property treatment from this page alone."
    ],
    checklist: [
      "Asset and business purpose documented.",
      "Placed-in-service date supported.",
      "Business-use logs started where required.",
      "Taxable income/cash-flow model prepared.",
      "State and recapture review completed.",
      "Advisor review gate cleared before filing."
    ],
    sources: [
      ["IRS Publication 946", "https://www.irs.gov/publications/p946"],
      ["IRS Notice 2026-11 on additional first-year depreciation", "https://www.irs.gov/pub/irs-drop/n-26-11.pdf"],
      ["IRS OBBB provisions", "https://www.irs.gov/newsroom/one-big-beautiful-bill-provisions"]
    ]
  }
];

await main();

async function main() {
  mkdirSync(generatedDir, { recursive: true });
  const manifest = {
    runId,
    mode,
    tenantId,
    database,
    bucket,
    startedAt: new Date().toISOString(),
    completedAt: null,
    pages: []
  };
  for (const page of pages) {
    const markdown = markdownFor(page);
    const asset = worksheetAssetFor(page);
    writeDocx(asset.filePath, asset.title, worksheetSections(page));
    manifest.pages.push({
      title: page.title,
      slug: page.slug,
      strategyKey: page.strategyKey,
      markdownBytes: Buffer.byteLength(markdown, "utf8"),
      worksheet: {
        title: asset.title,
        filename: asset.filename,
        r2Key: asset.r2Key
      },
      sources: page.sources.map((source) => source[1])
    });
  }
  writeManifest(manifest);
  if (mode === "dry-run") {
    console.log(`Dry run complete. Planned ${pages.length} pages and ${pages.length} worksheets.`);
    console.log(`Manifest: ${join(runDir, "manifest.json")}`);
    return;
  }

  for (const page of pages) {
    applyPage(page);
  }
  manifest.completedAt = new Date().toISOString();
  manifest.status = "applied";
  writeManifest(manifest);
  validateApplied();
  console.log(`Applied ${pages.length} advanced Tax Game pages and worksheets.`);
  console.log(`Manifest: ${join(runDir, "manifest.json")}`);
}

function applyPage(page) {
  const markdown = markdownFor(page);
  const sourceId = stableId("src", `advanced-source:${page.slug}`);
  const wikiId = stableId("wiki", `advanced-wiki:${page.slug}`);
  const contentHash = sha256(markdown);
  const versionHash = sha256(`${tenantId}:${page.title}:${contentHash}`);
  const now = new Date().toISOString();
  const rawKey = `raw/${tenantId}/${sourceId}/${contentHash}.md`;
  const existing = d1Json(`SELECT id, source_id FROM wiki_pages WHERE tenant_id=${q(tenantId)} AND slug=${q(page.slug)} ORDER BY updated_at DESC LIMIT 1`)[0];
  const effectiveWikiId = existing?.id || wikiId;
  const effectiveSourceId = existing?.source_id || sourceId;
  const effectiveCompiledKey = `compiled/pages/${tenantId}/${effectiveWikiId}/${contentHash}.md`;

  writeFileSync(join(runDir, `${page.slug}.md`), markdown);
  putR2(rawKey, join(runDir, `${page.slug}.md`));
  putR2(effectiveCompiledKey, join(runDir, `${page.slug}.md`));

  d1Json(`
    INSERT INTO source_documents (
      id, tenant_id, title, source_type, r2_key, normalized_r2_key, content_hash, version_hash,
      status, visibility, visibility_tier, strategy_key, effective_year, audience, review_owner,
      error_message, created_at, updated_at
    ) VALUES (
      ${q(effectiveSourceId)}, ${q(tenantId)}, ${q(`Advanced Tax Game Source: ${page.title}`)}, 'strategy_doc',
      ${q(rawKey)}, ${q(rawKey)}, ${q(contentHash)}, ${q(versionHash)}, 'published', 'client', 'all',
      ${q(page.strategyKey)}, '2026', 'clients', 'Shona Bell', NULL, ${q(now)}, ${q(now)}
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      source_type=excluded.source_type,
      r2_key=excluded.r2_key,
      normalized_r2_key=excluded.normalized_r2_key,
      content_hash=excluded.content_hash,
      version_hash=excluded.version_hash,
      status=excluded.status,
      visibility=excluded.visibility,
      visibility_tier=excluded.visibility_tier,
      strategy_key=excluded.strategy_key,
      effective_year=excluded.effective_year,
      audience=excluded.audience,
      review_owner=excluded.review_owner,
      error_message=NULL,
      updated_at=excluded.updated_at
  `);

  if (existing) {
    d1Json(`
      UPDATE wiki_pages
      SET source_id=${q(effectiveSourceId)},
          title=${q(page.title)},
          summary=${q(page.summary)},
          compiled_r2_key=${q(effectiveCompiledKey)},
          status='published',
          visibility='client',
          visibility_tier='all',
          strategy_key=${q(page.strategyKey)},
          effective_year='2026',
          approved_by='codex-production-script',
          approved_at=${q(now)},
          published_at=COALESCE(published_at, ${q(now)}),
          version_hash=${q(contentHash)},
          updated_at=${q(now)}
      WHERE id=${q(effectiveWikiId)} AND tenant_id=${q(tenantId)}
    `);
  } else {
    d1Json(`
      INSERT INTO wiki_pages (
        id, tenant_id, source_id, slug, title, summary, compiled_r2_key, status, visibility,
        visibility_tier, strategy_key, effective_year, approved_by, approved_at, published_at,
        version_hash, created_at, updated_at
      ) VALUES (
        ${q(effectiveWikiId)}, ${q(tenantId)}, ${q(effectiveSourceId)}, ${q(page.slug)}, ${q(page.title)},
        ${q(page.summary)}, ${q(effectiveCompiledKey)}, 'published', 'client', 'all', ${q(page.strategyKey)},
        '2026', 'codex-production-script', ${q(now)}, ${q(now)}, ${q(contentHash)}, ${q(now)}, ${q(now)}
      )
    `);
  }

  d1Json(`DELETE FROM knowledge_chunks WHERE tenant_id=${q(tenantId)} AND wiki_page_id=${q(effectiveWikiId)}`);
  chunkMarkdown(markdown).forEach((chunk, index) => {
    const chunkId = stableId("chunk", `${page.slug}:${contentHash}:${index}`);
    const citation = {
      sourceId: effectiveSourceId,
      sourceTitle: page.title,
      sourceType: "strategy_doc",
      wikiPageId: effectiveWikiId,
      quoteSpan: chunk.slice(0, 220),
      timestamp: `advanced page section ${index + 1}`,
      clientVisibleUrl: `/learn/${page.slug}`,
      confidence: 0.88
    };
    d1Json(`
      INSERT INTO knowledge_chunks (
        id, tenant_id, wiki_page_id, source_id, vector_id, corpus, chunk_index, text, citation_json,
        published, visibility, visibility_tier, source_type, strategy_key, effective_year,
        requires_review, content_version, created_at
      ) VALUES (
        ${q(chunkId)}, ${q(tenantId)}, ${q(effectiveWikiId)}, ${q(effectiveSourceId)}, ${q(`vector_${chunkId}`)},
        'wiki_chunks', ${index}, ${q(chunk)}, ${q(JSON.stringify(citation))}, 1, 'client', 'all',
        'strategy_doc', ${q(page.strategyKey)}, '2026', 1, ${q(contentHash)}, ${q(now)}
      )
    `);
  });

  const asset = worksheetAssetFor(page);
  putR2(asset.r2Key, asset.filePath);
  upsertAsset(asset, now);
  audit("source.ingest", "source", effectiveSourceId, { page: page.slug, directProductionScript: true });
  audit("wiki.publish", "wiki_page", effectiveWikiId, { sourceId: effectiveSourceId, directProductionScript: true });
  console.log(`Published ${page.title}`);
}

function upsertAsset(asset, now) {
  d1Json(`
    INSERT INTO download_assets (
      id, tenant_id, title, description, filename, mime_type, r2_key, strategy_key,
      linked_slug, status, visibility_tier, sort_order, created_at, updated_at
    ) VALUES (
      ${q(asset.id)}, ${q(tenantId)}, ${q(asset.title)}, ${q(asset.description)}, ${q(asset.filename)}, ${q(asset.mimeType)},
      ${q(asset.r2Key)}, ${q(asset.strategyKey)}, ${q(asset.linkedSlug)}, 'published', 'all', 0, ${q(now)}, ${q(now)}
    )
    ON CONFLICT(tenant_id, r2_key) DO UPDATE SET
      title=excluded.title,
      description=excluded.description,
      filename=excluded.filename,
      mime_type=excluded.mime_type,
      strategy_key=excluded.strategy_key,
      linked_slug=excluded.linked_slug,
      status=excluded.status,
      visibility_tier=excluded.visibility_tier,
      updated_at=excluded.updated_at
  `);
}

function validateApplied() {
  const slugs = pages.map((page) => q(page.slug)).join(", ");
  const pageRows = d1Json(`
    SELECT w.slug, w.title, COUNT(a.id) AS assets
    FROM wiki_pages w
    LEFT JOIN download_assets a ON a.tenant_id=w.tenant_id AND a.linked_slug=w.slug AND a.status='published'
    WHERE w.tenant_id=${q(tenantId)} AND w.slug IN (${slugs}) AND w.status='published'
    GROUP BY w.id
    ORDER BY w.title
  `);
  if (pageRows.length !== pages.length) {
    throw new Error(`Expected ${pages.length} published pages, found ${pageRows.length}`);
  }
  const missingAssets = pageRows.filter((row) => Number(row.assets) < 1);
  if (missingAssets.length) {
    throw new Error(`Missing worksheet assets: ${missingAssets.map((row) => row.title).join(", ")}`);
  }
  const chunkRows = d1Json(`
    SELECT w.slug, COUNT(k.id) AS chunks
    FROM wiki_pages w
    LEFT JOIN knowledge_chunks k ON k.tenant_id=w.tenant_id AND k.wiki_page_id=w.id AND k.published=1
    WHERE w.tenant_id=${q(tenantId)} AND w.slug IN (${slugs})
    GROUP BY w.id
  `);
  const missingChunks = chunkRows.filter((row) => Number(row.chunks) < 1);
  if (missingChunks.length) {
    throw new Error(`Missing published chunks: ${missingChunks.map((row) => row.slug).join(", ")}`);
  }
}

function markdownFor(page) {
  return `# ${page.title}

${page.summary}

## Strategy Overview

${page.overview}

## Who the strategy applies to

${bullets(page.applies)}

## Who should not implement without review

${bullets(page.notFit)}

## Required client inputs

${bullets(page.inputs)}

## Step-by-step implementation workflow

${numbered(page.workflow)}

## Required documents and records

${bullets(page.documents)}

## Timing and deadlines

${bullets(page.timing)}

## Entity/payroll/state/federal/current-year caveats

${bullets(page.caveats)}

## Common mistakes

${bullets(page.mistakes)}

## Advisor review gates

${bullets(page.review)}

## Completion checklist

${bullets(page.checklist)}

## Related downloads/templates/worksheets

- ${page.title} Implementation Worksheet

## Official sources and admin notes

${page.sources.map(([label, url]) => `- ${label}: ${url}`).join("\n")}

## Before You Act

This page is an implementation playbook for gathering facts and preparing an advisor review packet. Do not treat it as personalized tax, legal, payroll, benefits, investment, or insurance advice. Do not file, elect, reimburse, run payroll, buy/sell assets, adopt plans, claim credits, deduct premiums, issue stock, or make payments based on this page alone. Shona/Jay must confirm the strategy fits the client's facts before deployment.
`;
}

function worksheetSections(page) {
  return [
    ["Client facts", ["Client name", "Tax year", "Entity type", "State(s)", "Owner(s)", "Strategy question", "Target implementation date"]],
    ["Required inputs", page.inputs.slice(0, 6)],
    ["Records to attach", page.documents.slice(0, 6)],
    ["Advisor review gate", page.review.slice(0, 6)],
    ["Completion notes", page.checklist.slice(0, 6)]
  ];
}

function worksheetAssetFor(page) {
  const filename = `${page.slug}-implementation-worksheet.docx`;
  const r2Key = `assets/${tenantId}/${page.strategyKey}/${filename}`;
  return {
    id: stableId("asset", r2Key),
    title: `${page.title} Implementation Worksheet`,
    description: "Client fact-gathering worksheet and advisor review checklist for the related advanced Tax Game wiki lesson.",
    filename,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filePath: join(generatedDir, filename),
    strategyKey: page.strategyKey,
    linkedSlug: page.slug,
    r2Key
  };
}

function chunkMarkdown(markdown) {
  const sections = markdown.split(/\n(?=## )/g);
  const chunks = [];
  let current = "";
  for (const section of sections) {
    if ((current + "\n\n" + section).length > 1800 && current) {
      chunks.push(current.trim());
      current = section;
    } else {
      current = current ? `${current}\n\n${section}` : section;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function writeDocx(filePath, title, sections) {
  const temp = makeTempDir("docx");
  mkdirSync(join(temp, "_rels"), { recursive: true });
  mkdirSync(join(temp, "word"), { recursive: true });
  writeFileSync(join(temp, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  writeFileSync(join(temp, "_rels/.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  const body = [
    paragraph(title, true),
    paragraph("Beyond Freedom Financial client worksheet. Complete the facts, attach support, and bring client-specific decisions to Shona/Jay before acting."),
    ...sections.flatMap(([heading, items]) => [paragraph(heading, true), ...items.map((item) => paragraph(`□ ${item}`))])
  ].join("");
  writeFileSync(join(temp, "word/document.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  zipFolder(temp, filePath);
  rmSync(temp, { recursive: true, force: true });
}

function paragraph(text, bold = false) {
  const run = bold ? `<w:r><w:rPr><w:b/></w:rPr><w:t>${xml(text)}</w:t></w:r>` : `<w:r><w:t>${xml(text)}</w:t></w:r>`;
  return `<w:p>${run}</w:p>`;
}

function zipFolder(folder, output) {
  mkdirSync(dirname(output), { recursive: true });
  execFileSync("zip", ["-qr", output, "."], { cwd: folder });
}

function makeTempDir(prefix) {
  const dir = resolve(tmpdir(), `ask-shona-${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function putR2(r2Key, filePath) {
  wrangler(["r2", "object", "put", `${bucket}/${r2Key}`, "--file", filePath, "--remote"]);
}

function d1Json(sql) {
  const output = wrangler(["d1", "execute", database, "--remote", "--command", sql, "--json"]);
  const parsed = JSON.parse(output);
  return parsed.flatMap((item) => item.results || []);
}

function audit(action, targetType, targetId, metadata = {}) {
  d1Json(`
    INSERT INTO audit_events (id, tenant_id, actor, action, target_type, target_id, metadata_json, created_at)
    VALUES (${q(stableId("audit", `${action}:${targetId}:${Date.now()}`))}, ${q(tenantId)}, 'codex-production-script', ${q(action)}, ${q(targetType)}, ${q(targetId)}, ${q(JSON.stringify(metadata))}, ${q(new Date().toISOString())})
  `);
}

function writeManifest(manifest) {
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function bullets(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function numbered(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function stableId(prefix, input) {
  return `${prefix}_${createHash("sha1").update(input).digest("hex").slice(0, 24)}`;
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function xml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 20
  });
}
