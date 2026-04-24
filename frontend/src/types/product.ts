// Shape returned by GET /api/products (listing).
// NOTE: `price` arrives as a string because mysql2 returns DECIMAL columns as
// strings to preserve precision. Parse with parseFloat before arithmetic or
// currency formatting.
export interface ProductSummary {
  id: number;
  name: string;
  price: string;
  stock: number;
  manufacturer: string;
  category: string;
}
