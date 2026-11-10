# CHAPTER THREE: LITERATURE REVIEW

_Working draft. This chapter synthesises recent research and selected official technical guidance. It uses an author-date style and prioritises sources published from 2021 onward. The Ghanaian Data Protection Act is older, but is a primary legal source and may need to be retained in the final report where the law is discussed._

## 3.1 Introduction to the Literature Review

This chapter reviews literature relevant to the development of a web-based management system for SAT-J, an existing Ghanaian building-materials retailer and distributor with three branches. The review focuses on small and medium-sized enterprise (SME) digitisation, information systems in Ghanaian businesses, integrated retail operations, inventory and transaction integrity, information security, and system adoption. These topics were selected because the project is intended to bring several operational activities into one digital platform, while preserving branch-specific access and reliable records.

The review does not assume that introducing software automatically improves business performance. Instead, it considers the conditions that influence whether a system is appropriate, whether its information can be trusted, and whether employees can use it as part of their daily work. The chapter concludes by identifying the gap addressed by SAT-J Ent and the relevance of the reviewed literature to the project.

## 3.2 Methodology of Literature Search

The literature search was conducted as a focused narrative review rather than a full systematic review. Search terms included combinations of “SME digital transformation”, “Ghana information systems”, “retail inventory management”, “business information systems”, “secure software development”, “database row-level security”, and “SME technology adoption”. Sources were located through academic publisher pages, DOI records, government or standards bodies, and official vendor documentation.

Priority was given to research published between 2021 and 2026, in line with the project’s preference for sources no older than five years. A small set of sources was selected for repeated use: Ghana-focused SME research by Emuron et al. (2022), reviews of SME digital transformation by Ben Slimane, Coeurderoy and Mhenni (2022) and Sagala and Őri (2024), Ghana business context from the World Bank (2025), and secure-development guidance from NIST (Scarfone, Souppaya and Dodson, 2022). Official database documentation is used where a technical behaviour is being described, rather than relying on secondary summaries.

The search has limitations. First, research on SMEs in Ghana does not necessarily describe the needs of a particular building-materials distributor. Second, vendor documentation describes intended product features but is not independent comparative evidence. Third, this draft is not a meta-analysis and does not claim exhaustive coverage of every publication in the field. The reviewed sources provide a defensible foundation for the project, while primary information from SAT-J remains necessary to describe the business’s exact processes and user experience.

## 3.3 Overview of SME Digitalisation and the Retail Domain

Digitalisation in a business is broader than purchasing a computer or moving a paper form onto a website. It can involve connecting information across business activities, changing how staff share information, and improving how managers monitor operations. Ben Slimane, Coeurderoy and Mhenni (2022) reviewed research on SME digital transformation and identified the importance of infrastructure and process change, organisational and managerial mechanisms, and senior management involvement. Their analysis is useful because it frames transformation as an organisational effort, rather than a purely technical installation.

Sagala and Őri (2024) similarly conclude that SMEs should consider their starting position and constraints, make digitalisation incremental, and invest in learning. This is relevant to SAT-J because the business has three branches and the application introduces multiple related workflows. A staged implementation can make the transition easier to understand and evaluate, provided each stage fits the business process and is communicated to its users. The review does not mean that every SME must follow the same path; it offers a principle that should be interpreted in the organisation’s own context.

Evidence from Ghana supports the importance of local organisational factors. Emuron et al. (2022) studied information-system appraisal and diffusion among Ghanaian SMEs. Their work highlights that information-system decisions involve management principles and organisational considerations. The World Bank’s 2025 policy notes provide broader economic context, reporting that firms may recognise the benefits of digital improvements while adoption remains limited across some business functions (World Bank, 2025). Taken together, these sources suggest that a project should explain not only what technology was built, but what operational need it is meant to address and how employees and management are expected to use it.

For a multi-branch retailer, day-to-day operations generate connected information. A purchase receipt changes stock at a particular branch; a completed sale reduces available stock; and a transfer moves stock out of one branch before it becomes available at another. If these events are not represented consistently, a product search or management report may not reflect the real position. SAT-J Ent’s repository uses branch and product-variant records, stock movement entries and controlled workflows. This design is consistent with the general information-systems principle that information should be linked to the activity that produced it, although the business benefits must still be evaluated through actual use and data.

## 3.4 Integrated Retail, Inventory and Transaction Information Systems

An integrated retail management system connects records that are often operationally dependent. Product identity is needed for stock counts, purchase orders, goods receipts, sales and transfers. Branch identity is needed because stock held in one location cannot be treated as immediately available in another. Supplier and customer records provide context for purchasing and sales. Reporting then depends on the meaning and completeness of these underlying transactions.

The literature on SME digital transformation cautions against treating integration as a technology-only outcome. Ben Slimane et al. (2022) emphasise process and managerial changes alongside digital infrastructure, while Sagala and Őri (2024) highlight incremental transformation and learning. For SAT-J, this implies that it is not enough for a page to exist for each business area. Staff workflows, permissions, shared definitions of products and branches, and the way exceptions are corrected all affect whether the system can provide useful information.

