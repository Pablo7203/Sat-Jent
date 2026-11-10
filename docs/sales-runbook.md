# Sales runbook

## Add a customer

Open **Customers**, search by name, phone, or email to avoid an obvious duplicate, then choose **Add customer**. Use a named customer whenever a balance may remain. Authorized management can archive or reactivate normal customers; the Walk-In system record cannot be changed.

## Complete a normal paid sale

Open **Sales**, choose **New sale**, select the branch and customer, add variants and quantities, then save the draft. Review the stored totals. In **Complete sale**, enter the full payment and method, then confirm. Stock is checked again and reduced only at completion. Open **Print receipt** after success.

## Walk-In sale

Select the starred Walk-In Customer for routine retail purchases. Enter full payment at completion. The system rejects any outstanding Walk-In balance.

## Credit or partial-payment sale

Select a named customer and optionally set an explicit due date. Complete with zero for full credit or an amount below the total for partial payment. Review the resulting balance on the sale, customer statement, or **Receivables** page.

## Later payment and overdue review

Open an outstanding sale and choose **Record payment**. Enter an amount no greater than the displayed balance. Multiple payments are preserved separately. Use **Receivables** filters for overdue or no-due-date balances.

## Correct an incorrect payment

Authorized management enters a reversal reason beside the posted payment and chooses **Reverse**. Never edit or delete the payment. Record the corrected payment separately.

## Cancel an erroneous sale

Reverse every posted payment first. Then provide a cancellation reason. The system restores inventory through `SALE_REVERSAL` while retaining the sale, receipt, items, original movements, and payment history. Do not use cancellation for genuine returns or exchanges.
