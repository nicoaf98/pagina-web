# Car Parts B2B Store

## 1. Descripción del proyecto

Tienda online B2B de repuestos de autos orientada al mercado argentino. Soporta clientes **retail**, **mayoristas** y **talleres**, con un catálogo jerárquico de categorías, marcas de vehículos y marcas de repuestos, compatibilidad producto ↔ vehículo por generación (rango de años + motor + trim + body type), e inventario de órdenes con máquina de estados y cancelación/devolución con restauración de stock.

Este repo contiene por ahora la **capa de base de datos** y el **backend REST** (Node.js + Express + MySQL). El frontend aún no se construyó.

## 2. Stack actual

- **Runtime**: Node.js ≥ 18
- **Framework**: Express 4
- **Base de datos**: MySQL 8.0.16 o superior (requerido para que los CHECK constraints del schema se apliquen)
- **Driver**: `mysql2` (pool de conexiones + placeholders `?`)
- **Dev tooling**: `nodemon`
- **Infra de desarrollo**: Docker (contenedor único de MySQL)

## 3. Levantar MySQL con Docker

Desde la raíz del proyecto:

```bash
docker run -d \
  --name car-parts-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -p 3306:3306 \
  -v car-parts-data:/var/lib/mysql \
  mysql:8.0
```

- `car-parts-mysql` es el nombre del contenedor.
- `rootpass` es el password del usuario `root` (usado también en el `.env` del backend).
- El volumen `car-parts-data` persiste los datos entre reinicios.

Verificar que está corriendo:

```bash
docker ps --filter name=car-parts-mysql
```

Debería mostrar estado `Up N seconds`. Esperá ~10-15 segundos a que MySQL termine de inicializar antes de cargar el schema. Podés ver el progreso con:

```bash
docker logs --tail 20 car-parts-mysql
```

Cuando aparezca `ready for connections` en el log, está listo.

## 4. Cargar schema y seed

Desde la raíz del proyecto (donde está la carpeta `database/`):

```bash
docker exec -i car-parts-mysql mysql -uroot -prootpass < database/schema.sql
docker exec -i car-parts-mysql mysql -uroot -prootpass < database/seed.sql
```

`schema.sql` ya incluye `CREATE DATABASE IF NOT EXISTS car_parts` y `USE car_parts`, así que no hace falta crear la base a mano.

Verificar que quedó cargado:

```bash
docker exec -it car-parts-mysql mysql -uroot -prootpass -e \
  "USE car_parts; SELECT COUNT(*) AS productos FROM products; SELECT COUNT(*) AS ordenes FROM orders;"
```

Deberías ver 15 productos y 3 órdenes.

## 5. Configurar backend

```bash
cd backend
cp .env.example .env
```

Editar `.env` y ajustar al menos `DB_PASSWORD` para que matchee el del contenedor:

| Variable | Descripción | Valor sugerido |
|---|---|---|
| `PORT` | Puerto del backend | `3000` |
| `NODE_ENV` | Modo de ejecución | `development` |
| `DB_HOST` | Host MySQL | `localhost` |
| `DB_PORT` | Puerto MySQL | `3306` |
| `DB_USER` | Usuario MySQL | `root` |
| `DB_PASSWORD` | Password MySQL | `rootpass` (match con el docker run) |
| `DB_NAME` | Nombre de la base | `car_parts` |
| `DB_CONNECTION_LIMIT` | Tamaño del pool | `10` |

## 6. Instalar y correr backend

```bash
cd backend
npm install
npm run dev
```

Output esperado:

```
[db] MySQL connection ok
[server] listening on http://localhost:3000
```

Si aparece `[db] MySQL unreachable at startup`, revisá que Docker esté corriendo, que el password coincida y que el puerto 3306 no esté ocupado por otro MySQL local.

Para modo productivo (sin recarga automática):

```bash
npm start
```

## 7. Endpoints disponibles

| Método | Path | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio y conexión a MySQL |
| GET | `/api/products` | Listado con filtros `search`, `category_id`, `manufacturer_id`, `vehicle_id`, `limit`, `offset` |
| GET | `/api/products/:id` | Detalle con manufacturer, category e imágenes |
| GET | `/api/products/:id/compatibility` | Vehículos compatibles |
| GET | `/api/vehicle-brands` | Marcas de vehículos activas |
| GET | `/api/vehicle-models` | Modelos (filtro opcional `brand_id`) |
| GET | `/api/vehicles` | Vehículos con filtros `brand_id`, `model_id`, `engine_id`, `year` |
| POST | `/api/orders` | Crear orden (transaccional, valida stock, descuenta stock) |
| GET | `/api/orders` | Listado paginado con filtros `customer_email`, `payment_status`, `fulfillment_status`, `date_from`, `date_to`, `limit`, `offset` |
| GET | `/api/orders/:id` | Detalle con items |
| POST | `/api/orders/:id/cancel` | Cancela una orden (bloquea si está `shipped` o `delivered`) y restaura stock |
| PATCH | `/api/orders/:id/status` | Transiciona el estado de fulfillment según la máquina de estados |

