# CHAPTER ONE: INTRODUCTION

_Working draft for the SAT-J Ent final-year project report. Project-specific descriptions are based on the current repository and its project documentation. Confirm the organisation’s approved name, operating location, current manual processes, and any stakeholder research before treating those details as final._

## 1.1 Background of the Project

Retail and distribution businesses depend on accurate information about products, stock, purchases and sales. When these records are kept in separate places or are updated late, staff may not have the same understanding of what is available, what has been sold, or what still needs to be received. This can affect everyday decisions such as when to reorder an item, whether a branch can fulfil a request, and how management compares branch performance. A shared information system can help bring these activities into a more consistent process, although the system still needs to reflect the way the business actually operates.

This issue is relevant to small and medium-sized businesses in Ghana. The World Bank’s 2025 policy notes report that some firms recognise the potential value of digital improvements such as online sales and integrated payments, while adoption remains limited. This suggests that there is a practical gap between seeing the value of digital tools and using them across business activities (World Bank, 2025). Research on Ghanaian SMEs has also highlighted that information-system decisions need to be appraised in relation to the organisation and its resources, rather than treated as a technology choice alone (Emuron et al., 2022).

SAT-J is an existing Ghanaian building-materials retailer and distributor with three branches. SAT-J Ent is the web-based business-management platform being developed to help digitise the business’s operations and bring its main activities into one system. These activities include product and variant records, branch inventory, purchasing and goods receiving, sales, daily sales batches, inter-branch stock transfers, customer and supplier records, expenses, financial accounts, and management reporting. Employee access is controlled through roles, permissions and branch assignments. The application is built as a modular monolith using Next.js and Supabase, with PostgreSQL as the authoritative store for business data and transaction rules.

The platform has developed through a number of implementation phases. Its current direction is owner-focused: improving visibility of stock, purchases and receiving, sales, branch performance and financial information. The system includes both internal management routes and public catalogue and enquiry functionality, but the public website is disabled by default in the current configuration. This report therefore focuses primarily on the authenticated operational system and describes public-facing features according to their actual availability. It does not present SAT-J Ent as an offline-first point-of-sale system, nor as a complete accounting package.

## 1.2 Problem Statement

Managing a building-materials business across multiple branches requires reliable records of products, stock movements, purchasing, sales and money received or paid. If these activities are handled in separate processes, management can find it difficult to obtain a consistent view of operations. Differences in branch records, delays in posting transactions, and limited reporting can make it harder to answer questions about current stock, goods awaiting receipt, sales activity, transfers in transit, and financial performance.

The SAT-J Ent project addresses the need for a single, controlled platform in which authorised employees can manage these connected activities. In particular, inventory must be supported by a traceable movement history; purchasing and receiving must update stock correctly; sales and daily sales batches must be reflected in reporting without being double-counted; and branch-level information must only be available to employees with the required authority. These concerns are important because incorrect transaction handling can affect both operational decisions and the reliability of later reports.

The project also has to balance access and protection. Employees need information to perform their roles, but one branch should not automatically have access to another branch’s restricted operational data. The platform therefore applies application-level permission checks and database-level row security and transaction rules. Security needs to be considered throughout software development, since security practices are more effective when they are integrated into the development process rather than added only at the end (Scarfone, Souppaya and Dodson, 2022).

The problem addressed by this project is therefore how to design, implement and evaluate a web-based, multi-branch business-management platform that improves the coordination and visibility of core retail operations while maintaining reliable transaction records, appropriate access control and useful management reporting.

## 1.3 Aim and Objectives

### 1.3.1 Aim

The aim of this project is to design, develop and evaluate SAT-J Ent, a web-based management platform that supports the core operational and reporting needs of a multi-branch building-materials retailer in Ghana.

### 1.3.2 Objectives

The objectives of the project are to:

1. Examine the business context and identify the operational requirements for managing products, inventory, purchasing, sales, transfers, finance and reporting across branches.
2. Review recent literature and relevant systems to identify suitable approaches to business-process integration, data management, access control and software quality.
3. Specify the system’s functional and non-functional requirements, including role-based access and branch-level data restrictions.
4. Design the application architecture, database structures, user workflows and interfaces in a way that supports reliable and traceable transactions.
5. Implement the required management features using the project’s selected web technologies and database platform.
6. Evaluate the implementation against its requirements using available automated tests and other verifiable project evidence.
7. Document the system’s achievements, limitations and recommendations for future development.

