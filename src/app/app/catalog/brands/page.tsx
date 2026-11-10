import { ReferencePage } from "@/features/catalog/reference-page";
export default function Page() {
  return (
    <ReferencePage
      kind="brand"
      title="Brands"
      table="brands"
      read="brands.read"
      manage="brands.manage"
    />
  );
}
