import { ReferencePage } from "@/features/catalog/reference-page";
export default function Page() {
  return (
    <ReferencePage
      kind="unit"
      title="Units of measure"
      table="units_of_measure"
      read="units.read"
      manage="units.manage"
    />
  );
}
