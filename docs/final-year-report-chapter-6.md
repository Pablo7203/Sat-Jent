# CHAPTER SIX: DEVELOPMENT OF THE PRODUCT AND IDEAS

_Working draft. This chapter describes the current SAT-J Ent implementation based on source files, migrations and project audits. The implementation is not treated as proof of production deployment or full verification. Add screenshots from the final version in the labelled placeholders._

## 6.1 Development Plan

Development of SAT-J Ent followed an incremental plan. The repository groups the work into phases, beginning with the engineering foundation and employee access, followed by the product catalogue, inventory, purchasing, sales, reporting, transfers and finance. The application has been built as one Next.js system with feature-specific code, while PostgreSQL provides the authoritative business data and transactional rules.

This approach allowed later workflows to reuse earlier structures. For example, purchasing and sales use product variants and branch inventory; transfer workflows use the same stock movement logic; and reports use shared business records rather than separate spreadsheet totals. Requirements and changes are represented through feature code, timestamped database migrations and project documentation. The development process also includes automated unit, browser and database tests, although execution status varies by test suite and environment, as described in Chapter Seven.

The main technologies used are Next.js 16, React 19, TypeScript, Supabase, PostgreSQL, Tailwind CSS, React Hook Form and Zod. Vitest and Testing Library support unit/component tests, Playwright supports browser workflows, and Supabase database tests cover security and business rules. The project configuration specifies Node.js 22 and pnpm 10. These details should be checked against the exact release or commit selected for final evaluation.

**[IMAGE PLACEHOLDER 6.1: Development timeline or phase plan]**

_Suggested image: a Gantt chart or phase timeline showing discovery/requirements, architecture and schema, feature implementation, testing, documentation and evaluation. Use actual project dates if available; otherwise title it “Implementation phases” and avoid invented dates._

## 6.2 In-depth Analysis of the Development Context

SAT-J operates three branches, so the application needs to associate operational information with a location while preserving a shared company-level view for authorised roles. The product catalogue is company-wide, while inventory is held against a branch and sellable variant. Staff may have company-wide or branch-scoped roles, and operational access checks consider both permission and branch assignment.

The system’s architecture is a modular monolith. Route pages and feature folders are located in the Next.js application, while Supabase provides authentication and database connectivity. PostgreSQL holds the authoritative records and implements row-level security, constraints and transactional functions. This design keeps the system in a single deployable application while allowing feature areas to evolve coherently.

The business context also requires accurate distinctions between related events. A purchase order does not increase stock; posting a goods receipt does. A draft sale does not reduce stock; completing it does. A transfer decreases stock at dispatch and increases destination stock only at receipt. Daily sales batches record aggregated product/quantity/revenue information and are kept separate from individual customer payments and receivables. These workflow differences shaped implementation decisions and data modelling.

The application is online and server-backed. No offline transaction queue or synchronisation layer has been implemented. The public catalogue/enquiry code remains available in the repository but is disabled by default in the current configuration. The current report therefore focuses on the employee portal and records the operational scope as implemented, rather than describing planned or inactive functionality as live.

## 6.3 Data Used During Development

The system uses relational operational data for branches, employees, roles, permissions, products, variants, prices, suppliers, customers, purchases, receipts, sales, payments, stock movements, transfers, expenses, financial accounts and reports. Primary identifiers are UUIDs, while user-facing transaction references provide readable document numbers. Product variants provide the sellable identity used by transactions and stock records.

Inventory balances are associated with branch and product variant. Stock movement entries provide a traceable explanation for changes, including opening stock, adjustments, counts, purchase receipts, sales, reversals and transfer events. The database uses numeric types for quantity and money rather than relying on approximate floating-point values. Business timestamps are stored in UTC and displayed using Africa/Accra where required; business transaction dates follow workflow-specific validation rules.

Development and test data should be distinguished from SAT-J’s live business records. The repository includes seed and test fixtures, and database tests use controlled data to validate permissions and workflows. The audits also note that the local development database can contain accumulated records from previous runs; this can affect tests that assume a clean fixture state. No claim is made here that all records in the development environment are representative of the company’s current three-branch operations.

**[IMAGE PLACEHOLDER 6.2: Anonymised sample records or data-flow illustration]**

_Use synthetic data only, or obtain approval before using business records. Do not include actual customer names, phone numbers, payment references, supplier balances, employee details or credentials. A schema/data-flow illustration may be used instead of a data screenshot._

## 6.4 Implementation

### 6.4.1 Application Foundation and Security

The application uses the Next.js App Router to organise public, authentication and internal routes. Internal routes are grouped under `/app` and require an authenticated employee profile. The authorization layer verifies identity, profile status, role and permissions and provides accessible branch context. Server-side permission checks protect sensitive routes and operations. PostgreSQL row-level security repeats the relevant data restrictions at the database layer.

