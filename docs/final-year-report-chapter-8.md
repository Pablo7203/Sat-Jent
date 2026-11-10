# CHAPTER EIGHT: CONCLUSIONS AND CRITICAL REVIEW

_Working draft based on the current SAT-J Ent implementation and development audits. Final claims about requirement completion, user acceptance and business impact should be updated after the final test run and any stakeholder evaluation._

## 8.1 Summary of Key Findings

This project concerns SAT-J, an existing Ghanaian building-materials retailer and distributor operating three branches, and the development of SAT-J Ent to help digitise its operations. The system brings together a range of operational functions in one web application, including employee access control, product and variant management, branch inventory, purchasing and goods receiving, sales and payments, daily sales batches, inter-branch transfers, expenses, financial accounts and reporting.

The project’s main technical finding is that these functions can be organised within a modular web application while keeping PostgreSQL as the authoritative business data layer. Branch-aware access, row-level security, controlled transaction functions and an immutable stock movement history are used to protect important records. Purchase receipt, sale completion and transfer workflows each apply their inventory effects at specific points in the business process. This design supports traceability and reduces the risk of partial or duplicated transaction effects when the relevant operations are verified as intended.

The system also distinguishes events that are easy to confuse in management reporting. Sales revenue is separate from money collected; daily sales batches are separate from individual customer sales and receivables; and stock in transit is separate from stock available at either branch. Where historical inventory cost information is incomplete, the finance features can report an incomplete result instead of estimating profit from unsupported data. These choices improve the clarity of system outputs, even if they mean that some historic records cannot yet contribute to a complete profitability calculation.

The project audits record successful focused tests for selected product, inventory, purchasing, reporting, transfer and finance workflows. They also record blocked test runs, full-suite failures against accumulated local data, and checks that were not performed. Because these results span different implementation snapshots, they do not establish that the final combined system has passed every test. Formal user feedback, final performance benchmarks, a verified production build and production deployment are also not established by the reviewed project evidence.

## 8.2 Critical Reflection on Project Outcomes

The project has produced a substantial working codebase and detailed transaction design for a three-branch business. One strength is the use of shared data structures across related operations. Products and variants are referenced by inventory, purchases, sales and transfers; this gives the application a consistent operational identity for items. The movement ledger preserves how stock changes rather than relying only on an editable quantity. The use of permissions and branch assignments also reflects the fact that company management and branch employees do not necessarily need the same access.

Another strength is that the implementation treats workflow state and transaction timing as part of the business design. A purchase order does not create stock before goods are received, a draft sale does not reduce stock, and a transfer does not increase destination stock until it is received. Posting operations are designed to validate data and update dependent records together. These decisions help the system represent what has actually happened in the business, not just what a user intended to happen.

The project also has limitations. First, the report currently has limited primary evidence about SAT-J’s former processes and staff needs. The application repository shows what has been implemented, but it does not prove the original frequency or impact of stock inaccuracies, delays, duplicate entry or reporting difficulties. Those claims require confirmation from the business. Second, automated tests provide technical evidence for specific cases, but they cannot substitute for user evaluation or prove operational benefits such as reduced time or fewer errors. Third, final test results are not yet consolidated against one code version and clean environment. The distinction between historical focused passes and current final verification must be retained.

In scope terms, SAT-J Ent is an operational management platform with selected finance capabilities. It is not an offline-first system and does not provide a complete certified accounting package. Public catalogue and enquiry functionality is retained but disabled by default in the current configuration. Some finance extensions, including bank-statement import/matching and an expense receipt upload interaction, remain future work. These boundaries do not invalidate the current implementation, but they should inform how the system is described and whether it is ready for business-wide operational use.

## 8.3 Challenges Faced and Solutions

### Inventory consistency

A central challenge was ensuring that operational workflows and stock balances remained consistent across branches. Direct balance editing would make it difficult to trace changes or establish why the system shows a given quantity. The design instead uses controlled movement workflows and a ledger that records the effects of opening stock, adjustments, counts, purchase receipts, sales and transfers. Row locking and transaction functions are used for critical multi-record updates. The remaining evaluation task is to verify these controls against the final version, including relevant concurrency cases.

### Branch-aware authorization

The application needs to support both company-level and branch-level roles. A branch selected in a browser cannot be trusted as proof of authorization, so the system checks permissions in server code and uses database policies and functions to repeat the security boundary. This layered model is more complex than hiding navigation links, but it is appropriate where records from separate locations must be restricted. A clean final database test run should confirm both permitted access and denial of unauthorised cross-branch requests.

### Distinguishing revenue from payment

Daily sales batches capture aggregate product, quantity and revenue information without claiming individual customer or payment details. Treating a batch as an ordinary walk-in sale would risk creating false payment or receivable information. The system therefore uses a separate batch workflow and keeps batch revenue separate from customer collections. This solution required explicit reporting rules and testing to ensure that drafts, reversals and posted batches are handled correctly.

### Incomplete historical costs

Some historical stock and transaction records do not provide enough evidence to calculate cost reliably. The finance design preserves an unknown or incomplete cost state rather than substituting a current price or an invented value. While this limits profitability reporting for some periods, it avoids false precision. Historical reconciliation and documented opening cost baselines may be required if the business wants more complete retrospective reporting.

