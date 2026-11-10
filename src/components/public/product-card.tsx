/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowUpRight, ImageIcon } from "lucide-react";
import type { PublicProductCard } from "@/lib/public-data";
import { formatGhs } from "@/lib/format";

export function ProductCard({
  product,
  compact = false,
}: {
  product: PublicProductCard;
  compact?: boolean;
}) {
  return (
    <article className="group text-[#1d1e19]">
      <Link className="block" href={`/products/${product.slug}`}>
        <div
          className={`relative overflow-hidden rounded-xl bg-[#e7ded0] ${compact ? "aspect-[4/3]" : "aspect-[4/5]"}`}
        >
          {product.image_url ? (
            <img
              alt={product.name}
              className="object-cover transition duration-500 group-hover:scale-[1.025]"
              src={product.image_url}
              style={{ height: "100%", width: "100%" }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[#8a8478]">
              <ImageIcon size={34} />
            </div>
          )}
        </div>
        <div className={compact ? "pt-3" : "pt-4"}>
          <p
            className={`font-semibold uppercase tracking-[0.15em] text-[#6d695f] ${compact ? "text-[10px]" : "text-xs"}`}
          >
            {product.category}
            {product.product_type ? ` · ${product.product_type}` : ""}
          </p>
          <div
            className={`flex items-start justify-between gap-3 ${compact ? "mt-1.5" : "mt-2 gap-4"}`}
          >
            <h2
              className={`font-semibold leading-snug tracking-[-0.025em] ${compact ? "text-base" : "text-xl"}`}
            >
              {product.name}
            </h2>
            <ArrowUpRight
              className="mt-0.5 shrink-0 text-[#6d695f] transition-colors group-hover:text-[#28372c]"
              size={compact ? 16 : 18}
            />
          </div>
          {!compact && product.brand ? (
            <p className="mt-1 text-sm text-[#6d695f]">{product.brand}</p>
          ) : null}
          {!compact && product.description ? (
            <p className="mt-2 line-clamp-1 text-sm text-[#6d695f]">
              {product.description}
            </p>
          ) : !compact ? (
            <p className="mt-2 text-sm text-[#6d695f]">
              View available options
            </p>
          ) : null}
          <div
            className={`flex items-center justify-between gap-3 text-sm ${compact ? "mt-3 text-xs" : "mt-4"}`}
          >
            <span className="inline-flex items-center gap-1.5 text-[#6d695f]">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${product.availability === "Available" ? "bg-[#567151]" : product.availability === "Limited availability" ? "bg-[#9a712e]" : "bg-[#8b574d]"}`}
              />
              {product.availability}
            </span>
            <span className="font-semibold text-[#28372c]">
              {product.price != null
                ? `From ${formatGhs(product.price)}`
                : "Enquire for price"}
            </span>
          </div>
          {!compact ? (
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#28372c]">
              View product <ArrowUpRight aria-hidden="true" size={16} />
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
