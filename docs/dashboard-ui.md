# Dashboard UI

`/app/dashboard` is the authenticated landing page. SUPER_ADMIN and OWNER receive company KPIs and branch rankings; BRANCH_MANAGER gets the same concepts fixed to an assigned branch; SALES sees sales and collection operations; INVENTORY sees inventory health and transfers.

The filter bar uses an inclusive date range and, for company roles, an optional branch. Branch users cannot select or submit another branch. Cards link to the relevant report or operational queue. Revenue, collections, purchases, and supplier payments remain visibly distinct.

Charts are dependency-free accessible SVG/CSS views with text legends. Layouts collapse to one column, tables scroll horizontally, controls meet the 44-pixel touch target, and routes include skeleton loading and explicit no-data states.
