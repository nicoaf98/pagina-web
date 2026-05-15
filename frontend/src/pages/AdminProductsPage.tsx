import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import {
  createProduct,
  fetchProductById,
  fetchProducts,
  setProductStatus,
  updateProduct,
} from '../api/products';
import type {
  ProductCreateInput,
  ProductSummary,
  ProductUpdateInput,
} from '../types/product';

type Mode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; id: number };

interface FormState {
  name: string;
  sku: string;
  part_number: string;
  price: string;        // kept as string in the input, parsed on submit
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

export function AdminProductsPage() {
  const { state } = useAuth();
  const token = state.status === 'authenticated' ? state.token : null;

  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const reloadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await fetchProducts({ limit: 100 });
      setProducts(data);
    } catch (err) {
      setListError(getErrorMessage(err, 'Error al cargar productos'));
    } finally {
      setListLoading(false);
    }
  }, []);

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

  async function handleSubmit(e: FormEvent) {
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

  async function handleToggleStatus(p: ProductSummary, nextActive: boolean) {
    if (!token) return;
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

      <section className="admin-table-wrap">
        {listLoading ? (
          <div className="state state--loading">Cargando productos…</div>
        ) : products.length === 0 ? (
          <div className="state state--empty">No hay productos activos.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th className="admin-table__num">Precio</th>
                <th className="admin-table__num">Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.manufacturer}</td>
                  <td>{p.category}</td>
                  <td className="admin-table__num">{formatPrice(p.price)}</td>
                  <td className="admin-table__num">{p.stock}</td>
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
                      className="btn btn--small btn--danger"
                      onClick={() => handleToggleStatus(p, false)}
                      disabled={formLoading}
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="admin-page__note">
          Esta tabla solo lista productos activos (limitación del endpoint público).
          Para reactivar un producto desactivado, hay que conocer su id y usar
          <code> PATCH /api/products/:id/status</code> con <code>is_active: true</code>.
        </p>
      </section>
    </div>
  );
}
