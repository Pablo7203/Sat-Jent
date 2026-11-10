# CHAPTER SEVEN: PRODUCT TESTING AND EVALUATION

_Working draft based on verification records in the project repository. Results below are drawn from phase audits and may refer to different snapshots of the codebase. Before submission, rerun the selected test suites against the final version and replace this draft summary with the exact commands, dates, environment and outcomes. No user feedback is claimed unless actual evaluation records are added._

## 7.1 Testing Strategy and Test Cases

Testing was planned at several levels because SAT-J Ent includes both user-interface workflows and business rules enforced in PostgreSQL. Unit and component tests cover validation, utility logic and reusable interface components. Playwright tests exercise selected browser workflows. Database tests verify transaction functions, permissions, row-level security and data-integrity rules. Type checking and linting provide additional static checks. Concurrency scripts are available for inventory, sales and transfers, although their results must be reported only when executed against an appropriate isolated database.

The main areas requiring verification are employee authentication and role access; product and item-code lookup; branch inventory; purchase receipt; sale completion and payment; daily sales batch posting and reversal; transfer dispatch and receipt; reporting filters and metric definitions; expense and finance workflows; and access denial across roles and branches. Tests should cover successful actions, invalid inputs, unauthorised actions, repeated requests and failures part-way through multi-item operations.

**[IMAGE PLACEHOLDER 7.1: Test environment and testing workflow]**

_Suggested diagram: test code → test application/database → test result evidence. Include environment details (local/CI, browser, database state) and show that mutation tests use isolated test data. Do not include environment secrets._

### 7.1.1 Test case summary

| Test ID | Area                 | Example test                                             | Expected result                                                               |
| ------- | -------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| TC01    | Authentication       | Unauthenticated user opens an internal route             | Redirect to login; protected data is not shown                                |
| TC02    | Role access          | Inactive or unconfigured employee opens the app          | Access denied                                                                 |
| TC03    | Branch isolation     | Branch-scoped employee requests another branch’s records | Request is denied or returns no inaccessible rows                             |
| TC04    | Product lookup       | Search by Item Code at an authorised branch              | Matching variant and permitted branch information are returned                |
| TC05    | Inventory            | Complete an adjustment or count with valid data          | Balance and movement history update together                                  |
| TC06    | Purchase receiving   | Receive a valid quantity against an ordered purchase     | Receipt and stock movement post atomically                                    |
| TC07    | Sales                | Complete a sale with adequate stock                      | Sale and stock movement are recorded; payment/receivable state is consistent  |
| TC08    | Stock shortage       | Post a sale or batch that exceeds available stock        | Operation fails without a partial stock change                                |
| TC09    | Daily sales batch    | Save a draft batch                                       | No inventory or posted-revenue effect occurs                                  |
| TC10    | Daily sales batch    | Post a valid batch                                       | Revenue and stock movements are recorded once; collections are not fabricated |
| TC11    | Transfer             | Dispatch then receive a transfer                         | Source stock decreases at dispatch; destination increases at receipt          |
| TC12    | Idempotency          | Repeat a posting request with the same operation key     | No duplicate movement or financial effect occurs                              |
| TC13    | Reporting            | Filter sales report by date and branch                   | Only permitted records and correctly defined measures are shown               |
| TC14    | CSV export           | Export a permitted report containing formula-like text   | Export preserves values safely and enforces report permissions                |
| TC15    | Responsive interface | Open key pages at desktop and mobile viewport sizes      | Content remains usable at tested viewport widths                              |

The expected results in this table describe the test plan. The result for each test must be filled from an actual execution against the final version. A test definition is not itself evidence of a pass.

### 7.1.2 Available verification evidence

The project phase audits record several successful focused checks. These include lint and TypeScript checks, unit-test runs in earlier phases, focused product-lookup browser tests, focused database suites for product/inventory and purchasing, a dashboard browser check, and a dedicated Phase 6 browser suite. The audits also record failures, skipped cases, environment blockers and test suites that were not run. Since these results were produced at different points during development, they should not be added together as though they all describe one final build.

