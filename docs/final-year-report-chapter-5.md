# CHAPTER FIVE: DESIGN AND METHODOLOGY

_Working draft. The descriptions in this chapter are based on the current SAT-J Ent source code, database migrations and technical documentation. Placeholders identify diagrams and screenshots to add or capture. Only include images that correspond to the final version being evaluated._

## 5.1 Project Design Approach

SAT-J Ent is designed as a web-based management system for SAT-J, a building-materials retailer and distributor with three branches. The design brings related business operations into one application while keeping each feature area understandable and maintainable. Rather than building separate applications for inventory, purchases, sales and transfers, the project uses a modular monolith: one Next.js application contains distinct feature modules and a shared PostgreSQL database supports the business records and transaction rules.

The design is incremental. The repository documents phases that introduced identity and access, the product master, inventory, purchasing, sales, daily sales batches, reporting, transfers and finance. This approach allows later workflows to reuse existing product, branch, permission and inventory structures. It also reduces the need to duplicate business records across separate services. The design is informed by the SME digitalisation literature, which treats transformation as a combination of technology, process and organisational change, and recommends aligning implementation with the organisation’s context and capacity (Ben Slimane, Coeurderoy and Mhenni, 2022; Sagala and Őri, 2024).

The project prioritises correctness at business boundaries. User-interface validation helps staff enter complete information, server-side checks verify identity and permissions, and database constraints and transaction functions protect critical data. This is especially important for stock, where purchase receipt, sale completion, stock count and transfer events must update the record consistently. Secure development guidance similarly recommends addressing security requirements throughout the lifecycle (Scarfone, Souppaya and Dodson, 2022).

**[IMAGE PLACEHOLDER 5.1: SAT-J Ent high-level system architecture diagram]**

_Suggested contents: employee browser; Next.js application (App Router, server-rendered pages and server actions); Supabase authentication; PostgreSQL database with RLS and transactional functions; private storage; and the optional public projection surface, marked “disabled by default”. Show the browser connecting over HTTPS where appropriate. Do not include secrets or real project credentials._

## 5.2 System Architecture

The platform is organised into presentation, application, data and supporting-service responsibilities. These are logical responsibilities within the same deployed application, not separate microservices.

### 5.2.1 Presentation Layer

The presentation layer consists of Next.js App Router pages, layouts and React components. Internal management screens are located under `/app/**` and use a shared authenticated shell. Server Components are preferred for reading and rendering data. Client Components are used where browser interaction, local state, forms or other client-side behaviour is needed. The interface includes operational pages for products, inventory, purchases, sales, daily sales, transfers, expenses, finance and reporting.

Navigation and dashboard content are permission-aware, so users are shown functions relevant to their access. This improves the interface but is not relied on as the security boundary; server and database checks still verify every sensitive operation. The public catalogue and enquiry routes are separate from the authenticated portal and are disabled by default in the current environment.

**[IMAGE PLACEHOLDER 5.2: Authenticated SAT-J Ent dashboard screenshot]**

_Capture from the final system with test data only. Hide email addresses, phone numbers, business-sensitive figures, branch records and credentials. Include device size and environment in the caption._

### 5.2.2 Application Layer

The application layer coordinates routes, feature logic, form validation and trusted server-side access. Feature folders group implementation by business area, for example inventory, purchasing, sales, transfers, finance and catalogue. This keeps workflow-specific code close to its feature and avoids a generic layer that would obscure the business rules.

Server actions and data loaders obtain the current employee context, check permissions and validate submitted values. Zod schemas are used for validation, while React Hook Form supports interactive forms. The application uses Supabase’s server-side client for authenticated database access. Service-role access is reserved for explicit Auth administration/bootstrap functions; it is not used as a general shortcut around database policies.

### 5.2.3 Data Layer

Supabase provides the platform integration for PostgreSQL, authentication and storage. PostgreSQL is the authoritative data layer. Relational entities represent employees, roles, permissions, branches, products, variants, prices, suppliers, purchase documents, sales, payments, inventory balances, stock movements, transfers, expenses, financial accounts and reporting structures.

Database row-level security limits access to records according to the authenticated user’s permissions and branch scope. Sensitive business operations use controlled database functions where multiple changes must succeed or fail together. PostgreSQL documentation describes row security policies as restrictions on which rows may be selected or modified by a user (PostgreSQL Global Development Group, n.d.). This is relevant to SAT-J because the platform serves a company with three branches and role-specific access.

**[IMAGE PLACEHOLDER 5.3: Entity-relationship diagram (ERD)]**

_Suggested diagram: show core entities and relationships only, grouped into Identity & Branches, Product Master, Inventory, Purchasing, Sales, Transfers, and Finance. Include primary and foreign key relationships and the branch/product-variant inventory relationship. Do not attempt to show every audit or reporting view in one crowded image; use a simplified overview plus detailed diagrams if needed._

### 5.2.4 Offline Layer

The current SAT-J Ent implementation does not include an offline transaction queue, service-worker transaction store or later synchronisation workflow. Operational routes use server-backed authentication and database operations. Therefore, internet connectivity is required for these workflows. Offline-first operation is outside the current system scope and must not be presented as an implemented layer. If it becomes a future requirement, the design will need explicit policies for cached data, duplicate submissions, stock conflicts, synchronization, device loss and auditability.

