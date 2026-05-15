import { apiGet, apiPatch, apiPost } from './client';
import type {
  AdminProduct,
  ProductCreateInput,
  ProductDetail,
  ProductSummary,
  ProductUpdateInput,
} from '../types/product';

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

export function fetchProductById(id: number): Promise<ProductDetail> {
  return apiGet<ProductDetail>(`/api/products/${id}`);
}

export function createProduct(
  token: string,
  payload: ProductCreateInput
): Promise<AdminProduct> {
  return apiPost<AdminProduct>('/api/products', payload, { token });
}

export function updateProduct(
  token: string,
  id: number,
  payload: ProductUpdateInput
): Promise<AdminProduct> {
  return apiPatch<AdminProduct>(`/api/products/${id}`, payload, { token });
}

export function setProductStatus(
  token: string,
  id: number,
  is_active: boolean
): Promise<AdminProduct> {
  return apiPatch<AdminProduct>(`/api/products/${id}/status`, { is_active }, { token });
}
