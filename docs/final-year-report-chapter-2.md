# CHAPTER TWO: UNDERSTANDING THE PROBLEM DOMAIN

_Working draft. Confirm the descriptions of SAT-J’s existing procedures with the business before presenting them as findings from interviews or observation. The system descriptions below are based on the repository and published vendor documentation reviewed on 4 November 2026._

## 2.1 Problem Identification and Investigation

SAT-J is a Ghanaian building-materials retailer and distributor with three branches. The business is moving towards the use of a web application to digitise its operations. As the business works across three locations, a key issue for the proposed system is to make business records more coordinated while still allowing access to be limited by employee role and branch. The project’s focus is therefore not simply to put existing paper forms on a screen; it is to support connected processes, such as receiving goods into stock, recording sales, transferring items between branches, and reviewing performance through reports.

The project repository indicates the operational areas that SAT-J Ent is intended to support. These include a shared product catalogue, branch-specific inventory, supplier purchasing and goods receiving, sales and payment records, daily sales batches, stock transfers, expenses, financial accounts, and management reporting. The database is designed to preserve stock movement history and apply transaction rules to important workflows. Employees are assigned roles and, where relevant, branch access. These features provide a technical foundation for digitising workflows, but they do not by themselves prove how SAT-J currently completes each task. A final account of the pre-existing business process should be supported by the owner’s confirmation, staff interviews, direct observation, or business records.

This distinction matters because a system should respond to the business’s real working conditions. The World Bank’s recent Ghana policy notes describe limited adoption of digital upgrades across some firm activities, even where businesses see potential benefits in areas such as online sales and payments (World Bank, 2025). Emuron et al. (2022), in a study of information-system appraisal and diffusion among Ghanaian SMEs, also emphasise that organisational and management considerations influence how such systems are adopted. For SAT-J, the three-branch structure makes product consistency, stock visibility, controlled transactions, and branch-aware reporting important areas to investigate.

The problem investigation for this report should therefore establish how products are currently identified, how stock is recorded at each of the three branches, how goods are ordered and received, how sales and payments are recorded, how stock transfers are handled, and what information management needs from reports. It should also identify which tasks are performed by different employee roles and where records or decisions currently depend on manual coordination. If no formal requirements study was conducted before or during development, this report will state that transparently and use a retrospective review with the business as a limitation or follow-up activity, rather than inventing interview findings.

## 2.2 Project Objectives and Planning

The project objectives set out in Chapter One follow the lifecycle of a software system: understanding the business need, defining requirements, reviewing relevant systems and literature, designing the solution, implementing it, and evaluating the result. This structure allows the report to connect the identified business problem to specific system functions and later to test evidence.

The implementation has been developed incrementally. The repository’s phase records describe work on employee identity and access, the product catalogue, inventory, purchasing, sales, daily sales batches, reporting, transfers, and finance. This staged approach has allowed the system to reuse existing business entities and workflows as capabilities were added. The underlying architecture remains a modular monolith: one Next.js application contains cohesive features, while PostgreSQL handles authoritative data and transaction logic. The design keeps related operations together without introducing separate services for each business area.

For planning and evaluation, the report will map each objective to evidence. For example, product and inventory requirements can be linked to the catalogue and stock ledger; purchase requirements to purchase orders and receipt workflows; branch movement requirements to transfer dispatch and receipt; and reporting requirements to the dashboard and report functions. The tests present in the project can then be linked to these requirements. The existence of a test file should not be reported as a successful test result unless an execution result is available for the relevant version of the system.

Project risks include incorrect or incomplete business requirements, inconsistent product information, errors in stock quantities, unauthorised cross-branch access, incomplete historical cost information, and insufficient evaluation with intended users. These risks are addressed through validation at multiple levels: input schemas in the application, constraints and transaction functions in the database, role and branch checks, audit records, and automated tests. NIST’s Secure Software Development Framework recommends integrating security practices into the software development lifecycle and tracking security requirements and risks during development (Scarfone, Souppaya and Dodson, 2022). This supports the project’s emphasis on checking access controls at both application and database boundaries.

## 2.3 Review of Similar Products/Systems

