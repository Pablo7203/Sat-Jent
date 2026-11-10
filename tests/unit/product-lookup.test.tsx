import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ProductLookup,
  type ProductLookupResult,
} from "@/features/inventory/product-lookup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const product: ProductLookupResult = {
  product_id: "product-1",
  variant_id: "variant-1",
  item_code: "TILE-001",
  product_name: "Stone Tile",
  variant_name: "60 × 60 · Grey",
  category_name: "Tiles",
  product_type_name: null,
  brand_name: null,
  unit_name: "Piece",
  unit_code: "PC",
  unit_symbol: "pc",
  allows_decimal: false,
  image_path: null,
  inventory_id: "inventory-1",
  quantity_on_hand: 12,
  minimum_stock_level: 2,
  stock_status: "IN_STOCK",
  standard_selling_price: 100,
  wholesale_selling_price: null,
  branch_breakdown: [],
};

it("keeps a result selectable after the pointer goes down and uses a pointer cursor", async () => {
  const onSelect = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [product] }),
    }),
  );

  render(
    <ProductLookup
      branches={[]}
      onSelect={onSelect}
      showBranchSelector={false}
    />,
  );

  const search = screen.getByRole("combobox", { name: "Search products" });
  fireEvent.change(search, { target: { value: "Stone" } });
  const option = await screen.findByRole("option", { name: /Stone Tile/ });

  const mouseDown = createEvent.mouseDown(option);
  fireEvent(option, mouseDown);
  expect(mouseDown.defaultPrevented).toBe(true);
  expect(option).toHaveClass("cursor-pointer");

  fireEvent.click(option);
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(product));
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
