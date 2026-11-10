# CHAPTER FOUR: REQUIREMENTS ANALYSIS

_Working draft. Requirements below are derived from the current SAT-J Ent implementation and project documentation. They are not presented as interview findings or formally approved client requirements unless SAT-J confirms them. Image and diagram placeholders are included for materials to be supplied or captured._

## 4.1 Client / Stakeholder Brief

SAT-J is an existing Ghanaian building-materials retailer and distributor with three branches. SAT-J Ent is being developed as a web application to help digitise the business and coordinate its operational records. The platform is intended for authorised employees, including company-level administrators and owners, branch managers, sales staff and inventory staff. The permissions available to each user depend on their role and, for branch-scoped roles, their active branch assignments.

Based on the implemented system, the principal stakeholder groups are:

| Stakeholder                         | Interest in the system                                            | Relevant system areas                                                   |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Business owner / company management | View company performance, oversee operations and control access   | Dashboard, reports, finance, users and branches                         |
| Super Administrator                 | Configure employee access and company settings                    | User and role administration, branches, audit, settings                 |
| Branch Manager                      | Coordinate permitted daily operations at an assigned branch       | Inventory, purchasing, sales, daily sales, transfers and branch reports |
| Sales employee                      | Record sales and customer payments within assigned scope          | Customers, sales, receipts and receivables                              |
| Inventory employee                  | Maintain stock records and process permitted stock operations     | Product lookup, inventory, receiving and transfers                      |
| Customers and suppliers             | Provide or receive goods and participate in business transactions | Customer and supplier records and related transaction documents         |

The customer and supplier groups are included as business participants; the current internal system does not give them authenticated self-service accounts. Public catalogue and enquiry routes exist in the codebase but are disabled by default in the current configuration.

The system design indicates that management needs a more coordinated way to view operational data across the three branches. However, the exact problems in SAT-J’s previous recording processes must be confirmed with the business. The report should not state that SAT-J relied on paper records, spreadsheets, WhatsApp, or disconnected cash registers unless this is verified through owner or staff input, observation or existing records.

**[IMAGE PLACEHOLDER 4.1: SAT-J stakeholder or business context image]**

_Suggested material: a photograph of the business or a simple three-branch context illustration. Obtain approval before using identifiable staff, customers, private premises or business records. Add a caption and source/permission note._

## 4.2 Rich Picture of the Current Environment

A rich picture can be used to show the relationship between SAT-J’s three branches, staff roles, central management and the business activities the system is intended to support. Since no verified description of the former processes has yet been provided, the figure below is a **proposed conceptual view of the target context**, not a factual record of the current manual environment.

**[IMAGE PLACEHOLDER 4.2: Rich picture of the SAT-J three-branch business environment]**

_Suggested diagram contents: three branches; authorised employees; company management; shared product catalogue; branch inventory; purchasing and goods receiving; sales and daily sales batches; transfers between branches; finance and reporting; SAT-J Ent as the shared platform. Use arrows to show information and goods movement. Show goods in transit separately from stock available at a branch._

Once the business confirms the current workflow, a second version can show existing processes and pain points. The target rich picture should distinguish physical goods movement from digital record updates. For example, a transfer is dispatched from a source branch and only becomes destination stock after receipt is recorded.

## 4.3 Functional Requirements Using MoSCoW Prioritisation

The following requirements are derived from the implemented routes, project documentation and database workflows. “Must” indicates a core requirement for the scoped system; “Should” indicates an important capability that supports operation but may not be essential to every user journey; “Could” identifies an optional or future-facing capability; “Won’t (current scope)” records an explicit boundary. The priorities should be reviewed with SAT-J stakeholders before being presented as formally agreed.

### 4.3.1 Functional requirements