## 1.4 Project Scope

The project covers the design, implementation and evaluation of the SAT-J Ent web application for SAT-J’s three-branch business. Its primary users are authorised employees, including administrators, owners and branch-based staff whose access depends on their assigned role and branch. The current system scope includes:

- employee authentication, profiles, roles, permissions and branch assignments;
- product catalogue management, sellable variants, item codes and effective-dated pricing;
- branch inventory, opening stock, stock counts, adjustments and movement history;
- supplier records, purchase orders, goods receipts and supplier payments;
- customer records, sales, customer payments and receivables;
- daily sales batches for recording and posting branch sales activity;
- inter-branch stock transfers with dispatch and receipt workflows;
- expenses, branch financial accounts and associated financial movements;
- dashboards and reports for sales, inventory, purchasing, transfers and financial performance; and
- public catalogue and enquiry routes, which are retained in the codebase but disabled by default in the current configuration.

The scope is limited to the functions supported by the current implementation. The system is not described as a native mobile application, an offline-first application, or a certified accounting package. The existing finance features support specified operational workflows, but documented extensions remain, including receipt upload interaction, inter-account transfers, bank-statement import and matching, and some historical ledger reconciliation. Any feature not implemented or not sufficiently verified will be identified as a limitation rather than presented as complete.

The report will focus on the application and its operational workflows. It will not claim that the system has been deployed to production or adopted across all branches unless evidence is provided to support that claim. Details about the retailer’s existing procedures, interviews, observations, user feedback, and live business outcomes will also be included only where the project owner can provide verifiable evidence.

## 1.5 Methodology Overview

This project follows a practical software-development approach that connects requirements, design, implementation and evaluation. The report will describe the development process from the evidence available in the repository, project documentation, database migrations and test suites. Where records of stakeholder interviews, observation or requirements workshops are available, they can be incorporated to explain how business needs were identified. They should not be inferred from the code alone.

The implementation uses Next.js with React and TypeScript for the web application, and Supabase for authentication, PostgreSQL data storage and related platform services. Business data and transaction integrity are handled primarily in PostgreSQL, including database constraints, row-level security and controlled transactional functions. The application is organised as a modular monolith, with feature folders for areas such as inventory, purchasing, sales and transfers. Secure development guidance supports addressing security requirements as part of the development lifecycle (Scarfone, Souppaya and Dodson, 2022).

Evaluation will be based on traceable evidence. The repository contains unit and component tests, Playwright end-to-end tests, and database security and workflow tests. These can be mapped to the requirements in Chapter Four and reported with their actual results and limitations. A test being present in the repository will not, by itself, be treated as proof that it passed. Usability findings or client feedback should be reported only if a real evaluation was conducted and its method and participants can be documented.

This report is organised into nine chapters. Chapter One introduces the project, its problem, aim, objectives, scope and methodology. Chapter Two examines the business problem domain and relevant systems. Chapter Three reviews recent literature. Chapter Four presents the system requirements. Chapter Five explains the design and development methodology. Chapter Six describes implementation. Chapter Seven reports testing and evaluation. Chapter Eight critically reviews the outcomes and recommends future work. Chapter Nine considers legal, social, ethical and professional issues.

## References cited in Chapter One

Emuron, A.S.O., et al. (2022) ‘Management Principles for the Appraisal and Diffusion of Information Systems: Case of SMEs in Ghana’, _International Journal of Information Systems and Supply Chain Management_, 15(3), pp. 1–17. Available at: https://doi.org/10.4018/IJISSCM.290015.

Scarfone, K., Souppaya, M. and Dodson, D. (2022) _Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities_. NIST Special Publication 800-218. National Institute of Standards and Technology. Available at: https://doi.org/10.6028/NIST.SP.800-218.

World Bank (2025) _Transforming Ghana in a Generation: 2025 Policy Notes_. Washington, DC: World Bank Group. Available at: https://documents.worldbank.org/en/publication/documents-reports/documentdetail/099506109222528534.

---

### Items to confirm before finalising this chapter

- The company’s preferred full name and operating location(s); the business has confirmed that it operates three branches.
- The specific current problems as confirmed by the owner or staff, including any manual or fragmented processes.
- Whether stakeholder interviews, workplace observation, or document review were conducted, and the dates/participants where appropriate.
- Whether the current application has been used with live business data or only in a development/staging environment.
- The school’s required citation format and whether statutory laws are exempt from the five-year source rule.
