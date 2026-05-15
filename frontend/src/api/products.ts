import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import type {
  AdminProduct,
  AdminProductRow,
  BulkPricePayload,
  BulkPriceResult,
  ProductCreateInput,
  ProductDetail,
  ProductImage,
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

// ----- admin (staff-only) endpoints --------------------------

export interface AdminProductFilters {
  search?: string;
  manufacturer_id?: number;
  category_id?: number;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

export function fetchAdminProducts(
  token: string,
  filters: AdminProductFilters = {}
): Promise<AdminProductRow[]> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<AdminProductRow[]>(`/api/admin/products${suffix}`, { token });
}

export function bulkUpdatePrices(
  token: string,
  payload: BulkPricePayload
): Promise<BulkPriceResult> {
  return apiPatch<BulkPriceResult>('/api/admin/products/prices/bulk', payload, { token });
}

// ----- product images (admin) --------------------------------

export function fetchProductImages(
  token: string,
  productId: number
): Promise<ProductImage[]> {
  return apiGet<ProductImage[]>(`/api/admin/products/${productId}/images`, { token });
}

export function uploadProductImage(
  token: string,
  productId: number,
  file: File,
  altText?: string
): Promise<ProductImage> {
  const fd = new FormData();
  fd.append('file', file);
  if (altText && altText.trim().length > 0) {
    fd.append('alt_text', altText.trim());
  }
  // Pass FormData directly — client.ts skips Content-Type so the browser sets
  // the multipart boundary itself.
  return apiPost<ProductImage>(`/api/admin/products/${productId}/images`, fd, { token });
}

export function deleteProductImage(
  token: string,
  productId: number,
  imageId: number
): Promise<void> {
  return apiDelete<void>(`/api/admin/products/${productId}/images/${imageId}`, { token });
}

export function setPrimaryProductImage(
  token: string,
  productId: number,
  imageId: number
): Promise<ProductImage> {
  return apiPatch<ProductImage>(
    `/api/admin/products/${productId}/images/${imageId}/primary`,
    {},
    { token }
  );
}