| ID   | Requirement                                                                                                                      | Priority                   | Current implementation evidence                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| FR01 | The system shall authenticate employees and allow access only to active profiles with valid permissions.                         | Must                       | Supabase authentication, protected `/app` routes and active-profile checks           |
| FR02 | The system shall assign employees roles and, where required, branch access.                                                      | Must                       | Roles, permissions and branch assignment workflows                                   |
| FR03 | The system shall restrict operational records to authorised roles and accessible branches.                                       | Must                       | Application checks and PostgreSQL row-level security / branch checks                 |
| FR04 | The system shall manage product records, sellable variants and unique item codes.                                                | Must                       | Product and catalogue routes, variant records and Item Code search                   |
| FR05 | The system shall manage company or branch effective-dated product prices according to permissions.                               | Must                       | Price management and branch-aware price resolution                                   |
| FR06 | The system shall record opening stock, adjustments and stock counts for a branch and product variant.                            | Must                       | Opening-stock, adjustment and count workflows                                        |
| FR07 | The system shall preserve a traceable stock movement history and prevent normal operations from creating negative stock.         | Must                       | Immutable movement ledger and locked transactional stock updates                     |
| FR08 | The system shall allow authorised users to create and manage purchase orders.                                                    | Must                       | Supplier and purchase workflows                                                      |
| FR09 | The system shall post received quantities to the purchase branch and inventory ledger atomically.                                | Must                       | Goods receipt workflow, GRNs and `PURCHASE_RECEIPT` movements                        |
| FR10 | The system shall record sales and apply stock reduction only when a sale is completed.                                           | Must                       | Draft/completed sale workflow and `SALE` movements                                   |
| FR11 | The system shall record customer payments and expose outstanding receivables for applicable sales.                               | Must                       | Payment and receivable workflows                                                     |
| FR12 | The system shall record branch daily sales batches separately from individually paid customer sales.                             | Must                       | Draft, post and reverse daily sales batch workflow                                   |
| FR13 | The system shall allow authorised users to create, approve, dispatch and receive inter-branch transfers according to their role. | Must                       | Transfer lifecycle and source/destination branch authorization                       |
| FR14 | The system shall record expenses and related financial account movements.                                                        | Must                       | Expense and finance workflows                                                        |
| FR15 | The system shall provide dashboards and reports filtered by date and permitted company or branch scope.                          | Must                       | Dashboard, report catalogue, branch filters and secured report loaders               |
| FR16 | The system shall support controlled correction or reversal of eligible posted transactions while retaining history.              | Must                       | Sale cancellation/reversal, daily batch reversal and transfer lifecycle controls     |
| FR17 | The system shall support export of permitted reports in CSV format.                                                              | Should                     | Report export routes with report permission checks                                   |
| FR18 | The system shall provide an anonymous public catalogue and enquiry service.                                                      | Could / currently disabled | Public routes and curated read functions exist; public site is disabled by default   |
| FR19 | The system shall allow users to complete core transactions while disconnected and synchronise them later.                        | Won’t (current scope)      | Offline-first transaction capture is not implemented or claimed                      |
| FR20 | The system shall provide a complete general ledger and certified accounting statements.                                          | Won’t (current scope)      | Finance features support defined operational workflows; accounting extensions remain |

### 4.3.2 User roles and permissions

The implementation uses five principal employee roles. The tables below summarise the current permission model at a high level; individual permissions and branch scope remain authoritative.

| Role           | Typical scope       | Main capabilities                                                                                             |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Super Admin    | Company-wide        | Manage users, roles and branches; access authorised operational and reporting functions                       |
| Owner          | Company-wide        | Review business operations and reports; manage permitted transactions and finance workflows                   |
| Branch Manager | Assigned branch(es) | Coordinate assigned branch operations, including permitted sales, purchases, inventory and transfer actions   |
| Sales          | Assigned branch(es) | Work with customers, sales and customer payments; limited operational read access                             |
| Inventory      | Assigned branch(es) | Read inventory, update stock through permitted workflows, receive goods and handle permitted transfer actions |

**[IMAGE PLACEHOLDER 4.3: Role-permission matrix or access-control diagram]**

_Suggested material: a permission matrix derived from `docs/access-control.md`, including company versus assigned-branch scope. Use the current role permissions and verify the final matrix with SAT-J before submission._

### 4.3.3 Use cases

The main use cases derived from the implementation are:

- authenticate and access the management application;
- manage employees, roles, branches and access assignments;
- create or update products, variants, item codes and prices;
- record opening stock, adjustments and physical counts;
- create a purchase order, receive goods and record supplier payment;
- create and complete a sale, issue a receipt and record customer payment;
- record and post a daily sales batch;
- request, approve, dispatch and receive a branch transfer;
- record and process an expense and financial movement; and
- review dashboards, reports and permitted exports.

**[IMAGE PLACEHOLDER 4.4: SAT-J Ent use-case diagram]**

_Suggested diagram contents: actors for Super Admin, Owner, Branch Manager, Sales employee and Inventory employee; major use cases listed above; system boundary labelled SAT-J Ent. Connect actors only to actions permitted by the verified access model. Customers and suppliers should not be shown as application users unless external account functionality is added._

## 4.4 Non-Functional Requirements

Non-functional requirements describe how the system should behave and the quality constraints it should meet. The following requirements are proposed from the project’s architecture and guardrails. Numeric performance and availability targets should be agreed with the project supervisor or business rather than invented.