This section compares three existing products with functions related to SAT-J Ent. The comparison uses current vendor descriptions and documentation; it is a desk review, not the result of a hands-on trial. Since these products have different purposes and commercial models, the comparison is intended to identify relevant capabilities and design considerations rather than to declare one product universally better.

### 2.3.1 Loyverse POS

Loyverse provides point-of-sale, inventory and employee-management features. Its published feature list includes multiple locations, product variants, stock tracking, purchase orders, transfers, adjustments, inventory counts and reporting. It also states that sales can be processed offline and synchronised after connectivity returns (Loyverse, n.d.-a). Its help documentation explains limitations while offline: refunds, customer registration or editing, integrated card terminals, and current stock visibility are unavailable, and unsynchronised receipts remain on the device until a connection is restored (Loyverse, n.d.-b).

These features make Loyverse relevant to a comparison involving multi-location stock and sales. The offline behaviour also shows that “offline support” needs to be considered in terms of specific tasks, cached information and synchronisation risks. SAT-J Ent should not be described as providing this capability, because its current implementation is a server-backed web application and the project documents do not describe an offline transaction queue. Loyverse’s published scope is oriented around POS operation; SAT-J Ent’s current scope places particular emphasis on branch-aware stock control, purchasing and receipt workflows, transfers, finance and management reporting.

### 2.3.2 Odoo Point of Sale and Inventory

Odoo offers an integrated set of applications covering point of sale, inventory and other business functions. Its current documentation describes a browser-based POS that can continue selected functions during temporary network outages, with essential data cached in the browser and offline orders synchronised later. It also explains that some backend-dependent capabilities, including real-time stock synchronisation and payment terminals, are unavailable offline (Odoo, n.d.-a). Odoo documentation further describes product variants, stock tracking, employee access rights and synchronisation of stock across operations (Odoo, n.d.-b).

The main relevance of Odoo to SAT-J is its breadth of integration: product, sales, inventory and employee processes can be configured within one platform. That breadth can be an advantage where an organisation needs a broad suite, but it can also require configuration and staff training. This report does not make a claim about Odoo’s cost or suitability for SAT-J without a detailed assessment of licensing, deployment needs and user requirements. Compared with this general platform, SAT-J Ent is being tailored to the specific workflows and branch model of one existing business.

### 2.3.3 Hubtel Retailer

Hubtel Retailer is a Ghana-focused retailer application. Its current store listing describes tools for inventory and pricing updates, order management, team management, notifications and sales reports. The listing also refers to handling orders for offline customers, which should not be confused with full offline operation of the retailer application (Hubtel Limited, 2026). Hubtel’s public retail-partner information also describes order management and delivery support through its platform (Hubtel, n.d.).

Hubtel is relevant because it reflects a local digital-commerce context and provides features for retailers managing customer orders and stock. Its published information, however, does not establish that it supports SAT-J’s exact internal requirements, such as the project’s purchase-receipt cost handling, immutable branch stock ledger, transfer approval and receipt lifecycle, and finance controls. This is not a negative product assessment; it simply means those requirements would need to be checked directly if Hubtel were considered for adoption.

### 2.3.4 Summary of comparison

| System                 | Relevant published capabilities                                                                         | Considerations for SAT-J                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Loyverse POS           | Multi-location sales and inventory, stock adjustments, purchase and transfer functions, offline sales   | Offline mode has task-specific limitations, including lack of live stock visibility; the product is POS-oriented                |
| Odoo POS and Inventory | Integrated POS and inventory, product variants, employee access rights, selected offline POS operations | Broad application suite may require configuration and training; not assessed here for SAT-J’s licensing or deployment needs     |
| Hubtel Retailer        | Ghana-focused order management, inventory and pricing updates, staff management and sales reports       | Public descriptions do not establish support for all SAT-J internal purchasing, stock-ledger, transfer and finance requirements |
| SAT-J Ent              | Tailored branch-aware product, inventory, purchasing, sales, transfer, finance and reporting workflows  | Current public website is disabled by default; offline-first operation is not implemented or claimed                            |