The system distinguishes company-scoped roles from branch-scoped roles. Branch-scoped staff need an active assignment to the branch involved in an operation. A branch value selected in the browser is treated as context for the request, not proof of authority. Private service-role credentials are reserved for explicit Auth administration/bootstrap operations and are not used to bypass ordinary data policies.

Migrations are timestamped and stored under `supabase/migrations`. This makes structural changes reviewable and preserves the sequence of database evolution. Important operations use database functions where transaction atomicity is needed, while the application layer performs input validation and provides the user workflow.

### 6.4.2 Products and Inventory

The product catalogue separates product descriptions from sellable variants. Variants have item codes and unit information, and effective-dated prices can be defined at company or branch scope. Product lookup supports search by item code and descriptive fields, then returns branch-scoped inventory information according to the current employee’s authority.

Inventory is updated through controlled workflows, including opening stock, adjustments, stock counts, goods receipt, sale completion and transfers. Direct application writes to stock balances and movement records are restricted. Movement functions validate user authority, branch, active records, quantity precision and non-negative stock; they lock relevant balances and update the movement ledger and current quantity in one transaction. Stock counts record a snapshot and calculate variance before reconciliation.

**[IMAGE PLACEHOLDER 6.3: Product lookup and branch inventory screenshot]**

_Show a test product search by Item Code and its inventory position at one of the three branches. Use synthetic records and identify the branch scope in the caption._

### 6.4.3 Purchasing and Goods Receiving

The purchasing module supports supplier records, purchase orders, partial or full goods receipts, and supplier payments. Purchase documents can be drafted and confirmed, but ordering does not post inventory. When goods arrive, an authorised user records received quantities and actual unit costs. The receiving workflow creates a goods receipt note and corresponding `PURCHASE_RECEIPT` movement in one database transaction. If a validation or stock-posting step fails, the transaction is intended to roll back as a whole.

Receipts retain historical cost information and connect the receipt to its purchase and supplier. The system distinguishes the supplier’s agreed purchase-order cost from the actual cost recorded at receipt. Historical receipts with unknown cost are not assigned an invented value. This is important to the later finance and profitability calculations.

**[IMAGE PLACEHOLDER 6.4: Purchase order and goods receipt screenshots]**

_Show a purchase awaiting goods and the receipt form/detail from the final version. Mask supplier-sensitive information unless approved._

### 6.4.4 Sales, Payments and Daily Sales Batches

The sales workflow supports customer selection, product lines, pricing, payment and receipt generation. Draft sales do not affect stock. Completing a sale validates its status, branch, customer/payment rules, price permissions and stock. Completion records the sale, stock movements, any initial payment, receivable state and audit information transactionally. Later payments and controlled reversals use separate workflows.

Daily sales batches address a different recording need. They capture product, quantity and revenue information where individual customer and payment details are not being entered for each transaction. Draft batches do not affect stock or revenue reports. Posting checks stock and creates the appropriate movement and revenue event. Posted batches are retained as history and can be reversed by authorised users with a correction reason. Batch revenue is not treated as cash collection or receivable because the batch does not record verified payment details.

**[IMAGE PLACEHOLDER 6.5: Individual sale completion and receipt screenshot]**

_Use a synthetic customer or Walk-In transaction in a test environment. Hide any real payment or contact information._

**[IMAGE PLACEHOLDER 6.6: Daily sales batch draft and posted status screenshots]**

_Show the difference between a draft and a posted batch, and include a caption explaining that posting affects inventory and sales reporting but does not assert a cash collection._

### 6.4.5 Inter-Branch Transfers

The transfer module records movement of products between branches through the documented lifecycle: Draft, Requested, Approved, Dispatched and Received. The source branch controls creation, approval and dispatch according to permission; receipt requires destination-branch access. The source balance decreases at dispatch. During transit, the quantity is derived from dispatched less received and is not counted as available stock at either branch. The destination balance increases when the receipt is confirmed.

Operation keys support idempotent retries, and the database locks transfer and inventory rows while posting movements. This is intended to prevent duplicate dispatch/receipt and partial multi-item updates. The current implementation supports full dispatch and full receipt; partial transfer handling is not included in the documented scope.

**[IMAGE PLACEHOLDER 6.7: Transfer lifecycle screenshots]**

_Show a transfer at dispatch and at destination receipt, using test records. Caption the source and destination branches and the state shown._

### 6.4.6 Expenses and Finance

The finance area includes branch financial accounts and append-only financial movements. Supported workflows include recording expenses, approval or rejection, partial or full payment, account selection, supplier payments, customer collections and account reconciliation entries. Account balances are derived from ledger movements rather than edited directly.