The documented evidence includes:

- Phase 1 records passing lint, typecheck and unit tests (10 files, 31 tests), a focused responsive browser run, and a public-site-disabled database test. It also reports two failures in a broader browser suite and failures in the full SQL suite against accumulated local data.
- Phase 2 records a focused database suite with 23 assertions and a focused Chromium Item Code lookup test passing, along with lint, typecheck and unit tests (10 files, 31 tests).
- Phase 3 records a focused purchasing database suite with 64 assertions passing, lint and typecheck passing, unit tests (11 files, 35 tests) passing, and a read-only lookup browser test passing. Mutation-gated purchasing browser tests and concurrent receipt stress were not run.
- Phase 4 records typecheck and scoped lint passing, while the unit test invocation, database tests and production build were blocked by environment issues. Several end-to-end and concurrency checks remained outstanding.
- Phase 5 records lint and typecheck passing, and an authenticated dashboard browser check passing. The full database suite failed overall against accumulated local test data; a unit test invocation and production build were blocked, and the full authenticated browser suite was not run.
- Phase 6 records lint and typecheck passing, a prior unit-test run of 12 files and 37 tests passing, a prior database run with 502 assertions passing, and a dedicated browser suite with 8 of 8 tests passing. Final retries of some suites were blocked, and a combined full browser-suite rerun was not completed.

These records are useful development evidence, but a distinction must be made between focused and full-suite testing, and between passing and blocked runs. The most defensible final evaluation will rerun a selected coherent test matrix on the final code version and report those results separately from historical phase results.

## 7.2 Evaluation of Product Usability and Quality

### 7.2.1 Usability Evaluation

The interface includes a shared navigation shell, role-aware links, form validation, loading and empty states, branch/date filters and responsive layouts. The dashboard UI documentation records responsive behaviour, horizontally scrollable tables, touch-target considerations and chart legends. These are design and implementation characteristics, not evidence by themselves that employees found the system easy to use.

The repository does not provide verified records of a formal usability study or client-feedback session. Therefore, no participant count, satisfaction score or user quotation is reported in this draft. If usability evaluation is conducted, it should use representative tasks such as finding an item’s stock at a branch, recording a goods receipt, completing a sale, posting a daily sales batch, receiving a transfer and locating a report. Participants should represent relevant employee roles, and observations should be recorded consistently. A questionnaire or usability scale may be used if required by the department, but results must be calculated from real responses.

**[IMAGE PLACEHOLDER 7.2: Usability evaluation session or task screen]**

_Add only an approved, genuine image or an anonymised screenshot of the task being evaluated. Do not stage or imply that a session occurred if it did not._

**[TABLE PLACEHOLDER 7.1: Usability task results]**

| Task                                               | Role        | Completed?  | Time / errors | Participant comments | Improvement identified |
| -------------------------------------------------- | ----------- | ----------- | ------------- | -------------------- | ---------------------- |
| Locate stock for an Item Code at a selected branch | To complete | To complete | To complete   | To complete          | To complete            |
| Record a purchase receipt                          | To complete | To complete | To complete   | To complete          | To complete            |
| Post a daily sales batch                           | To complete | To complete | To complete   | To complete          | To complete            |
| Find a branch sales report                         | To complete | To complete | To complete   | To complete          | To complete            |

### 7.2.2 Performance, Security and Reliability

Performance should be measured in a named environment using representative data and a documented method. The available project audits do not provide a complete response-time benchmark or load-test result for the final system. Therefore, this chapter does not claim a quantified performance level. A future or final evaluation can record page-load and query response times for product lookup, dashboard and detailed reports, noting hardware, network, database size and measurement method.