The comparison suggests that existing products provide useful examples of integrated retail functions, but that requirements should be assessed against SAT-J’s own workflows. The most relevant design considerations for SAT-J Ent are consistent product identity across locations, controlled stock movements, traceable purchase receipts and transfers, separation of sales revenue from customer collections, and reports that respect branch access.

## 2.4 Critical Evaluation of Existing Literature

Recent evidence supports the view that digital business systems can help connect information and operational tasks, but adoption is not automatic. The World Bank’s 2025 policy notes show that digital improvements are recognised by some Ghanaian firms while uptake across business functions remains limited. This national-level evidence gives useful context but does not explain the day-to-day needs of a particular building-materials retailer (World Bank, 2025). Emuron et al. (2022) provide a Ghanaian SME perspective on appraisal and diffusion of information systems, but their study is not specific to building-materials inventory, multi-branch stock movements or the transaction workflows implemented in SAT-J Ent.

The vendor documentation reviewed in this chapter is useful for establishing what the compared systems claim to offer. It is less useful as independent evidence of performance, usability or suitability, because vendor pages are descriptive and may emphasise product strengths. A fair comparison therefore requires limiting statements to published features and acknowledging that no hands-on evaluation of the alternatives has been conducted for this project.

The project addresses a context-specific integration problem: the web application brings together product, stock, procurement, sales, transfer, financial and reporting functions for a business with three branches. Its technical documentation emphasises database-level constraints, permission checks, immutable stock movements and explicit transaction workflows. These are design choices that can be assessed against project requirements and test evidence. They do not establish business impact by themselves. Claims that the system has reduced errors, increased sales, saved time or improved customer satisfaction would require operational measurements or user-evaluation evidence.

Accordingly, the gap this project addresses is not that no retail-management software exists. Rather, it is the need to develop and document a system aligned with SAT-J’s specific business context, branch structure and required workflows, then evaluate how far the implemented system meets those needs. Further primary research with SAT-J staff would strengthen the account of the problem and provide evidence about usability and adoption.

## 2.5 Criteria for Development

The system is developed and evaluated against the following criteria:

1. **Functional suitability:** the system should support the defined workflows for products, inventory, purchasing, sales, transfers, expenses, finance and reporting.
2. **Data integrity:** stock and financial operations should follow controlled transactions, preserve historical records and prevent invalid or duplicate postings.
3. **Access control:** employee permissions and branch assignments should constrain access at both the application and database levels.
4. **Usability:** screens and forms should make routine tasks understandable and provide clear validation and status information. This criterion should be evaluated with actual user evidence where available.
5. **Reporting accuracy:** reports should use explicit metric definitions and business dates, distinguish revenue from collections, and avoid presenting unknown values as facts.
6. **Maintainability:** feature areas and database changes should be organised so that future changes can be made without rewriting unrelated business workflows.
7. **Reliability and recoverability:** transaction failures should not leave partial stock changes; backup and recovery arrangements should be considered before production use.
8. **Security:** credentials and sensitive operations should remain server-side, and security requirements should be considered throughout development (Scarfone, Souppaya and Dodson, 2022).

These criteria will be translated into measurable functional and non-functional requirements in Chapter Four. Where a criterion cannot be evaluated from existing automated evidence, it will be identified as requiring further evaluation rather than marked as satisfied without support.

## 2.6 Tools and Technologies Selected

SAT-J Ent uses Next.js 16 with the App Router, React 19 and TypeScript for its web application. Next.js provides the routing and rendering structure, while React supports interactive interface components. TypeScript is used to make data and component contracts more explicit during development. Tailwind CSS 4 is used for styling, and React Hook Form and Zod support form state and validation.

Supabase provides the managed platform connection to PostgreSQL, authentication and storage. PostgreSQL is the authoritative business datastore. The project uses relational tables, constraints, row-level security policies and controlled database functions to enforce branch access and important transaction workflows. PostgreSQL’s row security policies allow row visibility and data changes to be limited according to policy conditions (PostgreSQL Global Development Group, n.d.). This is relevant to a three-branch system where authorised users may have different data scopes.

