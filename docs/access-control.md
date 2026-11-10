# Access Control

Phase 8 adds `website.manage`, `quotations.read`, and `quotations.update`. SUPER_ADMIN and OWNER receive all three. BRANCH_MANAGER and SALES receive quotation read/update within branch scope. Anonymous users receive no employee permission; they may execute only public projections and validated quotation submission.

Phase 4 permissions are `suppliers.read/create/update/archive`, `purchases.read/create/update/receive/cancel`, and `supplier_payments.read/create`. SUPER_ADMIN and OWNER receive all. BRANCH_MANAGER receives all except supplier archive. INVENTORY receives supplier read and assigned-branch purchase read/receive. SALES receives none. Operational records additionally require `can_access_branch`.

Phase 5 permissions are `customers.read/create/update/archive`, `sales.read/create/complete/cancel/price_override/discount`, `customer_payments.read/create/reverse`, and `receivables.read`. SUPER_ADMIN and OWNER receive all. BRANCH_MANAGER receives all except customer archive. SALES receives customer read/create/update, sale read/create/complete, payment read/create, and receivables read. INVENTORY receives sale read only. Every operational record remains branch-scoped.

| Capability             | SUPER_ADMIN | OWNER | BRANCH_MANAGER | SALES    | INVENTORY |
| ---------------------- | ----------- | ----- | -------------- | -------- | --------- |
| Access app             | Yes         | Yes   | Yes            | Yes      | Yes       |
| View all branches      | Yes         | Yes   | No             | No       | No        |
| View assigned branches | Yes         | Yes   | Yes            | Yes      | Yes       |
| Manage branches        | Yes         | No    | No             | No       | No        |
| View users             | Yes         | Yes   | No             | No       | No        |
| Manage users           | Yes         | No    | No             | No       | No        |
| View roles             | Yes         | Yes   | No             | No       | No        |
| View audit             | Yes         | Yes   | No             | No       | No        |
| View inventory         | Yes         | Yes   | Assigned       | Assigned | Assigned  |
| Opening stock          | Yes         | Yes   | Assigned       | No       | Assigned  |
| Adjust inventory       | Yes         | Yes   | Assigned       | No       | Assigned  |
| Perform stock counts   | Yes         | Yes   | Assigned       | No       | Assigned  |
| Manage minimum levels  | Yes         | Yes   | Assigned       | No       | Assigned  |

SUPER_ADMIN and OWNER are COMPANY-scoped. BRANCH_MANAGER, SALES, and INVENTORY are BRANCH-scoped and can access only active assignments. Future phases add module-specific permissions through new migrations; role codes remain system-controlled.

Authorization uses three layers: permission-aware UI, independently authorized server code, and mandatory PostgreSQL RLS. An Auth account alone grants nothing. Access requires a verified identity, an existing active profile, a valid role, `app.access`, and an active branch assignment for branch-scoped operations.

Database helpers derive the current user from `auth.uid()`: `has_permission(code)` and `can_access_branch(uuid)`. They accept no arbitrary user ID, use locked search paths, and grant execution only to authenticated users. Inactive users always fail. Audit records are append-only to application users.

## Phase 6 transfer permissions

| Role           | Read               | Create | Approve | Dispatch | Receive     | Cancel |
| -------------- | ------------------ | ------ | ------- | -------- | ----------- | ------ |
| Super Admin    | Yes                | Yes    | Yes     | Yes      | Yes         | Yes    |
| Owner          | Yes                | Yes    | Yes     | Yes      | Yes         | Yes    |
| Branch Manager | Source/destination | Source | Source  | Source   | Destination | Source |
| Inventory      | Source/destination | Source | No      | Source   | Destination | No     |
| Sales          | Source/destination | No     | No      | No       | No          | No     |

Transfer reading requires a relationship to either branch. Release decisions and dispatch belong to the source; receipt belongs exclusively to the destination.