Security verification is supported by role and branch authorization checks, database row-level security, controlled transaction functions and database test suites. Documented database tests cover areas such as branch-scope denial, direct-write denial, idempotency, stock-shortage atomicity, payment rules and reporting reconciliation. However, the historical full-suite database run in Phase 5 failed overall on an accumulated development database with fixture and reconciliation issues. This does not establish that all security tests failed, nor does it provide a clean full-suite pass. A clean isolated database run is needed for a reliable consolidated result.

Reliability is addressed in the design through database transactions, row locks, operation keys, immutable movement history and explicit reversals. Some focused suites passed these workflow cases. At the same time, receipt concurrency stress, mutation-gated purchasing E2E, full regression and a final combined browser suite were not consistently run in the recorded audits. These remain limitations for the final evaluation.

The production build status also needs careful wording. Several build attempts were unable to fetch configured Google Fonts in a restricted network environment, and a later build stopped at a TypeScript subprocess with a Windows `spawn EPERM` error. Typecheck passed in recorded runs, but that is not the same as a verified production build. No staging or production deployment is evidenced by the phase audits.

**[IMAGE PLACEHOLDER 7.3: Test run summary screenshot]**

_Capture a terminal or CI summary from the final test run. Exclude paths or environment values that reveal private information. The image must match the results reported in the tables._

## 7.3 User / Client Feedback

No verified interview notes, questionnaire responses or user-acceptance records were found in the project documents reviewed for this draft. As a result, this section does not claim that the owner, employees or customers tested the application or approved its usability. This is an evidence gap, not a negative finding about the system.

If feedback was gathered, the report should state who participated by role, how participants were selected, which tasks they performed, how comments were recorded, and how privacy was protected. Findings should summarise actual responses and distinguish implemented changes from suggestions that remain future work. If no feedback was gathered, retain this limitation in the final report and recommend a structured user-acceptance evaluation before operational adoption.

**[IMAGE PLACEHOLDER 7.4: Client feedback evidence, if available]**

_Insert an anonymised feedback summary, consented session image or signed acceptance record only if such evidence exists and can be used with permission. Otherwise remove this placeholder and state that client feedback was not formally collected._

## 7.4 Comparison with Initial Requirements

The final evaluation should compare the requirements in Chapter Four with evidence from the final implementation. A requirement should be marked **Met** only when implementation and verification evidence support it. **Partially Met** indicates that some required behaviour exists but an important part is incomplete. **Not Met** indicates the feature is absent or does not satisfy the requirement. **Not Verified** indicates that code or documentation suggests implementation, but adequate test evidence is unavailable.

### 7.4.1 Functional Requirements Traceability

**[TABLE PLACEHOLDER 7.2: Completed functional requirements traceability matrix]**

| Requirement ID | Summary                                   | Evidence source                                  | Test/result                                                                | Status                                  |
| -------------- | ----------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------- |
| FR01–FR03      | Authentication, roles and branch access   | Auth/access modules and RLS tests                | Populate from final run                                                    | Not verified in this consolidated draft |
| FR04–FR07      | Product catalogue and inventory integrity | Catalogue/inventory workflows and database tests | Populate from final run                                                    | Not verified in this consolidated draft |
| FR08–FR09      | Purchasing and goods receiving            | Purchase pages, receipt RPC and purchasing tests | Focused historical suite: 64 assertions passed; rerun final version        | Partially evidenced                     |
| FR10–FR12      | Sales, payments and daily sales batches   | Sales and daily-sales workflows/tests            | Populate from final run; some historical runs blocked                      | Not verified in this consolidated draft |
| FR13           | Inter-branch transfers                    | Transfer lifecycle and database/browser tests    | Historical focused Phase 6 browser suite passed 8/8; confirm final version | Partially evidenced                     |
| FR14           | Expenses and finance                      | Finance/expense routes and Phase 6 audit         | Historical database/browser checks recorded; rerun final version           | Partially evidenced                     |
| FR15–FR17      | Dashboard, reports and exports            | Reporting pages, RPCs and export route           | Dashboard check passed historically; full regression incomplete            | Partially evidenced                     |
| FR18           | Public catalogue/enquiry                  | Public routes and configuration                  | Disabled by default in current configuration                               | Implemented but currently disabled      |
| FR19           | Offline transactions and synchronisation  | No implementation found                          | Not applicable to current scope                                            | Not met / outside current scope         |
| FR20           | Full general ledger/certified accounts    | Not provided by current scope                    | Not applicable to current scope                                            | Not met / outside current scope         |

