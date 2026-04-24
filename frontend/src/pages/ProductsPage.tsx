import { useEffect, useMemo, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts } from '../api/products';
import type { ProductSummary } from '../types/product';

type Status = 'loading' | 'ok' | 'error';

export function ProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');

  // Debounce search input → debouncedSearch (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Refetch from the backend whenever the debounced search changes
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    fetchProducts(debouncedSearch ? { search: debouncedSearch } : {})
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        setStatus('ok');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // Manufacturer options derived from the current product set
  const manufacturers = useMemo(() => {
    const set = new Set(products.map((p) => p.manufacturer));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [products]);

  // Manufacturer filter is applied client-side (the listing endpoint does not
  // expose manufacturer_id, so we filter by name over the fetched products).
  const visibleProducts = useMemo(() => {
    if (!selectedManufacturer) return products;
    return products.filter((p) => p.manufacturer === selectedManufacturer);
  }, [products, selectedManufacturer]);

  // Reset manufacturer if it no longer exists after a new fetch
  useEffect(() => {
    if (selectedManufacturer && !manufacturers.includes(selectedManufacturer)) {
      setSelectedManufacturer('');
    }
  }, [manufacturers, selectedManufacturer]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>Catálogo de repuestos</h1>
      </header>

      <section className="filters" aria-label="Filtros de productos">
        <input
          type="search"
          className="filters__search"
          placeholder="Buscar por nombre o código"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="filters__select"
          value={selectedManufacturer}
          onChange={(e) => setSelectedManufacturer(e.target.value)}
          aria-label="Filtrar por marca de repuesto"
        >
          <option value="">Todas las marcas</option>
          {manufacturers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </section>

      <main className="page__main">
        {status === 'loading' && <div className="state state--loading">Cargando…</div>}

        {status === 'error' && (
          <div className="state state--error">Error al cargar productos: {error}</div>
        )}

        {status === 'ok' && visibleProducts.length === 0 && (
          <div className="state state--empty">No hay productos para el filtro actual.</div>
        )}

        {status === 'ok' && visibleProducts.length > 0 && (
          <div className="product-grid">
            {visibleProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
