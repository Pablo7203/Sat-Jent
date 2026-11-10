# Daily Sales Batches

## Purpose

Use a daily sales batch to record end-of-day sales totals when the business has product/quantity/revenue information but is not capturing each individual customer and payment in the system. A batch is not a walk-in customer sale, receipt, collection, credit sale, or receivable.

Continue to use the normal **Sales** workflow when a named customer, receipt, payment method, amount collected, or customer balance must be recorded.

## Who can do what

| Role                | Read                         | Create/edit draft            | Post and deduct stock        | Reverse posted batch         | Backdate                             |
| ------------------- | ---------------------------- | ---------------------------- | ---------------------------- | ---------------------------- | ------------------------------------ |
| Owner / Super Admin | Authorized company scope     | Yes                          | Yes                          | Yes                          | Yes, previous dates only             |
| Branch Manager      | Assigned branches            | Yes                          | Yes                          | No                           | No                                   |
| Other roles         | Only if specifically granted | Only if specifically granted | Only if specifically granted | Only if specifically granted | Owner/Super Admin rule still applies |

Future dates are not allowed for any role. The business date is interpreted in `Africa/Accra`.

## Record the day’s sales

1. Open **Daily sales** in the app navigation and choose **Record daily sales**.
2. Select the branch and sales date. Branch Managers can use the current date; only Owners and Super Admins can choose a previous date.
3. Search for a product by Item Code, product name, or variant and select the exact product/variant sold.
4. Enter the quantity and the actual selling price per unit. The standard retail price is shown as a reference. Users need `sales.price_override` to enter a different actual price.
5. Add each additional product line the same way. The same variant may appear more than once; this preserves separate quantities/prices as entered. The batch total is the sum of all line totals.
6. Save as a draft. A draft can be edited and does not deduct stock or contribute to sales reports.
7. Review the branch, date, lines, prices, quantities, and total. Select **Review and post daily sales** only when the batch is ready to become final.

Posting checks the current branch stock for the combined quantity of each variant. If stock is short, the batch is not posted and no stock movement from that attempted post is kept. Once posted, the batch is locked against commercial edits; it contributes revenue to reporting and deducts its quantities from inventory in one database transaction.

## Additional batches

If more sales need to be recorded for a branch/date that already has a standard batch posted, create an **Additional batch** and provide a short reason (for example, a late till reconciliation). Do not edit or replace the original posted batch just to add late lines. Stock availability is checked again when the additional batch is posted.

Only one **Standard** batch can be posted per branch/date. Additional and correction batches are separately numbered and auditable.

## Correct an error

Posted batches cannot be edited or deleted. An Owner or Super Admin should:

1. Open the posted batch and choose the reversal action.
2. Enter a clear correction reason and confirm. The system retains the original batch, records linked stock-restoration movements, and excludes its revenue from active reports.
3. From the reversed batch, choose **Prepare corrected batch**. The correction draft is linked to the original and starts with its original lines for review; update the quantities and actual prices as needed.
4. Save, review, and post the correction. The correction records new sales revenue and deducts the corrected quantities from stock.

Reversal is not a customer refund or cash payment. Record any actual money returned using the appropriate payment/refund process if one exists for that transaction.

## Inventory and reporting behavior

- Drafts have no inventory or sales-report effect.
- Posting creates one `SALE` stock movement per entered line, including repeated product lines.
- Reversal creates separate `SALE_REVERSAL` movements and restores the posted quantities.
- Stock movement history links back to the daily batch.
- A posted batch is included in sales revenue, branch sales, units sold, trends, top products, and the sales report using the batch’s business date.
- Daily batch revenue does **not** add to cash/bank/MoMo collections, amount paid, customer balances, payment status, or receivables. Those remain based on their actual customer-payment records.
- Backdated revenue is assigned to the selected business date; stock changes only when the batch is posted at the current time.

## Common issues

- **Not enough stock:** reduce/correct the quantity, receive or adjust inventory through the proper workflow, or investigate the stock ledger. The failed post is atomic and can be retried after correction.
- **No standard retail price:** the selected active variant needs a current retail price for that branch/company before it can be entered.
- **Price override denied:** ask an administrator to grant the `sales.price_override` permission if the role is authorized to negotiate prices.
- **Need another batch for the same date:** select Additional batch and provide the reason; do not attempt a second Standard batch.
- **Wrong posted information:** reverse with a reason, then create and post the linked correction. Keep the original batch number for the audit trail.
- **Cannot select an old date:** only Owners and Super Admins may backdate. Future dates are always rejected.