Inventory information is particularly sensitive to transaction timing and data quality. In the project’s documented model, stock is associated with a branch and a sellable product variant. A current balance is supported by a movement history, and workflows such as opening stock, adjustment, count, purchase receipt, sale and transfer create specific movement types. Transfers have separate dispatch and receipt stages: stock leaves the source branch at dispatch and only becomes destination stock after receipt. This avoids treating goods in transit as available at either location. Such explicit states improve traceability and allow staff to investigate how a balance changed.

Sales and reporting also require clear definitions. The SAT-J reporting documentation distinguishes sales revenue from customer collections, because a sale and the timing of payment are different events. It also treats some inventory indicators as current-state measures and avoids reporting profit where the underlying cost basis is incomplete. This restraint is important: a digital system can produce precise-looking numbers that are still misleading if the definitions or source records are incomplete. For this project, reporting quality should therefore be assessed by checking metric definitions, date handling, branch scope and reconciliation to source transactions.

## 3.5 Security and Data Governance in Business Systems

Business-management systems contain operational and personal information. Even when the main purpose is stock and sales management, records may include employee profiles, customer contact details, supplier information and payment references. The system must therefore control who can view or change information and preserve trustworthy transaction history.

Scarfone, Souppaya and Dodson (2022) present the NIST Secure Software Development Framework (SSDF), which recommends embedding security practices across software development. It groups practices around preparing the organisation, protecting software, producing well-secured software, and responding to vulnerabilities. For an academic project, the framework is useful as a reference point for treating security as part of requirements, design, implementation and verification, rather than a final checklist.

SAT-J Ent uses employee roles and permissions, branch assignments, server-side checks and database policies. This layered approach is relevant because hiding a button in the interface alone does not prevent an unauthorised request from reaching the database. PostgreSQL documentation explains that when row-level security is enabled, row access and modification are governed by policies that apply to the relevant user and operation (PostgreSQL Global Development Group, n.d.). The project further uses controlled database functions for important operations, such as receiving a purchase, completing a sale and dispatching or receiving a transfer. These checks should be evaluated with tests that attempt both permitted and denied actions.

Data governance also includes preserving the meaning of historical records. The project’s technical documentation describes completed stock and financial transactions as immutable or corrected through explicit reversal workflows, rather than silently editing their past effects. This supports an audit trail, but creates a responsibility to design clear correction processes and retain the context needed to investigate errors. It also means that historical data of unknown quality should be labelled as incomplete rather than “repaired” by assumptions.

## 3.6 Technologies Supporting the Proposed System

SAT-J Ent is implemented as a web application using Next.js, React and TypeScript, with Supabase services and PostgreSQL. A browser-based system can provide a shared application across branch locations without requiring a separate native application for every device type. Its suitability in practice depends on network availability, device access, usability, hosting and support arrangements. The current project does not claim offline-first operation; this distinction is important because offline capture and later synchronisation introduce additional questions about conflicts, duplicate submissions and stale stock data.

PostgreSQL provides relational data structures, constraints, transactions and row security. In SAT-J Ent, these capabilities are used to represent products, branches, operational documents and stock movements, and to enforce rules close to the data. Supabase supplies managed authentication and integration with the database and storage. The application uses server-side access for sensitive operations and limits browser components to interaction needs. These choices are aligned with a modular-monolith architecture: one deployable application with separate feature areas, supported by a shared database and clear transaction boundaries.

The use of established technologies does not itself demonstrate system quality. The implementation should be assessed through evidence of correctness, security, maintainability and usability. Automated tests can check individual functions, page workflows and database policies; they cannot fully determine whether employees find the system understandable or whether the business’s records are complete. Human evaluation and operational reconciliation are therefore useful complements to technical testing.

## 3.7 Theoretical Models and Frameworks

### 3.7.1 Digital transformation in SMEs

The SME digital-transformation reviews by Ben Slimane et al. (2022) and Sagala and Őri (2024) provide the main conceptual lens for this project. They position digitalisation as a combination of technology, process, management and learning. This is appropriate for SAT-J because digitising three branches involves common product and transaction records, but also employee responsibilities and branch-specific procedures. The framework encourages the project to consider whether the solution matches the business’s needs and resources, rather than equating a larger feature set with success.

### 3.7.2 Secure software development

The NIST SSDF provides a lifecycle lens for security. It is used in this report to consider whether security needs are reflected in requirements, architecture, implementation and test evidence (Scarfone et al., 2022). This is particularly relevant to role and branch access, transaction authorization, safe handling of credentials and response to defects. The SSDF is guidance, not a certification; the project should not claim compliance merely because it refers to the framework.

### 3.7.3 Information quality and system evaluation