## 8. Ejemplos curl

### Health

```bash
curl -s http://localhost:3000/api/health | jq
```

### Listar productos

```bash
# Todos (paginado, default limit=50)
curl -s http://localhost:3000/api/products | jq

# Por texto
curl -s 'http://localhost:3000/api/products?search=bosch' | jq

# Compatibles con el vehículo id=1 (Fiesta Kinetic)
curl -s 'http://localhost:3000/api/products?vehicle_id=1' | jq

# Combinado
curl -s 'http://localhost:3000/api/products?manufacturer_id=2&category_id=10' | jq
```

### Crear pedido

```bash
curl -s -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customer_name": "Test Cliente",
    "customer_email": "cliente@example.com",
    "customer_phone": "+54 11 1234-5678",
    "items": [
      { "product_id": 1, "quantity": 2 },
      { "product_id": 4, "quantity": 1 }
    ]
  }' | jq '{id, order_code, total, fulfillment_status, items: (.items | length)}'
```

Anotá el `id` devuelto: lo vas a usar en los siguientes ejemplos (reemplazando `<ID>`).

### Cambiar estado de pedido

La máquina de estados solo permite esta secuencia:

```
not_shipped → preparing → shipped → delivered → returned
```

```bash
curl -s -X PATCH http://localhost:3000/api/orders/<ID>/status \
  -H 'Content-Type: application/json' \
  -d '{"fulfillment_status":"preparing"}' | jq '{id, fulfillment_status}'

curl -s -X PATCH http://localhost:3000/api/orders/<ID>/status \
  -H 'Content-Type: application/json' \
  -d '{"fulfillment_status":"shipped"}' | jq '{id, fulfillment_status}'

curl -s -X PATCH http://localhost:3000/api/orders/<ID>/status \
  -H 'Content-Type: application/json' \
  -d '{"fulfillment_status":"delivered"}' | jq '{id, fulfillment_status}'

# Este último paso restaura el stock de los productos de la orden
curl -s -X PATCH http://localhost:3000/api/orders/<ID>/status \
  -H 'Content-Type: application/json' \
  -d '{"fulfillment_status":"returned"}' | jq '{id, fulfillment_status}'
```

### Cancelar pedido

Solo funciona si el estado actual no es `shipped` ni `delivered`. Restaura el stock.

```bash
curl -s -X POST http://localhost:3000/api/orders/<ID>/cancel \
  | jq '{id, fulfillment_status}'
```

## 9. Notas importantes

- **DECIMAL como string**: `mysql2` devuelve columnas `DECIMAL(12,2)` (precios, totales, IVA, descuentos) como strings para preservar precisión. El frontend tiene que hacer `parseFloat()` antes de operar aritméticamente o formatear moneda.
- **Transacciones en órdenes**: `POST /api/orders`, `POST /api/orders/:id/cancel` y `PATCH /api/orders/:id/status` usan `BEGIN / COMMIT / ROLLBACK` y `SELECT ... FOR UPDATE` para prevenir sobreventa (overselling) y dobles transiciones bajo concurrencia. Cualquier error en el medio dispara `ROLLBACK` y ninguna mutación persiste.
- **Stock**:
  - Al **crear** una orden: `stock = stock - quantity` por cada línea.
  - Al **cancelar** una orden: `stock = stock + quantity` por cada línea.
  - Al transicionar a **`returned`**: también restaura (`stock + quantity`).
- **Cancelación bloqueada en estados finales de envío**: `cancelOrder` devuelve 400 si la orden ya está `shipped` o `delivered`. Esos casos se tramitan por el flujo de `returned`.
- **Estados terminales**: `returned` y `cancelled`. Ninguna transición sale de ahí.
- **`payment_status` no se modifica automáticamente**. Ni al crear, ni al cancelar, ni al cambiar fulfillment. La integración con la pasarela de pagos no está implementada.
- **Snapshots en `order_items`**: el nombre y SKU del producto se guardan en `product_name_snapshot` y `product_sku_snapshot` al crear la orden, así los pedidos históricos siguen siendo legibles aunque el producto cambie de nombre o se dé de baja.
- **IVA**: los precios en `products.price` están cargados con IVA 21% incluido. `orders.tax_amount` es informativo (la porción IVA extraída del subtotal). El frontend debe tratar los precios como finales.
- **`order_code`**: se genera al crear la orden con formato `ORD-YYYY-NNNNNN` (6 dígitos del id, padded con ceros). Es único y estable; `id` es el identificador interno.
- **CHECK constraints**: requieren **MySQL 8.0.16+**. En versiones anteriores se aceptan sintácticamente pero no se aplican. El schema asume que esa versión mínima está disponible.
- **Validación en backend**: todas las rutas validan input (tipos, rangos, enums) y devuelven 400 con mensaje claro en caso de error. Las validaciones de dominio (stock, máquina de estados) también devuelven 400. Errores inesperados caen al error middleware central y devuelven 500.