### Verification constraints

The audits document technical and environmental constraints during testing, including Windows process-spawn errors, restricted access to Google Fonts during a production build, Supabase CLI telemetry-file permission issues, and fixture interference in an accumulated local database. These constraints explain why some checks were blocked or unreliable. They do not count as successful verification. A clean isolated database and a consolidated final test matrix are needed to reduce uncertainty.

## 8.4 Lessons Learned

One lesson from the project is that the data model should reflect the business event being recorded. Purchase ordering, physical receiving, sale completion, payment, dispatch and receipt may be related, but they are separate events. Keeping them distinct makes reports and history more meaningful.

A second lesson is that security and data integrity need to be part of architecture and implementation. User-interface restrictions are helpful for guiding staff, but sensitive actions also need server-side and database-level checks. The three-branch setting makes it especially important to test both access that should be allowed and access that should be denied.

The project also shows the importance of evidence in evaluation. A feature being present in the source code does not demonstrate that it works in the final environment, and passing automated tests does not demonstrate that users understand the interface. A stronger evaluation combines requirements traceability, clean technical testing, real user feedback and operational measures where the system is used.

If the project were repeated, stakeholder process mapping and test-environment planning should happen earlier. In particular, maintaining isolated and reproducible test data would make database and end-to-end results easier to interpret. Usability evaluation and a final requirement review should also be scheduled before the documentation stage, rather than treated as optional work at the end.

## 8.5 Recommendations for Future Work

The following recommendations are based on the documented implementation gaps and evaluation limitations:

1. **Validate workflows with SAT-J staff.** Confirm how products, purchases, sales, payments, stock counts and transfers are currently handled at all three branches, then review whether the system matches those processes.
2. **Complete a clean final verification run.** Use an isolated database, the exact final code version and a documented environment. Run unit, database security/workflow, browser, concurrency and production-build checks, and report each result separately.
3. **Conduct task-based usability evaluation.** Involve representative roles such as owner, branch manager, sales employee and inventory employee. Record completed tasks, difficulties and suggested improvements with consent and appropriate anonymisation.
4. **Measure operational outcomes after controlled use.** If SAT-J pilots the system, establish a baseline and measure indicators such as time to locate branch stock, stock reconciliation differences, receipt-posting time, or report preparation time. Do not claim improvements until comparable measurements are available.
5. **Improve historical data readiness.** Review product identifiers, opening stock and historical cost evidence before relying on long-period profitability reports. Preserve uncertainty where records cannot support a reliable value.
6. **Complete finance extensions according to business need.** Consider bank-statement import and matching, inter-account transfers, receipt upload/view, report exports and historical payment reconciliation as separate, tested features.
7. **Review production operations before live adoption.** Confirm backups, recovery procedure, monitoring, access administration, training, support ownership and staging release checks. A documented recovery exercise should be completed before relying on backups.
8. **Assess connectivity requirements with the business.** The current application requires an online connection for server-backed operations. If offline transactions become a requirement, design and test conflict handling, duplicate prevention, data protection on devices and synchronisation before claiming offline support.

## 8.6 Project Expansion Opportunities

Future development could extend SAT-J Ent based on evidence from business use. Possible areas include product-level margin analysis where cost data is complete, bank reconciliation workflows, supplier and purchasing analysis, improved finance exports, and richer operational alerts. A barcode-scanning workflow could also be assessed if it addresses a demonstrated product lookup or stocktake need.

The system could also be evaluated for expansion beyond the current three branches, but this should follow assessment of performance, access management, data quality and support requirements. Any expansion should build on a stable and verified implementation rather than assuming that adding more branches is only a configuration change. Public catalogue and enquiry features may be re-enabled if SAT-J decides that they support its business goals and the necessary security and content reviews are completed.

Offline capability is a further possible research and development area, but it would require a distinct design. It would need to specify which data is cached, how stale stock is presented, how conflicting sales are resolved, how duplicate submissions are prevented, and what happens if a device is lost before synchronisation. It should not be treated as a small interface enhancement.

## 8.7 Conclusion

SAT-J Ent provides a substantial technical foundation for digitising operations at SAT-J’s three branches. Its implemented areas connect product, inventory, purchasing, sales, transfers, finance and reporting, while applying role and branch controls and preserving transaction history. The project demonstrates how business rules can be represented in both the application and database layers.

The evidence reviewed supports the conclusion that important workflows have been implemented and some have received focused testing. It does not yet support claims of full production readiness, formal user acceptance or measured business improvement. The project aim can therefore be described as substantially addressed at the implementation level, subject to final requirement validation and consolidated testing. Further stakeholder evaluation and a controlled operational pilot would be needed to determine the system’s practical impact on SAT-J’s daily work.

## References cited in Chapter Eight

No new external references are introduced in this chapter. The critical review is based on SAT-J Ent implementation records, audit documents and the testing evidence summarised in Chapter Seven.

---

### Items to confirm before finalising this chapter

- The final requirement statuses after the Chapter Seven traceability matrix is completed.
- Whether SAT-J staff reviewed or used the application and what evidence can be reported.
- Whether a final clean test and build matrix has been run on the selected release.
- Whether the system has been piloted or deployed and what operational evidence exists.
