export const formatGhs = (amount: number | string) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(
    Number(amount),
  );