| ID    | Quality area    | Requirement                                                                                                                                                                       |
| ----- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR01 | Security        | The system shall verify employee identity and active status before granting access to protected routes or operations.                                                             |
| NFR02 | Authorization   | The system shall enforce role permissions and branch scope in trusted server code and at the database boundary.                                                                   |
| NFR03 | Data integrity  | Inventory-affecting operations shall update the stock balance and movement ledger atomically. A failed operation shall not leave partial changes.                                 |
| NFR04 | Idempotency     | Retrying an eligible critical operation shall not duplicate its stock, payment or reporting effect.                                                                               |
| NFR05 | Auditability    | Important user and transaction actions shall retain sufficient history for review; completed records shall not be silently deleted or rewritten.                                  |
| NFR06 | Accuracy        | Monetary values shall use precise decimal handling and be presented in Ghana cedis (GHS).                                                                                         |
| NFR07 | Time handling   | Business dates shall follow the system’s documented business-date rules and be displayed using the operational timezone, Africa/Accra.                                            |
| NFR08 | Usability       | Forms shall provide clear labels, validation feedback, transaction status and actionable error messages. This requirement needs evaluation with intended users.                   |
| NFR09 | Accessibility   | Core navigation and forms should support keyboard use, readable contrast and responsive layouts. Compliance claims require a documented accessibility evaluation.                 |
| NFR10 | Maintainability | Business features shall remain organised into cohesive modules, and database changes shall use version-controlled migrations.                                                     |
| NFR11 | Compatibility   | The web application should render and support core workflows on the browsers and screen sizes selected for evaluation. The supported matrix must be stated in the test chapter.   |
| NFR12 | Performance     | Common product lookup and report workflows should respond within targets agreed for the project and tested in a documented environment.                                           |
| NFR13 | Reliability     | Critical business workflows shall validate permissions, branch, status and stock at the server/database boundary rather than relying on browser values.                           |
| NFR14 | Recovery        | The operational environment should have documented backup and recovery procedures before production use. The presence of a runbook does not prove a recovery exercise has passed. |
| NFR15 | Connectivity    | The current system requires online connectivity for server-backed operational workflows; offline transaction capture is outside the present scope.                                |

## 4.5 Use Case Diagram of the Proposed System

The use-case diagram should show how each employee role interacts with SAT-J Ent. It should also make clear that the system is responsible for checking permissions and branch access before protected business data or actions are made available. The diagram is a high-level view and does not replace workflow or database design diagrams.

**[IMAGE PLACEHOLDER 4.5: Final use-case diagram image]**

_Insert the exported UML use-case diagram here. Ensure actor names and use cases match the role-permission matrix in Section 4.3.2. Include a figure number, descriptive caption and a note such as “Source: Author’s design, based on SAT-J Ent requirements.”_

## 4.6 Comparison with Existing Systems

The product comparison in Chapter Two identified relevant capabilities in Loyverse, Odoo and Hubtel Retailer. This section maps those observations to SAT-J Ent’s requirements. It is a feature comparison based on public documentation, not a benchmark or hands-on test.

| Requirement area                      | Loyverse                                                 | Odoo POS / Inventory                                      | Hubtel Retailer                                                                     | SAT-J Ent                                                                                |
| ------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Product catalogue and variants        | Published                                                | Published                                                 | Public listing describes inventory and item management                              | Implemented for internal users                                                           |
| Multiple locations / branches         | Published                                                | Configurable in broader inventory platform                | Retailer/store workflows are published; detailed branch semantics need confirmation | Three-branch business context; branch-scoped records                                     |
| Stock adjustment and movement history | Published inventory tools                                | Inventory tracking and operations published               | Inventory and price updates published                                               | Ledger-backed stock operations documented                                                |
| Purchasing and goods receipt          | Purchase orders in advanced inventory features           | Broader purchasing/inventory apps available               | Not established from reviewed public listing                                        | Purchase orders, goods receipts and supplier payments implemented                        |
| Inter-branch stock transfer           | Published                                                | Inventory transfers supported in broader suite            | Not established from reviewed public listing                                        | Dispatch and receipt workflow implemented                                                |
| Offline transaction capture           | POS sales available offline with limitations             | Selected POS functions available offline with limitations | Not established in reviewed listing                                                 | Not implemented                                                                          |
| Role and branch access                | Employee access features published                       | POS access rights published                               | Team-management features published                                                  | Roles, permissions and branch assignments implemented                                    |
| Finance and reporting                 | Sales and inventory reports; some advanced features paid | Broad accounting/reporting suite available                | Sales reports described                                                             | Operational reporting and selected finance workflows; not a certified accounting package |

