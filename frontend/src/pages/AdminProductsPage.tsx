import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import {
  bulkUpdatePrices,
  createProduct,
  fetchAdminProducts,
  fetchProductById,
  setProductStatus,
  updateProduct,
  type AdminProductFilters,
} from '../api/products';
import type {
  AdminProductRow,
  BulkScope,
  ProductCreateInput,
  ProductUpdateInput,
} from '../types/product';
import { ProductImagesPanel } from '../components/ProductImagesPanel';

// Minimal structural type for form submit handlers. Avoids React 19's
// @deprecated FormEvent / FormEventHandler aliases; we only call
// preventDefault() so this is exactly what we need and stays type-safe.
type SubmitLike = { preventDefault: () => void };

type Mode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; id: number };

type StatusFilter = 'all' | 'active' | 'inactive';

interface FormState {
  name: string;
  sku: string;
  part_number: string;
  price: string;
  stock: string;
  manufacturer_id: string;
  category_id: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  part_number: '',
  price: '',
  stock: '0',
  manufacturer_id: '',
  category_id: '',
  is_active: true,
};

interface BulkFormState {
  percentage: string;
  scope: BulkScope;
  round_to: string;
}

const EMPTY_BULK: BulkFormState = {
  percentage: '',
  scope: 'active',
  round_to: '1',
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

const priceFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function formatPrice(raw: string): string {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? priceFormatter.format(n) : raw;
}

function statusFilterToParam(s: StatusFilter): boolean | undefined {
  if (s === 'active') return true;
  if (s === 'inactive') return false;
  return undefined;
}

export function AdminProductsPage() {
  const { state } = useAuth();
  const token = state.status === 'authenticated' ? state.token : null;

  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [bulkForm, setBulkForm] = useState<BulkFormState>(EMPTY_BULK);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const reloadList = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    setListError(null);
    try {
      const filters: AdminProductFilters = { limit: 200 };
      const isActive = statusFilterToParam(statusFilter);
      if (isActive !== undefined) filters.is_active = isActive;
      const data = await fetchAdminProducts(token, filters);
      setProducts(data);
    } catch (err) {
      setListError(getErrorMessage(err, 'Error al cargar productos'));
    } finally {
      setListLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  function startCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFlash(null);
    setMode({ kind: 'create' });
  }

  async function startEdit(id: number) {
    setFormError(null);
    setFlash(null);
    setFormLoading(true);
    try {
      const p = await fetchProductById(id);
      setForm({
        name: p.name,
        sku: p.sku,
        part_number: p.part_number ?? '',
        price: p.price,
        stock: String(p.stock),
        manufacturer_id: String(p.manufacturer.id),
        category_id: String(p.category.id),
        is_active: p.is_active,
      });
      setMode({ kind: 'edit', id });
    } catch (err) {
      setListError(getErrorMessage(err, 'Error al cargar el producto a editar'));
    } finally {
      setFormLoading(false);
    }
  }

  function cancelForm() {
    setMode({ kind: 'list' });
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function validateForm(): string | null {
    if (form.name.trim().length === 0) return 'El nombre es obligatorio.';
    if (form.sku.trim().length === 0) return 'El SKU es obligatorio.';
    const priceNum = Number.parseFloat(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return 'El precio debe ser un número ≥ 0.';
    const stockNum = Number.parseInt(form.stock, 10);
    if (!Number.isInteger(stockNum) || stockNum < 0) return 'El stock debe ser un entero ≥ 0.';
    const manufacturerId = Number.parseInt(form.manufacturer_id, 10);
    if (!Number.isInteger(manufacturerId) || manufacturerId <= 0) {
      return 'manufacturer_id debe ser un entero positivo.';
    }
    const categoryId = Number.parseInt(form.category_id, 10);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return 'category_id debe ser un entero positivo.';
    }
    return null;
  }

  async function handleSubmit(e: SubmitLike) {
    e.preventDefault();
    setFormError(null);
    setFlash(null);

    if (!token) {
      setFormError('Sesión no válida.');
      return;
    }
    const validation = validateForm();
    if (validation) {
      setFormError(validation);
      return;
    }

    const payload: ProductCreateInput = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      part_number: form.part_number.trim() === '' ? null : form.part_number.trim(),
      price: Number.parseFloat(form.price),
      stock: Number.parseInt(form.stock, 10),
      manufacturer_id: Number.parseInt(form.manufacturer_id, 10),
      category_id: Number.parseInt(form.category_id, 10),
      is_active: form.is_active,
    };

    setFormLoading(true);
    try {
      if (mode.kind === 'create') {
        const created = await createProduct(token, payload);
        setFlash(`Producto creado: ${created.name} (id=${created.id}).`);
      } else if (mode.kind === 'edit') {
        const updates: ProductUpdateInput = payload;
        const updated = await updateProduct(token, mode.id, updates);
        setFlash(`Producto actualizado: ${updated.name} (id=${updated.id}).`);
      }
      setMode({ kind: 'list' });
      setForm(EMPTY_FORM);
      await reloadList();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Error al guardar el producto'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleStatus(p: AdminProductRow) {
    if (!token) return;
    const nextActive = !p.is_active;
    setFlash(null);
    setListError(null);
    try {
      await setProductStatus(token, p.id, nextActive);
      setFlash(
        nextActive
          ? `Producto reactivado: ${p.name} (id=${p.id}).`
          : `Producto desactivado: ${p.name} (id=${p.id}).`
      );
      await reloadList();
    } catch (err) {
      setListError(getErrorMessage(err, 'Error al cambiar el estado'));
    }
  }

  async function handleBulkSubmit(e: SubmitLike) {
    e.preventDefault();
    setBulkError(null);
    setFlash(null);

    if (!token) {
      setBulkError('Sesión no válida.');
      return;
    }

    const percentage = Number.parseFloat(bulkForm.percentage);
    if (!Number.isFinite(percentage)) {
      setBulkError('Ingresá un porcentaje numérico (puede ser negativo).');
      return;
    }
    if (percentage <= -100) {
      setBulkError('El porcentaje debe ser mayor a -100.');
      return;
    }
    const roundTo = Number.parseInt(bulkForm.round_to, 10);
    if (!Number.isInteger(roundTo) || roundTo <= 0) {
      setBulkError('round_to debe ser un entero positivo (usá 1 para redondear a entero).');
      return;
    }

    const scopeLabel = bulkForm.scope === 'active' ? 'productos activos' : 'TODOS los productos (incluye inactivos)';
    const sign = percentage >= 0 ? `un ${percentage}%` : `un ${Math.abs(percentage)}%`;
    const verb = percentage >= 0 ? 'aumentar' : 'reducir';
    const ok = window.confirm(
      `¿Seguro que querés ${verb} ${scopeLabel} ${sign} (round_to=${roundTo})?`
    );
    if (!ok) return;

    setBulkLoading(true);
    try {
      const result = await bulkUpdatePrices(token, {
        percentage,
        scope: bulkForm.scope,
        round_to: roundTo,
      });
      setFlash(
        `Aumento aplicado: ${result.updated_count} producto(s) actualizado(s) (` +
          `percentage=${result.percentage}, scope=${result.scope}, round_to=${result.round_to}).`
      );
      setBulkForm(EMPTY_BULK);
      await reloadList();
    } catch (err) {
      setBulkError(getErrorMessage(err, 'Error al aplicar el aumento'));
    } finally {
      setBulkLoading(false);
    }
  }

  const isFormOpen = mode.kind !== 'list';

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Admin · Productos</h1>
        {!isFormOpen && (
          <button type="button" className="btn btn--primary" onClick={startCreate}>
            Nuevo producto
          </button>
        )}
      </header>

      {flash && <div className="admin-page__alert admin-page__alert--ok">{flash}</div>}
      {listError && (
        <div className="admin-page__alert admin-page__alert--error">{listError}</div>
      )}

      {/* ---- Bulk price update ---------------------------------- */}
      <section className="admin-bulk">
        <h2 className="admin-form__title">Aumento masivo de precios</h2>
        <form onSubmit={handleBulkSubmit}>
          <div className="admin-form__row">
            <label className="admin-form__field">
              <span>Porcentaje (%) *</span>
              <input
                type="number"
                step="0.01"
                value={bulkForm.percentage}
                onChange={(e) => setBulkForm({ ...bulkForm, percentage: e.target.value })}
                disabled={bulkLoading}
                placeholder="ej. 10  o  -5"
                required
              />
              <small className="admin-form__hint">
                Positivo aumenta, negativo reduce. Debe ser &gt; -100.
              </small>
            </label>

            <label className="admin-form__field">
              <span>Alcance *</span>
              <select
                value={bulkForm.scope}
                onChange={(e) =>
                  setBulkForm({ ...bulkForm, scope: e.target.value as BulkScope })
                }
                disabled={bulkLoading}
              >
                <option value="active">Solo activos</option>
                <option value="all">Todos (incluye inactivos)</option>
              </select>
            </label>

            <label className="admin-form__field">
              <span>Redondear a (round_to)</span>
              <input
                type="number"
                step="1"
                min="1"
                value={bulkForm.round_to}
                onChange={(e) => setBulkForm({ ...bulkForm, round_to: e.target.value })}
                disabled={bulkLoading}
              />
              <small className="admin-form__hint">
                1 = entero, 100 = múltiplos de 100, etc.
              </small>
            </label>
          </div>

          {bulkError && (
            <div className="admin-page__alert admin-page__alert--error">{bulkError}</div>
          )}

          <div className="admin-form__actions">
            <button type="submit" className="btn btn--primary" disabled={bulkLoading}>
              {bulkLoading ? 'Aplicando…' : 'Aplicar aumento'}
            </button>
          </div>
        </form>
      </section>

      {/* ---- Create / edit form -------------------------------- */}
      {isFormOpen && (
        <section className="admin-form">
          <h2 className="admin-form__title">
            {mode.kind === 'create' ? 'Nuevo producto' : `Editar producto #${mode.id}`}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="admin-form__row">
              <label className="admin-form__field">
                <span>Nombre *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </label>

              <label className="admin-form__field">
                <span>SKU *</span>
                <input
                  type="text"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </label>
            </div>

            <div className="admin-form__row">
              <label className="admin-form__field">
                <span>Part number</span>
                <input
                  type="text"
                  value={form.part_number}
                  onChange={(e) => setForm({ ...form, part_number: e.target.value })}
                  disabled={formLoading}
                />
              </label>

              <label className="admin-form__field">
                <span>Precio (ARS) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </label>

              <label className="admin-form__field">
                <span>Stock *</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  disabled={formLoading}
                  required
                />
              </label>
            </div>

            <div className="admin-form__row">
              <label className="admin-form__field">
                <span>Manufacturer ID *</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.manufacturer_id}
                  onChange={(e) => setForm({ ...form, manufacturer_id: e.target.value })}
                  disabled={formLoading}
                  required
                />
                <small className="admin-form__hint">
                  Ej: 1=Bosch, 2=Ferodo, 3=SKF, 4=NGK, 5=Mahle, 6=Fram, 7=Gates, 8=Monroe, 9=Moura, 10=Valeo
                </small>
              </label>

              <label className="admin-form__field">
                <span>Category ID *</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  disabled={formLoading}
                  required
                />
                <small className="admin-form__hint">
                  Ej: 6=Filtros, 7=Encendido, 10=Pastillas de freno, 12=Amortiguadores, 14=Baterías
                </small>
              </label>
            </div>

            <div className="admin-form__row">
              <label className="admin-form__field admin-form__field--check">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  disabled={formLoading}
                />
                <span>Activo</span>
              </label>
            </div>

            {formError && (
              <div className="admin-page__alert admin-page__alert--error">{formError}</div>
            )}

            <div className="admin-form__actions">
              <button type="submit" className="btn btn--primary" disabled={formLoading}>
                {formLoading ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={cancelForm}
                disabled={formLoading}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      {mode.kind === 'edit' && <ProductImagesPanel productId={mode.id} />}

      {/* ---- Status filter ------------------------------------- */}
      <div className="admin-page__filter">
        {(['all', 'active', 'inactive'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            className={
              statusFilter === opt
                ? 'admin-page__filter-btn admin-page__filter-btn--active'
                : 'admin-page__filter-btn'
            }
            onClick={() => setStatusFilter(opt)}
          >
            {opt === 'all' ? 'Todos' : opt === 'active' ? 'Activos' : 'Inactivos'}
          </button>
        ))}
      </div>

      {/* ---- Products table ----------------------------------- */}
      <section className="admin-table-wrap">
        {listLoading ? (
          <div className="state state--loading">Cargando productos…</div>
        ) : products.length === 0 ? (
          <div className="state state--empty">No hay productos para el filtro seleccionado.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th className="admin-table__num">Precio</th>
                <th className="admin-table__num">Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.is_active ? '' : 'admin-table__row--inactive'}>
                  <td>{p.id}</td>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.manufacturer}</td>
                  <td>{p.category}</td>
                  <td className="admin-table__num">{formatPrice(p.price)}</td>
                  <td className="admin-table__num">{p.stock}</td>
                  <td>
                    <span
                      className={
                        p.is_active
                          ? 'admin-status admin-status--active'
                          : 'admin-status admin-status--inactive'
                      }
                    >
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => startEdit(p.id)}
                      disabled={formLoading}
                    >
                      Editar
                    </button>{' '}
                    <button
                      type="button"
                      className={p.is_active ? 'btn btn--small btn--danger' : 'btn btn--small'}
                      onClick={() => handleToggleStatus(p)}
                      disabled={formLoading}
                    >
                      {p.is_active ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
