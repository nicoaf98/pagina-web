import { apiGet } from './client';
import type { ProductSummary } from '../types/product';

export type ProductFilters = {
  search?: string;
  category_id?: number;
  manufacturer_id?: number;
  vehicle_id?: number;
  limit?: number;
  offset?: number;
};

export function fetchProducts(filters: ProductFilters = {}): Promise<ProductSummary[]> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<ProductSummary[]>(`/api/products${suffix}`);
}
