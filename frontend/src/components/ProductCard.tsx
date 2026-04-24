import type { ProductSummary } from '../types/product';

interface Props {
  product: ProductSummary;
}

const priceFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function formatPrice(raw: string): string {
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? priceFormatter.format(num) : raw;
}

export function ProductCard({ product }: Props) {
  const outOfStock = product.stock <= 0;

  return (
    <article className="product-card">
      <div className="product-card__category">{product.category}</div>
      <h3 className="product-card__name">{product.name}</h3>
      <div className="product-card__manufacturer">{product.manufacturer}</div>
      <div className="product-card__footer">
        <span className="product-card__price">{formatPrice(product.price)}</span>
        <span
          className={
            outOfStock ? 'product-card__stock product-card__stock--out' : 'product-card__stock'
          }
        >
          {outOfStock ? 'Sin stock' : `Stock: ${product.stock}`}
        </span>
      </div>
    </article>
  );
}