This draft matrix is provisional. The final status must be aligned with the exact Chapter Four requirement wording and test outcomes from the selected final build. It should not combine results from different historical snapshots without identifying them.

### 7.4.2 Non-Functional Requirements

**[TABLE PLACEHOLDER 7.3: Non-functional requirements evaluation matrix]**

| Quality area                  | Evaluation evidence needed                                         | Provisional observation                                                                 |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Security and branch isolation | Clean database role/RLS tests and denial cases                     | Layered controls are implemented; consolidated final suite needs rerun                  |
| Data integrity                | Atomicity, idempotency, no-negative-stock and reconciliation tests | Focused historical suites passed in some phases; final consolidated evidence incomplete |
| Usability                     | Real task-based evaluation with intended users                     | No verified formal user study found in reviewed documents                               |
| Accessibility                 | Documented keyboard, screen-reader/contrast and responsive checks  | UI provisions exist; complete conformance not established                               |
| Performance                   | Measured timings/load test with environment details                | No quantified final benchmark found                                                     |
| Reliability                   | Transaction failure and concurrency tests                          | Some tests/scripts exist; receipt/concurrency and full regression gaps remain           |
| Maintainability               | Review of module structure and migration history                   | Modular features and timestamped migrations are present in the repository               |
| Recovery                      | Backup restore exercise with recorded result                       | Runbooks exist; a verified restore exercise was not found in the reviewed evidence      |
| Production readiness          | Successful production build and deployment checks                  | Not established by the recorded audits; no deployment is evidenced                      |

## 7.5 Evaluation Summary

The available evidence shows that SAT-J Ent has been tested through several focused unit, database and browser checks during development. These checks provide useful evidence for specific workflows, including item lookup, purchase receipt rules, reporting, transfer behaviour and finance features. The audits also record unresolved failures and environment-related blockers, and they identify missing full-suite, concurrency, user-evaluation and production-build evidence.

It is therefore reasonable to conclude that substantial portions of the system have received focused verification, but the reviewed records do not support a claim that the final combined system has passed every test or is ready for production. The overall project outcome should be evaluated against the final requirements matrix and a coherent test run on the final code version. User acceptance and operational benefit require separate evidence from SAT-J’s staff and records.

## 7.6 Conclusion

This chapter has described the testing strategy and summarised the evidence recorded during development. It separates focused passing checks from full-suite failures, blocked runs and work that was not verified. It also provides placeholders for test summaries, usability evidence and requirement traceability.

The principal evaluation limitation is that historical results refer to different development snapshots and environments. A final rerun should use the exact version described in the report, a clean isolated database for mutation and security tests, and documented browser and build environments. Formal user feedback, performance measurements and a recovery exercise should be added only if they are actually carried out. Chapter Eight will reflect these achievements and limitations when reviewing whether the project aim and objectives were met.

## References cited in Chapter Seven

No new external references are introduced in this chapter. The evaluation summary is based on SAT-J Ent phase audits, test definitions and project documentation. General testing and secure-development concepts are discussed in Chapter Three and Chapter Five.

---

### Items to confirm before finalising this chapter

- Select the exact final code version and rerun the required test matrix against it.
- Run database tests against a clean, isolated database rather than accumulated day-to-day development data.
- Add test execution dates, commands, environment details, totals and logs/screenshots.
- Confirm whether real usability testing, client feedback or user acceptance was performed.
- Decide whether performance benchmarking and backup restoration will be included as project evaluation tasks.
