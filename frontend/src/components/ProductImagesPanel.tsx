import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import {
  deleteProductImage,
  fetchProductImages,
  setPrimaryProductImage,
  uploadProductImage,
} from '../api/products';
import type { ProductImage } from '../types/product';

// Minimal structural type for form submit handlers (avoids the deprecated
// FormEvent / FormEventHandler aliases in @types/react 19).
type SubmitLike = { preventDefault: () => void };

interface Props {
  productId: number;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function ProductImagesPanel({ productId }: Props) {
  const { state } = useAuth();
  const token = state.status === 'authenticated' ? state.token : null;

  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductImages(token, productId);
      setImages(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar imágenes'));
    } finally {
      setLoading(false);
    }
  }, [token, productId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleUpload(e: SubmitLike) {
    e.preventDefault();
    setError(null);
    setFlash(null);

    if (!token) {
      setError('Sesión no válida.');
      return;
    }
    if (!file) {
      setError('Elegí un archivo de imagen.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('El archivo supera el tope de 3MB.');
      return;
    }

    setUploading(true);
    try {
      const img = await uploadProductImage(token, productId, file, altText);
      setFlash(`Imagen subida (id=${img.id}).`);
      setFile(null);
      setAltText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, 'Error al subir la imagen'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(img: ProductImage) {
    if (!token) return;
    if (!window.confirm(`¿Eliminar la imagen #${img.id}?`)) return;

    setError(null);
    setFlash(null);
    setBusyImageId(img.id);
    try {
      await deleteProductImage(token, productId, img.id);
      setFlash(`Imagen eliminada (id=${img.id}).`);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, 'Error al eliminar la imagen'));
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleSetPrimary(img: ProductImage) {
    if (!token) return;
    setError(null);
    setFlash(null);
    setBusyImageId(img.id);
    try {
      await setPrimaryProductImage(token, productId, img.id);
      setFlash(`Imagen marcada como principal (id=${img.id}).`);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, 'Error al marcar principal'));
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <section className="admin-images">
      <h2 className="admin-form__title">Imágenes</h2>

      <form className="admin-images__upload" onSubmit={handleUpload}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />
        <input
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Alt text (opcional)"
          maxLength={200}
          disabled={uploading}
        />
        <button
          type="submit"
          className="btn btn--primary"
          disabled={uploading || !file}
        >
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </button>
      </form>

      {flash && <div className="admin-page__alert admin-page__alert--ok">{flash}</div>}
      {error && <div className="admin-page__alert admin-page__alert--error">{error}</div>}

      {loading ? (
        <div className="state state--loading">Cargando imágenes…</div>
      ) : images.length === 0 ? (
        <div className="state state--empty">Este producto no tiene imágenes todavía.</div>
      ) : (
        <div className="admin-images__grid">
          {images.map((img) => (
            <article key={img.id} className="admin-images__item">
              <div className="admin-images__thumb-wrap">
                <img
                  src={img.url}
                  alt={img.alt_text ?? `Imagen ${img.id}`}
                  className="admin-images__thumb"
                  loading="lazy"
                />
                {img.is_primary && (
                  <span className="admin-images__badge">Principal</span>
                )}
              </div>
              <div className="admin-images__caption">
                {img.alt_text || <em>(sin alt text)</em>}
              </div>
              <div className="admin-images__actions">
                {!img.is_primary && (
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => handleSetPrimary(img)}
                    disabled={busyImageId !== null}
                  >
                    Marcar principal
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--small btn--danger"
                  onClick={() => handleDelete(img)}
                  disabled={busyImageId !== null}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