The project also uses Vitest and Testing Library for unit and component testing, Playwright for browser-based end-to-end tests, and database tests for workflow and access-control behaviour. GitHub Actions is used for continuous-integration workflows. The specific versions and operational configuration should be taken from the project’s package and deployment configuration at the time the final report is prepared.

## 2.7 Legal, Social, Ethical and Professional Considerations

The project involves employee, customer, supplier, sales and payment-related records. These data types raise privacy and security considerations that are examined in detail in Chapter Nine. Ghana’s Data Protection Act, 2012 (Act 843) remains the principal national legislation identified in the project context, but it predates the five-year source preference. As a legal authority it may still need to be cited where relevant; legislation should not be omitted solely to satisfy a publication-date rule. Current official guidance and the exact legal duties applicable to SAT-J should be verified before making compliance claims.

The system’s access model aims to ensure that employees receive permissions appropriate to their roles and branch assignments. This is both a security requirement and an ethical consideration, because business and personal information should not be exposed more widely than necessary. Professional reporting also requires describing system capabilities honestly: the report should not claim offline operation, complete accounting functionality, production deployment, or successful user acceptance unless those claims are supported by evidence.

## 2.8 Conclusion

This chapter has described the problem domain as the digitisation of an existing three-branch building-materials business. It has identified the importance of consistent product records, branch-aware stock, traceable purchasing and sales workflows, controlled transfers, financial records and management reporting. A desk review of Loyverse, Odoo and Hubtel Retailer showed that existing systems offer useful retail capabilities, while also highlighting the need to assess features against SAT-J’s actual requirements.

The chapter also set out development criteria and summarised the technologies used by SAT-J Ent. The next chapter reviews literature in greater depth, particularly on SME information systems, retail inventory and transaction management, security, and system adoption. Claims about SAT-J’s current manual procedures and user experience will be strengthened with primary evidence from the business before the final report is submitted.

## References cited in Chapter Two

Emuron, A.S.O., et al. (2022) ‘Management Principles for the Appraisal and Diffusion of Information Systems: Case of SMEs in Ghana’, _International Journal of Information Systems and Supply Chain Management_, 15(3), pp. 1–17. Available at: https://doi.org/10.4018/IJISSCM.290015.

Hubtel (n.d.) ‘Become a retailer / retail partner’. Available at: https://explore.hubtel.com/retail-partners/ (Accessed: 4 November 2026).

Hubtel Limited (2026) ‘Hubtel Retailer’, _Google Play_. Available at: https://play.google.com/store/apps/details?id=com.hubtel.sales (Accessed: 4 November 2026).

Loyverse (n.d.-a) ‘Loyverse POS features’. Available at: https://loyverse.com/features (Accessed: 4 November 2026).

Loyverse (n.d.-b) ‘Offline Use of Loyverse POS’. _Loyverse Support Center_. Available at: https://help.loyverse.com/help/offline-work-of-pos (Accessed: 4 November 2026).

Odoo (n.d.-a) ‘Point of Sale: Offline POS’. _Odoo 19.0 Documentation_. Available at: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale.html (Accessed: 4 November 2026).

Odoo (n.d.-b) ‘Products’. _Odoo 19.0 Documentation_. Available at: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/products.html (Accessed: 4 November 2026).

PostgreSQL Global Development Group (n.d.) ‘Row Security Policies’. _PostgreSQL 17 Documentation_. Available at: https://www.postgresql.org/docs/17/ddl-rowsecurity.html (Accessed: 4 November 2026).

Scarfone, K., Souppaya, M. and Dodson, D. (2022) _Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities_. NIST Special Publication 800-218. National Institute of Standards and Technology. Available at: https://doi.org/10.6028/NIST.SP.800-218.

World Bank (2025) _Transforming Ghana in a Generation: 2025 Policy Notes_. Washington, DC: World Bank Group. Available at: https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099506109222528534.

---

### Items to confirm before finalising this chapter

- How SAT-J currently records stock, purchases, sales, payments and transfers at each of its three branches.
- Which staff roles participated in requirements gathering, if any, and what methods were actually used.
- Whether the school requires Harvard, APA or another author-date reference format.
- Whether primary user evaluation has been conducted or is still planned.
- The exact project version and deployment environment to describe in the final report.
