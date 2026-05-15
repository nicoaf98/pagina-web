// Shape returned by GET /api/products (listing).
// NOTE: `price` arrives as a string because pg returns NUMERIC as string to
// preserve precision. Parse with parseFloat before arithmetic or formatting.
export interface ProductSummary {
  id: number;
  name: string;
  price: string;
  stock: number;
  manufacturer: string;
  category: string;
}

// Shape returned by GET /api/products/:id (public detail).
export interface ProductDetail {
  id: number;
  sku: string;
  part_number: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price: string;
  currency: string;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manufacturer: { id: number; name: string; slug: string };
  category: { id: number; name: string; display_name: string; slug: string };
  images: Array<{
    id: number;
    url: string;
    alt_text: string | null;
    position: number;
    is_primary: boolean;
  }>;
}

// Shape returned by POST/PATCH /api/products[/:id] (admin endpoints).
// Same as ProductDetail but with cost / stock_reserved and no images.
export interface AdminProduct {
  id: number;
  sku: string;
  part_number: string | null;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  price: string;
  cost: string | null;
  currency: string;
  stock: number;
  stock_reserved: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manufacturer: { id: number; name: string; slug: string };
  category: { id: number; name: string; display_name: string; slug: string };
}

// Body for POST /api/products.
export interface ProductCreateInput {
  name: string;
  sku: string;
  price: number;
  category_id: number;
  manufacturer_id: number;
  part_number?: string | null;
  slug?: string;
  short_description?: string | null;
  description?: string | null;
  cost?: number | null;
  currency?: string;
  stock?: number;
  is_active?: boolean;
}

// Body for PATCH /api/products/:id (any subset of the create fields).
export type ProductUpdateInput = Partial<ProductCreateInput>;

// Row returned by GET /api/admin/products (admin listing — active + inactive).
export interface AdminProductRow {
  id: number;
  sku: string;
  part_number: string | null;
  name: string;
  price: string;
  stock: number;
  is_active: boolean;
  manufacturer: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export type BulkScope = 'all' | 'active';

// Body for PATCH /api/admin/products/prices/bulk
export interface BulkPricePayload {
  percentage: number;
  scope: BulkScope;
  round_to?: number;
}

// Response of the same endpoint
export interface BulkPriceResult {
  updated_count: number;
  percentage: number;
  scope: BulkScope;
  round_to: number;
}