The finance report includes profitability information where the source costs support a complete calculation. When historical cost is missing or an event sequence is incomplete, the system marks profit as incomplete instead of estimating it from current prices. Documented future extensions include inter-account transfers, bank-statement import/matching, finance report exports and a receipt upload/view interaction on the expense page. These extensions are not described as completed features.

**[IMAGE PLACEHOLDER 6.8: Finance dashboard or expense workflow screenshot]**

_Use non-sensitive test data. If values are actual company finances, obtain explicit business approval and consider redaction before including them in an academic report._

### 6.4.7 Dashboard and Reporting

The dashboard and reporting area provides date and branch filters, operational metrics and detailed reports. Company-scoped roles can view permitted company or branch data, while branch-scoped roles are constrained to assigned locations. The reports distinguish sales revenue from customer collections, purchases from supplier payments, and current inventory status from historical period data. Quantities are grouped in ways that preserve unit meaning, rather than summing incompatible measures into a misleading total.

CSV export is available for permitted reports. The export route retains applicable filters and applies validation and spreadsheet-formula protection. Reporting measures are computed from secured database functions and views, rather than exposing unrestricted operational tables to the browser.

**[IMAGE PLACEHOLDER 6.9: Dashboard and detailed report screenshots]**

_Show a report date range and one branch filter. Use seeded/test data and label figures as illustrative if they are not live business values._

## 6.5 Challenges and Solutions

One key development challenge was maintaining consistency between inventory balances and the events that change them. Direct updates can make it difficult to explain how a quantity was reached. The implementation therefore uses a movement ledger and controlled database workflows, with row locks and transactions for critical operations. This supports traceability and prevents a failed multi-line operation from being partially posted.

A second challenge was separating business events that may appear similar in a simple interface. Sales revenue, customer collections and receivables are related but not interchangeable. Daily sales batches were therefore implemented separately from individual customer sales so that the system would not create fictional customers, receipts or payments. Reporting uses explicit source and date rules to avoid double-counting.

Branch access presents another challenge. A user-selected branch is not a trusted authorization decision, so access is checked in server code and repeated in database policies and functions. This reduces reliance on the interface alone and supports different company-level and branch-level employee roles.

Cost completeness is also a limitation. Some historical records do not contain sufficient evidence for a reliable cost basis. The finance logic preserves an explicit missing-cost state and withholds affected profitability results. This produces less complete reports for some periods, but avoids presenting unsupported estimates as accurate figures.

Finally, verification has been affected by environment and fixture constraints recorded in the project audits. Some focused checks passed, while some full-suite or build steps were blocked by process permissions, external font access, Supabase CLI telemetry-file permissions, or accumulated local test data. These results are recorded with their actual status in Chapter Seven and should not be simplified into a general claim that all tests passed.

## 6.6 Project Plan Adjustments

The project evolved from its initial feature phases into an owner-focused redevelopment. The current project documentation describes a focus on inventory, purchase receiving, branch performance, sales and finance, while preserving existing transaction records and architecture. The public website is disabled by default, and the system’s operational features remain the primary focus.

Additional implementation areas such as daily sales batches and inventory costing/finance were developed as distinct features because they required careful separation from individual customer sales and preservation of unknown historical costs. Some capabilities remain future work, including offline-first transaction capture, complete accounting extensions, receipt upload interaction, bank-statement import/matching and further operational reconciliation. The final report should describe these as limitations or recommendations unless later evidence demonstrates completion.

**[IMAGE PLACEHOLDER 6.10: Planned versus completed feature summary]**

_Suggested table or chart: feature area, planned scope, implemented status, verification status and remaining work. Base each status on the final commit and Chapter Seven evidence._

## 6.7 Conclusion

This chapter has described the implementation of SAT-J Ent as a web-based operational platform for a three-branch building-materials business. It covered access control, products, inventory, purchasing, goods receiving, sales, daily sales batches, inter-branch transfers, finance and reporting. The implementation uses controlled transaction workflows and a stock movement ledger to preserve operational history.

The system includes substantial functionality, but some areas remain outside the current scope or lack full verification. In particular, offline-first operation is not implemented, the public site is disabled by default, and the finance functions should not be represented as a complete accounting package. Chapter Seven will present the testing and evaluation evidence, including the checks that passed and those that remain incomplete.

## References cited in Chapter Six

No new external references are introduced in this chapter. The implementation descriptions are based on the SAT-J Ent source code, database migrations and project documentation. External literature relevant to the development approach is cited in Chapter Five.

---

### Items to confirm before finalising this chapter

- Select the exact code commit or release that the implementation chapter describes.
- Confirm whether screenshots should come from a local, staging or production environment.
- Confirm whether any business data is live, synthetic or anonymised before adding images.
- Add actual dates to the development timeline if they are documented.
- Confirm with the business which incomplete finance and public-site functions should be listed as future work.