For this project, system evaluation should consider whether outputs are accurate, timely, relevant and understandable for the intended business decisions. This is applied as a practical evaluation lens rather than a claim that a single information-systems success model has been fully measured. SAT-J Ent’s reports can be examined for metric definitions, branch restrictions, date range behaviour, and reconciliation against transaction records. Usability and user satisfaction require feedback from actual users using a clear method; they cannot be inferred from the presence of a polished interface or passing automated tests.

## 3.8 Gaps Identified in the Literature and Existing Systems

The recent SME literature provides broad findings about digital transformation and adoption, but it does not specify the exact information and workflow needs of SAT-J, a Ghanaian building-materials retailer with three branches. Research on Ghanaian SMEs helps provide local context, yet does not substitute for evidence gathered from the project’s own stakeholders. In addition, vendor descriptions of Loyverse, Odoo and Hubtel Retailer show that integrated retail functions are available in existing products, but public documentation does not establish whether each product meets SAT-J’s detailed transaction, branch, costing and reporting requirements.

This project addresses the practical gap between broad guidance and a specific implementation: it develops a web application whose documented scope connects product catalogue, branch inventory, purchasing and receiving, sales, daily sales batches, transfers, finance and reporting. Its database workflows are designed to preserve movement history and enforce role and branch controls. The contribution claimed here is a tailored system and its evaluation, not a new general theory of digital transformation. The extent to which the system resolves business problems must be determined from requirement traceability, technical tests and genuine user or operational evidence.

## 3.9 Relevance of the Literature to This Project

The literature informs the project in four main ways. First, Ghanaian SME research and World Bank evidence establish why business context and organisational readiness should be considered alongside technical development. Second, digital-transformation reviews support an incremental approach that can be evaluated as the system’s operational areas are developed. Third, secure-development guidance supports designing and testing permissions across the lifecycle. Finally, the integrated retail domain highlights the need to preserve relationships between products, branches, stock events, purchasing, sales and reports.

These ideas guide the later chapters. Chapter Four translates business needs into functional and non-functional requirements. Chapter Five explains the system architecture and data design. Chapter Six documents implementation based on the actual code. Chapter Seven evaluates the system using test outcomes and, where available, user evidence. In this way, the literature is used to shape the project and its evaluation, rather than being presented as background disconnected from the implementation.

## 3.10 Conclusion

This chapter reviewed recent research and guidance on SME digitalisation, information systems in Ghana, integrated retail operations, security and evaluation. The literature indicates that successful digitalisation involves organisational and process considerations as well as software. It also supports an incremental approach, attention to information quality, and the integration of security throughout development.

For SAT-J, these points are relevant because the business operates three branches and the proposed system links several operational workflows. The review also identified limitations in the available evidence: general SME studies cannot establish SAT-J’s current procedures, and vendor descriptions cannot replace hands-on comparison. Primary business evidence and transparent system testing are therefore necessary. Chapter Four presents the requirements that will be used to evaluate how well SAT-J Ent addresses the identified needs.

## References cited in Chapter Three

Ben Slimane, S., Coeurderoy, R. and Mhenni, H. (2022) ‘Digital transformation of small and medium enterprises: a systematic literature review and an integrative framework’, _International Studies of Management & Organization_, 52(2), pp. 96–120. Available at: https://doi.org/10.1080/00208825.2022.2072067.

Emuron, A.S.O., et al. (2022) ‘Management Principles for the Appraisal and Diffusion of Information Systems: Case of SMEs in Ghana’, _International Journal of Information Systems and Supply Chain Management_, 15(3), pp. 1–17. Available at: https://doi.org/10.4018/IJISSCM.290015.

PostgreSQL Global Development Group (n.d.) ‘Row Security Policies’. _PostgreSQL 17 Documentation_. Available at: https://www.postgresql.org/docs/17/ddl-rowsecurity.html (Accessed: 4 November 2026).

Sagala, G.H. and Őri, D. (2024) ‘Toward SMEs digital transformation success: a systematic literature review’, _Information Systems and e-Business Management_, 22, pp. 667–719. Available at: https://doi.org/10.1007/s10257-024-00682-2.

Scarfone, K., Souppaya, M. and Dodson, D. (2022) _Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities_. NIST Special Publication 800-218. National Institute of Standards and Technology. Available at: https://doi.org/10.6028/NIST.SP.800-218.

World Bank (2025) _Transforming Ghana in a Generation: 2025 Policy Notes_. Washington, DC: World Bank Group. Available at: https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099506109222528534.

---

### Items to confirm before finalising this chapter

- Whether the department requires a formal database search protocol, specific databases, or a minimum number of academic sources.
- Whether the school permits official technical documentation in the literature review or expects it only in the system-design chapter.
- Whether the report should discuss a named information-systems evaluation model, and whether the project has gathered user data to apply one.
- Whether the organisation has approved details, records or research evidence that can be cited as project-specific primary data.