The comparison indicates that SAT-J Ent is intended to address a combination of internal workflows rather than one narrow POS function. Its distinguishing requirements for this project are the branch-specific transaction model, traceable inventory movements, explicit receiving and transfer processes, and owner-oriented reporting. This statement describes the project’s implemented design; it does not claim superiority over commercial products.

## 4.7 Requirements Elicitation Methods

Requirements can be established through interviews with the owner and staff, observation of branch workflows, review of business documents, and analysis of the existing system. These methods help distinguish actual business needs from assumptions and reveal differences between branches or job roles.

The evidence currently available for this draft consists mainly of the application code, repository documentation, database migrations and automated test definitions. These sources support a description of implemented functions and technical constraints, but they do not establish that formal interviews or direct observation occurred. Therefore, the methods actually used for the project must be confirmed before this section is finalised.

**[IMAGE PLACEHOLDER 4.6: Requirements-gathering evidence]**

_Possible items: a photograph of an approved interview session, an anonymised sample process form, a requirements workshop image, or a process map created from confirmed staff input. Do not include personal data, customer records, financial records or identifiable participants without appropriate permission._

After confirmation, a requirements traceability matrix should link each requirement to its source, implementation location and test evidence. A suggested format is:

| Requirement ID | Requirement source                              | Implementation reference               | Verification evidence                             | Status      |
| -------------- | ----------------------------------------------- | -------------------------------------- | ------------------------------------------------- | ----------- |
| FR01           | Confirmed business need / project documentation | Authentication and protected layout    | Relevant unit, browser or database test           | To complete |
| FR07           | Inventory integrity requirement                 | Inventory workflow and movement ledger | Inventory database tests and concurrency evidence | To complete |
| FR09           | Purchasing and receiving requirement            | Purchase receipt workflow              | Purchasing database and browser evidence          | To complete |
| FR13           | Inter-branch transfer requirement               | Transfer workflow                      | Transfer database and browser evidence            | To complete |
| NFR02          | Security requirement                            | Authorization and row-level security   | Role/branch denial tests                          | To complete |

The final status values should be based on actual test execution results for the final project version. Suitable status labels include **Met**, **Partially Met**, **Not Met**, and **Not Verified**. “Not Verified” is appropriate where a feature appears implemented but there is no reliable current evidence that it was tested.

## 4.8 Conclusion

This chapter has translated SAT-J Ent’s documented scope into a set of functional and non-functional requirements for a business operating three branches. It has identified the principal employee roles, outlined core use cases, established preliminary MoSCoW priorities, and provided placeholders for a rich picture, access-control diagram, use-case diagram and requirements-gathering evidence.

The requirements are currently grounded in the codebase and project documentation. They should be validated with SAT-J stakeholders so that the report reflects confirmed operational needs and not only implemented features. Chapter Five will describe how these requirements are represented in the system architecture, data model, workflows and interface design.

## References cited in Chapter Four

Hubtel Limited (2026) ‘Hubtel Retailer’, _Google Play_. Available at: https://play.google.com/store/apps/details?id=com.hubtel.sales (Accessed: 4 November 2026).

Loyverse (n.d.) ‘Loyverse POS features’. Available at: https://loyverse.com/features (Accessed: 4 November 2026).

Odoo (n.d.) ‘Point of Sale’ and ‘Products’. _Odoo 19.0 Documentation_. Available at: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale.html and https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/products.html (Accessed: 4 November 2026).

PostgreSQL Global Development Group (n.d.) ‘Row Security Policies’. _PostgreSQL 17 Documentation_. Available at: https://www.postgresql.org/docs/17/ddl-rowsecurity.html (Accessed: 4 November 2026).

Scarfone, K., Souppaya, M. and Dodson, D. (2022) _Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities_. NIST Special Publication 800-218. National Institute of Standards and Technology. Available at: https://doi.org/10.6028/NIST.SP.800-218.

---

### Items to confirm before finalising this chapter

- Confirm SAT-J’s actual current workflows and the specific problems staff want the system to solve.
- Confirm which requirements were formally elicited or approved and by whom.
- Confirm whether the business requires the public catalogue/enquiry features in the report’s main project scope.
- Add the final rich picture, use-case diagram and any approved evidence images to the placeholders above.
- Review all MoSCoW priorities with the supervisor or business representative.
- Populate the traceability matrix with test results from the final code version.