### 5.2.5 External Services

The system uses Supabase Auth for employee identity and session handling, and Supabase Storage for controlled image or receipt-related storage paths. The application also includes public-site functionality in the codebase, but it is disabled by default at present. The current project materials do not establish a live payment-gateway integration; recorded payment methods and financial account movements should not be described as online payment processing.

**[IMAGE PLACEHOLDER 5.4: System context diagram showing external services]**

_Show only verified integrations, such as employee browser, Supabase Auth, PostgreSQL and Storage. Add a payment service only if a real integration exists in the final project version._

## 5.3 Database Design

The database design is relational and keeps product identity separate from sellable product configurations. Products contain shared descriptive information, while product variants represent operational units such as a specific size, colour or sellable configuration. Variant item codes are used for lookup, and prices are effective-dated so that past transaction snapshots are not recalculated using a later price.

Inventory is tracked by branch and product variant. A current branch balance supports queries, while stock movement records explain how the balance changed. Movements are created by approved workflows such as opening stock, adjustment, count reconciliation, purchase receipt, sale, reversal and transfer. Company stock totals are derived from branch data rather than treated as a separate editable balance. Quantities use precise decimal storage, and units that do not permit fractions reject fractional quantities.

Purchasing, sales, daily sales batches and transfers use document and item structures. Draft documents can be edited within their lifecycle, but posting is controlled. For example, ordering a purchase does not change inventory; receipt of goods posts a GRN and stock movement atomically. Completing a sale reduces stock and records associated payment/receivable state in the completion workflow. A transfer dispatch reduces source stock, while destination stock increases only after confirmed receipt. In-transit quantity is derived from dispatched less received quantity.

Financial records distinguish operational events such as sales revenue, customer collections, supplier payments, expense payments and account movements. The reporting design preserves these distinctions. Where historical stock cost cannot be established, the system marks valuation or profitability as incomplete instead of substituting an unsupported estimate. This principle improves the honesty of reports, even though it means some historic information may remain unknown.

Database changes are introduced through timestamped migrations. Deployed migration history is intended to be append-only, so later corrections are made with a new migration rather than editing a migration already applied to a shared environment. This makes schema changes reviewable and reproducible.

**[IMAGE PLACEHOLDER 5.5: Detailed inventory and stock-movement ERD]**

_Suggested entities: branches, products, product_variants, branch_inventory, stock_movements, inventory adjustments/counts, purchase receipts, sales/daily sales batches, and transfer documents. Mark stock_movements as historical evidence and branch_inventory as the current query balance._

## 5.4 Use of Modelling Tools

Modelling is used to make structure and behaviour easier to communicate. The final report should include diagrams that are consistent with the implemented application and the requirement set in Chapter Four. Suitable diagrams include a system context diagram, use-case diagram, entity-relationship diagram and workflow/activity diagrams for transactions that affect stock.

The codebase and timestamped SQL migrations provide the primary technical evidence for the data model and workflows. If UML or ERD diagrams were not produced during development, diagrams may be prepared for this report based on the final implementation, but they should be labelled as documentation created retrospectively rather than as design artefacts used to guide the original implementation.

### 5.4.1 Structural Model

The structural model should show the main application modules and the relationships between core business entities. At the highest level, the user identity and role connect to permission and branch assignment data; product records connect to variants; inventory balances connect a branch to a variant; and transaction documents refer to branches, employees, customers/suppliers and product variants as applicable.

**[IMAGE PLACEHOLDER 5.6: UML component diagram or module map]**

_Show the Next.js application and its feature modules, Supabase services, PostgreSQL, and storage. If a component diagram is not required by the department, a clear architecture diagram in Section 5.2 can fulfil this purpose._

### 5.4.2 Behavioural Models

Behavioural models describe how a business operation changes state. The following lifecycle examples are based on the documented implementation:

- **Purchase:** Draft → Ordered → Partially Received → Received, with eligible cancellation before receipt.
- **Sale:** Draft → Completed, or Draft → Cancelled; an erroneous completed sale may be corrected through a controlled cancellation/reversal workflow.
- **Daily sales batch:** Draft → Posted; an authorised reversal retains the original record and can be followed by a linked correction batch.
- **Transfer:** Draft → Requested → Approved → Dispatched → Received, with cancellation available only before dispatch.

**[IMAGE PLACEHOLDER 5.7: Purchase receiving activity or sequence diagram]**

_Suggested sequence: employee submits receipt; application checks identity/permission and validates inputs; database locks the purchase and inventory rows; receipt and stock movement are created; purchase/stock state commits together; application returns confirmation. Add an error path showing rollback if validation or stock posting fails._

**[IMAGE PLACEHOLDER 5.8: Inter-branch transfer state diagram]**

_Show the documented transfer states. Indicate that source stock decreases at dispatch and destination stock increases at receipt; transit is derived between those events. Label which branch access is needed for source and destination actions._

## 5.5 User Interface Design

