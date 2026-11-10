import { ReferencePage } from "@/features/catalog/reference-page";
export default function Page() {
  return (
    <ReferencePage
      kind="category"
      title="Categories"
      table="categories"
      read="categories.read"
      manage="categories.manage"
    />
  );
}