The interface design separates public pages from the employee management portal. The internal portal uses a shared layout and navigation, while operational pages present task-specific tables, forms, filters and status messages. The dashboard provides date and branch filters within the user’s authorised scope. Role-aware navigation helps employees locate permitted tasks, and explicit no-data or loading states support understanding when reports or lists are empty or still loading.

Forms are designed around the relevant business workflow. Product lookup can search by item code or descriptive information. Purchase receiving focuses on outstanding quantities and receipt details. Sales workflows distinguish draft from completed transactions, and daily sales batches distinguish a sales total from an individual customer payment. Transfer screens expose separate dispatch and receipt actions. These distinctions are important because they represent different business events and permissions.

Responsive design is part of the application, with layouts adapting to smaller screens and navigation supporting mobile interaction. Accessibility-related implementation notes include keyboard behaviour, labels, touch targets and status announcements. However, these design intentions do not establish full accessibility compliance; the final evaluation should report the specific checks performed and any limitations.

**[IMAGE PLACEHOLDER 5.9: Product and inventory user-interface screenshots]**

_Insert screenshots from the final version. Recommended views: product search by Item Code and branch inventory detail. Use seeded/test records, crop out browser credentials and avoid real customer or employee data._

**[IMAGE PLACEHOLDER 5.10: Purchase receiving and transfer user-interface screenshots]**

_Recommended views: a purchase awaiting receipt, receipt form, transfer detail before dispatch, and transfer detail awaiting destination receipt. Include clear captions and state the role used._

**[IMAGE PLACEHOLDER 5.11: Mobile responsive interface screenshot]**

_Capture a representative dashboard or operational page at a documented viewport width. Do not claim usability success from a screenshot alone._

## 5.6 Methodology for Requirements and Design Validation

Design validation should verify that the models and screens correspond to the approved requirements and that important edge cases have been considered. At the current draft stage, the repository provides code, project notes, migrations and automated test definitions. These can verify implementation structure and help identify technical rules, but they cannot establish that SAT-J stakeholders approved the design.

The proposed validation process is:

1. Review the requirements and priorities with the owner or an authorised business representative.
2. Walk through representative workflows: product setup, stock adjustment/count, purchase and goods receipt, sale, daily sales posting, transfer dispatch/receipt, and report review.
3. Confirm role and branch access for each workflow, including denied actions.
4. Compare each diagram with the final route structure, database schema and transaction rules.
5. Capture feedback and record accepted changes, unresolved issues and scope decisions.
6. Link requirements to automated tests and report the actual execution results in Chapter Seven.

If this validation has not yet taken place, the report should identify it as pending rather than claim that the design was approved. The NIST SSDF supports documenting security requirements and risks as part of software development (Scarfone, Souppaya and Dodson, 2022); in this project, access and transaction integrity should therefore appear in both the design artefacts and the test plan.

**[IMAGE PLACEHOLDER 5.12: Requirements-to-design traceability table or review evidence]**

_Insert a compact matrix or approved meeting/review evidence once available. Remove names or personal details where they are not needed._

## 5.7 Conclusion

This chapter has described SAT-J Ent’s design as a modular web application backed by a relational database. It explained the presentation, application, data and external-service responsibilities; the branch-aware and ledger-backed data model; and the state-based design of purchases, sales, daily sales batches and transfers. It also provided placeholders for architecture, ERD, workflow and interface diagrams or screenshots.

The central design principle is that user-interface checks support the user, while trusted application code and PostgreSQL enforce permissions and business integrity. Offline-first synchronisation and full accounting functionality are outside the current scope. Chapter Six will describe how the design is implemented in the source code and database workflows.

## References cited in Chapter Five

Ben Slimane, S., Coeurderoy, R. and Mhenni, H. (2022) ‘Digital transformation of small and medium enterprises: a systematic literature review and an integrative framework’, _International Studies of Management & Organization_, 52(2), pp. 96–120. Available at: https://doi.org/10.1080/00208825.2022.2072067.

PostgreSQL Global Development Group (n.d.) ‘Row Security Policies’. _PostgreSQL 17 Documentation_. Available at: https://www.postgresql.org/docs/17/ddl-rowsecurity.html (Accessed: 4 November 2026).

Sagala, G.H. and Őri, D. (2024) ‘Toward SMEs digital transformation success: a systematic literature review’, _Information Systems and e-Business Management_, 22, pp. 667–719. Available at: https://doi.org/10.1007/s10257-024-00682-2.

Scarfone, K., Souppaya, M. and Dodson, D. (2022) _Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities_. NIST Special Publication 800-218. National Institute of Standards and Technology. Available at: https://doi.org/10.6028/NIST.SP.800-218.

---

### Items to confirm before finalising this chapter

- Which design diagrams were created during development and which need to be created retrospectively for the report.
- Whether the system has been reviewed with SAT-J’s owner or staff, and the evidence of that review.
- Which final system environment and test data should be used for screenshots.
- Whether the department expects UML diagrams, DFDs, ERDs, wireframes or a particular modelling notation.
- Whether accessibility checks or usability evaluation have been conducted and what the evidence shows.
