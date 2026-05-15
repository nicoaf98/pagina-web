-- =============================================================
-- Car Parts B2B Store - PostgreSQL Seed Data
-- Run AFTER schema.postgres.sql.
-- Prices are in ARS and include IVA (21%). `tax_amount` on orders
-- is the IVA portion extracted from subtotal (informational).
-- =============================================================

-- Wipe tables and reset identity sequences. CASCADE because of FKs.
TRUNCATE TABLE
  order_items,
  orders,
  product_compatibility,
  product_images,
  products,
  manufacturers,
  vehicles,
  engines,
  vehicle_models,
  vehicle_brands,
  categories
RESTART IDENTITY CASCADE;

-- =============================================================
-- CATEGORIES (hierarchical)
-- =============================================================

INSERT INTO categories (id, parent_id, name, display_name, slug, sort_order) VALUES
  (1, NULL, 'Engine',       'Motor',       'motor',       10),
  (2, NULL, 'Brakes',       'Frenos',      'frenos',      20),
  (3, NULL, 'Suspension',   'Suspensión',  'suspension',  30),
  (4, NULL, 'Electrical',   'Eléctrico',   'electrico',   40),
  (5, NULL, 'Transmission', 'Transmisión', 'transmision', 50);

INSERT INTO categories (id, parent_id, name, display_name, slug, sort_order) VALUES
  (6,  1, 'Filters',         'Filtros',             'filtros',             10),
  (7,  1, 'Ignition',        'Encendido',           'encendido',           20),
  (8,  1, 'Cooling',         'Refrigeración',       'refrigeracion',       30),
  (9,  1, 'Timing',          'Distribución',        'distribucion',        40),
  (10, 2, 'Brake Pads',      'Pastillas de freno',  'pastillas-de-freno',  10),
  (11, 2, 'Brake Discs',     'Discos de freno',     'discos-de-freno',     20),
  (12, 3, 'Shock Absorbers', 'Amortiguadores',      'amortiguadores',      10),
  (13, 3, 'Springs',         'Espirales',           'espirales',           20),
  (14, 4, 'Batteries',       'Baterías',            'baterias',            10),
  (15, 4, 'Alternators',     'Alternadores',        'alternadores',        20),
  (16, 4, 'Starters',        'Burros de arranque',  'burros-de-arranque',  30),
  (17, 5, 'Clutch',          'Embrague',            'embrague',            10),
  (18, 5, 'Gearbox Fluids',  'Aceites de caja',     'aceites-de-caja',     20);

-- =============================================================
-- MANUFACTURERS (part brands)
-- =============================================================

INSERT INTO manufacturers (id, name, slug, country, website) VALUES
  (1,  'Bosch',  'bosch',  'Germany',   'https://www.bosch.com'),
  (2,  'Ferodo', 'ferodo', 'UK',        'https://www.ferodo.com'),
  (3,  'SKF',    'skf',    'Sweden',    'https://www.skf.com'),
  (4,  'NGK',    'ngk',    'Japan',     'https://www.ngk.com'),
  (5,  'Mahle',  'mahle',  'Germany',   'https://www.mahle.com'),
  (6,  'Fram',   'fram',   'USA',       'https://www.fram.com'),
  (7,  'Gates',  'gates',  'USA',       'https://www.gates.com'),
  (8,  'Monroe', 'monroe', 'USA',       'https://www.monroe.com'),
  (9,  'Moura',  'moura',  'Argentina', 'https://www.moura.com.ar'),
  (10, 'Valeo',  'valeo',  'France',    'https://www.valeo.com');

-- =============================================================
-- VEHICLE BRANDS / MODELS / ENGINES / VEHICLES
-- =============================================================

INSERT INTO vehicle_brands (id, name, slug) VALUES
  (1, 'Ford',       'ford'),
  (2, 'Toyota',     'toyota'),
  (3, 'Chevrolet',  'chevrolet'),
  (4, 'Volkswagen', 'volkswagen'),
  (5, 'Fiat',       'fiat'),
  (6, 'Renault',    'renault'),
  (7, 'Peugeot',    'peugeot');

INSERT INTO vehicle_models (id, brand_id, name, slug) VALUES
  (1,  1, 'Fiesta',   'ford-fiesta'),
  (2,  1, 'Focus',    'ford-focus'),
  (3,  1, 'Ranger',   'ford-ranger'),
  (4,  1, 'EcoSport', 'ford-ecosport'),
  (5,  2, 'Corolla',  'toyota-corolla'),
  (6,  2, 'Hilux',    'toyota-hilux'),
  (7,  2, 'Etios',    'toyota-etios'),
  (8,  3, 'Onix',     'chevrolet-onix'),
  (9,  3, 'Cruze',    'chevrolet-cruze'),
  (10, 3, 'S10',      'chevrolet-s10'),
  (11, 4, 'Gol',      'volkswagen-gol'),
  (12, 4, 'Amarok',   'volkswagen-amarok'),
  (13, 5, 'Cronos',   'fiat-cronos');

INSERT INTO engines (id, code, displacement_cc, fuel_type, horsepower, description) VALUES
  (1,  'FORD_SIGMA_16',   1596, 'flex',     123, 'Ford Sigma 1.6L 16v Ti-VCT'),
  (2,  'FORD_DURATEC_20', 1999, 'gasoline', 143, 'Ford Duratec 2.0L 16v'),
  (3,  'FORD_PUMA_32D',   3198, 'diesel',   200, 'Ford Puma 3.2L TDCi 20v'),
  (4,  'TOY_1ZR_FE',      1798, 'gasoline', 140, 'Toyota 1ZR-FE 1.8L Dual VVT-i'),
  (5,  'TOY_1GD_FTV',     2755, 'diesel',   177, 'Toyota 1GD-FTV 2.8L D-4D'),
  (6,  'TOY_2NR_FE',      1496, 'gasoline', 104, 'Toyota 2NR-FE 1.5L Dual VVT-i'),
  (7,  'GM_ECOTEC_14',    1389, 'gasoline',  98, 'Chevrolet Ecotec 1.4L 8v'),
  (8,  'GM_ECOTEC_14T',   1364, 'gasoline', 153, 'Chevrolet Ecotec 1.4L Turbo'),
  (9,  'GM_DURAMAX_28D',  2776, 'diesel',   200, 'Chevrolet Duramax 2.8L CTDI'),
  (10, 'VW_EA111_16',     1598, 'flex',     101, 'Volkswagen EA111 1.6L 8v'),
  (11, 'VW_EA189_20D',    1968, 'diesel',   180, 'Volkswagen EA189 2.0L TDI'),
  (12, 'FIAT_FIREFLY_13', 1301, 'flex',      99, 'Fiat Firefly 1.3L 8v');

INSERT INTO vehicles (id, model_id, engine_id, trim, body_type, year_from, year_to, notes) VALUES
  (1,  1,  1,  'Titanium',    'hatchback', 2011, 2017, 'Fiesta Kinetic Design'),
  (2,  2,  2,  'SE',          'sedan',     2013, 2018, 'Focus III'),
  (3,  3,  3,  'XLT',         'pickup',    2013, 2021, 'Ranger T6 facelift'),
  (4,  4,  1,  'Titanium',    'suv',       2013, 2019, 'EcoSport II'),
  (5,  5,  4,  'XEI',         'sedan',     2014, 2019, 'Corolla XI (E170)'),
  (6,  6,  5,  'SRV',         'pickup',    2016, NULL, 'Hilux VIII'),
  (7,  7,  6,  'XLS',         'hatchback', 2013, 2020, 'Etios primera generación'),
  (8,  8,  7,  'LT',          'hatchback', 2013, 2019, 'Onix primera generación'),
  (9,  9,  8,  'LTZ',         'sedan',     2016, NULL, 'Cruze II'),
  (10, 10, 9,  'LTZ',         'pickup',    2012, NULL, 'S10 tercera generación'),
  (11, 11, 10, 'Comfortline', 'hatchback', 2008, 2015, 'Gol Trend G4'),
  (12, 12, 11, 'Highline',    'pickup',    2010, 2022, 'Amarok primera generación'),
  (13, 13, 12, 'Drive',       'sedan',     2018, NULL, 'Cronos');

-- =============================================================
-- PRODUCTS
-- =============================================================

INSERT INTO products
  (id, category_id, manufacturer_id, sku, part_number, slug, name, short_description, description,
   price, cost, currency, stock, stock_reserved, is_active)
VALUES
  (1,  6,  1, 'BOS-OF-1457429192', '1457429192',
   'bosch-filtro-aceite-ford-sigma-16',
   'Filtro de aceite Bosch - Ford Sigma 1.6',
   'Filtro de aceite roscable para motores Ford Sigma 1.6L 16v Ti-VCT.',
   'Filtro de aceite roscable de alta capacidad de retención. Compatible con motores Ford Sigma utilizados en Fiesta Kinetic y EcoSport.',
   12500.00, 8500.00, 'ARS', 80, 0, TRUE),

  (2,  6,  5, 'MAH-OC229', 'OC229',
   'mahle-filtro-aceite-vw-16',
   'Filtro de aceite Mahle OC229 - VW 1.6',
   'Filtro de aceite para motores VW EA111 1.6 y similares.',
   'Filtro de aceite Mahle OC229 para motores VW EA111. Alta eficiencia en retención de partículas.',
   11800.00, 8000.00, 'ARS', 60, 0, TRUE),

  (3,  6,  6, 'FRM-CA10261', 'CA10261',
   'fram-filtro-aire-toyota-corolla',
   'Filtro de aire Fram - Toyota Corolla',
   'Filtro de aire panel para Toyota Corolla 1.8 (2014-2019).',
   'Filtro de aire Fram CA10261. Medio filtrante de alta eficiencia y baja restricción de flujo.',
   18900.00, 13000.00, 'ARS', 45, 0, TRUE),

  (4,  7,  4, 'NGK-IFR6T11-4', 'IFR6T11',
   'ngk-bujias-iridium-set-x4',
   'Bujías NGK Iridium IFR6T11 x4',
   'Juego de 4 bujías NGK Iridium de larga duración.',
   'Juego de 4 bujías NGK Iridium IFR6T11. Electrodo central de iridio, vida útil extendida.',
   85000.00, 62000.00, 'ARS', 30, 0, TRUE),

  (5,  7,  4, 'NGK-BPR6E', 'BPR6E',
   'ngk-bujia-estandar-bpr6e',
   'Bujía NGK estándar BPR6E',
   'Bujía NGK estándar BPR6E (unidad).',
   'Bujía NGK BPR6E, electrodo de níquel. Unidad suelta.',
   6500.00, 4200.00, 'ARS', 200, 0, TRUE),

  (6,  10, 2, 'FER-FDB4456', 'FDB4456',
   'ferodo-pastillas-delanteras-focus',
   'Pastillas de freno delanteras Ferodo - Focus',
   'Juego de pastillas delanteras Ferodo Premier para Ford Focus III.',
   'Juego de 4 pastillas de freno delanteras Ferodo Premier FDB4456. Compuesto cerámico de bajo nivel de polvo.',
   78000.00, 55000.00, 'ARS', 25, 0, TRUE),

  (7,  10, 2, 'FER-FDB1618', 'FDB1618',
   'ferodo-pastillas-traseras-focus',
   'Pastillas de freno traseras Ferodo - Focus',
   'Juego de pastillas traseras Ferodo Premier para Ford Focus III.',
   'Juego de 4 pastillas de freno traseras Ferodo Premier FDB1618.',
   62000.00, 44000.00, 'ARS', 22, 0, TRUE),

  (8,  11, 1, 'BOS-BD0986479S32', '0986479S32',
   'bosch-disco-freno-delantero-corolla',
   'Disco de freno delantero Bosch - Corolla',
   'Disco de freno delantero ventilado para Toyota Corolla XI.',
   'Disco de freno delantero ventilado Bosch 0986479S32 para Toyota Corolla 2014-2019.',
   96500.00, 68000.00, 'ARS', 18, 0, TRUE),

  (9,  12, 8, 'MON-G7330', 'G7330',
   'monroe-amortiguador-delantero-fiesta',
   'Amortiguador delantero Monroe - Fiesta',
   'Amortiguador delantero Monroe Original para Ford Fiesta Kinetic.',
   'Amortiguador delantero a gas Monroe Original G7330. Compatible con Ford Fiesta Kinetic 2011-2017.',
   142000.00, 98000.00, 'ARS', 16, 0, TRUE),

  (10, 12, 8, 'MON-G2217', 'G2217',
   'monroe-amortiguador-trasero-fiesta',
   'Amortiguador trasero Monroe - Fiesta',
   'Amortiguador trasero Monroe Original para Ford Fiesta Kinetic.',
   'Amortiguador trasero a gas Monroe Original G2217.',
   128000.00, 88000.00, 'ARS', 14, 0, TRUE),

  (11, 9,  7, 'GAT-K015603XS', 'K015603XS',
   'gates-kit-distribucion-ford-sigma-16',
   'Kit de distribución Gates - Ford Sigma 1.6',
   'Kit de distribución completo con correa y tensor.',
   'Kit de distribución Gates K015603XS: correa dentada, tensor y polea loca. Para Ford Sigma 1.6 (Fiesta, EcoSport).',
   215000.00, 158000.00, 'ARS', 12, 0, TRUE),

  (12, 8,  3, 'SKF-VKPC83444', 'VKPC83444',
   'skf-bomba-agua-vw-16',
   'Bomba de agua SKF - VW 1.6',
   'Bomba de agua SKF VKPC83444 para motores VW 1.6 EA111.',
   'Bomba de agua con junta incluida. Sello mecánico de carburo de silicio.',
   98000.00, 69000.00, 'ARS', 10, 0, TRUE),

  (13, 14, 9, 'MOU-M22GD', 'M22GD',
   'moura-bateria-12v-65ah',
   'Batería Moura 12V 65Ah',
   'Batería de arranque 12V 65Ah 520A libre mantenimiento.',
   'Batería Moura M22GD 12V 65Ah 520A CCA. Libre mantenimiento. 18 meses de garantía.',
   185000.00, 135000.00, 'ARS', 22, 0, TRUE),

  (14, 17, 10, 'VAL-826869', '826869',
   'valeo-kit-embrague-ranger-32',
   'Kit de embrague Valeo - Ranger 3.2',
   'Kit de embrague completo para Ford Ranger 3.2 TDCi.',
   'Kit Valeo 826869: disco, placa de presión y rodamiento de empuje. Para Ford Ranger 3.2 Puma.',
   485000.00, 345000.00, 'ARS', 6, 0, TRUE),

  (15, 15, 1, 'BOS-0124325045', '0124325045',
   'bosch-alternador-14v-90a',
   'Alternador Bosch 14V 90A',
   'Alternador Bosch 14V 90A reacondicionado.',
   'Alternador Bosch 0124325045 14V 90A. Compatible con varios vehículos del grupo Ford.',
   295000.00, 210000.00, 'ARS', 8, 0, TRUE);

-- =============================================================
-- PRODUCT IMAGES (sample)
-- =============================================================

INSERT INTO product_images (product_id, url, alt_text, position, is_primary) VALUES
  (1,  'https://cdn.example.com/products/bos-of-1457429192-1.jpg', 'Filtro Bosch 1457429192',    0, TRUE),
  (1,  'https://cdn.example.com/products/bos-of-1457429192-2.jpg', 'Filtro Bosch vista lateral', 1, FALSE),
  (4,  'https://cdn.example.com/products/ngk-ifr6t11-1.jpg',       'Bujías NGK Iridium x4',      0, TRUE),
  (6,  'https://cdn.example.com/products/fer-fdb4456-1.jpg',       'Pastillas Ferodo FDB4456',   0, TRUE),
  (8,  'https://cdn.example.com/products/bos-bd0986479s32-1.jpg',  'Disco Bosch Corolla',        0, TRUE),
  (9,  'https://cdn.example.com/products/mon-g7330-1.jpg',         'Amortiguador Monroe G7330',  0, TRUE),
  (11, 'https://cdn.example.com/products/gat-k015603xs-1.jpg',     'Kit distribución Gates',     0, TRUE),
  (13, 'https://cdn.example.com/products/mou-m22gd-1.jpg',         'Batería Moura M22GD',        0, TRUE),
  (14, 'https://cdn.example.com/products/val-826869-1.jpg',        'Kit embrague Valeo',         0, TRUE),
  (15, 'https://cdn.example.com/products/bos-0124325045-1.jpg',    'Alternador Bosch',           0, TRUE);

-- =============================================================
-- PRODUCT COMPATIBILITY (N:M products <-> vehicles)
-- =============================================================

-- Bosch Oil Filter (Sigma engine)
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (1, 1, 'universal'),
  (1, 4, 'universal');

-- Mahle OC229 (VW EA111)
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (2, 11, 'universal');

-- Fram Air Filter (Corolla)
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (3, 5, 'universal');

-- NGK Iridium set
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (4, 2, 'universal'),
  (4, 5, 'universal');

-- NGK Standard plug
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (5, 1,  'universal'),
  (5, 4,  'universal'),
  (5, 11, 'universal'),
  (5, 13, 'universal');

-- Ferodo Front / Rear Pads - Focus
INSERT INTO product_compatibility (product_id, vehicle_id, position, notes) VALUES
  (6, 2, 'front', 'Se vende por juego de 4'),
  (7, 2, 'rear',  'Se vende por juego de 4');

-- Bosch Front Disc - Corolla
INSERT INTO product_compatibility (product_id, vehicle_id, position, notes) VALUES
  (8, 5, 'front', 'Unidad');

-- Monroe Front / Rear Shock - Fiesta
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (9,  1, 'front'),
  (10, 1, 'rear');

-- Gates Timing Kit - Sigma
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (11, 1, 'universal'),
  (11, 4, 'universal');

-- SKF Water Pump - VW 1.6
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (12, 11, 'universal');

-- Moura Battery - universal fitment
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (13, 1,  'universal'), (13, 2,  'universal'), (13, 3,  'universal'),
  (13, 4,  'universal'), (13, 5,  'universal'), (13, 6,  'universal'),
  (13, 7,  'universal'), (13, 8,  'universal'), (13, 9,  'universal'),
  (13, 10, 'universal'), (13, 11, 'universal'), (13, 12, 'universal'),
  (13, 13, 'universal');

-- Valeo Clutch Kit - Ranger
INSERT INTO product_compatibility (product_id, vehicle_id, position, notes) VALUES
  (14, 3, 'universal', 'Kit completo: disco, placa y rodamiento');

-- Bosch Alternator
INSERT INTO product_compatibility (product_id, vehicle_id, position) VALUES
  (15, 1, 'universal'),
  (15, 2, 'universal'),
  (15, 4, 'universal');

-- =============================================================
-- ORDERS + ORDER_ITEMS (sample, totals cross-checked)
-- subtotal = SUM(line_total)
-- tax_amount = IVA 21% extracted from subtotal (informational)
-- total = subtotal + shipping_cost - discount_amount
-- =============================================================

-- Order 1: wholesale, paid, shipped
--   10 x 12500 + 5 x 85000 + 4 x 78000 = 862,000
--   IVA(21%) = 149,603.31
--   Total    = 862000 + 15000 - 43100 = 833,900
INSERT INTO orders (
  id, order_code, customer_id,
  customer_name, customer_email, customer_phone,
  subtotal, tax_amount, shipping_cost, discount_amount, total, currency,
  payment_status, fulfillment_status,
  payment_method, payment_reference,
  shipping_method, tracking_number,
  shipping_street, shipping_number, shipping_floor,
  shipping_city, shipping_province, shipping_postal_code, shipping_country,
  shipping_notes, notes,
  created_at, updated_at, paid_at, shipped_at
) VALUES (
  1, 'ORD-2026-000001', NULL,
  'Autopartes del Sur S.A.', 'ventas@autopartesdelsur.com.ar', '+54 11 4312-5600',
  862000.00, 149603.31, 15000.00, 43100.00, 833900.00, 'ARS',
  'paid', 'shipped',
  'bank_transfer', 'TRF-20260401-8821',
  'andreani', 'ANDR-2026040100123',
  'Av. Rivadavia', '12345', 'Depósito',
  'Ciudad Autónoma de Buenos Aires', 'CABA', 'C1406', 'AR',
  'Horario de recepción: 8 a 16 hs.', 'Cliente mayorista, IVA Responsable Inscripto.',
  '2026-04-01T10:15:00Z', '2026-04-02T11:00:00Z',
  '2026-04-01T14:30:00Z', '2026-04-02T11:00:00Z'
);

INSERT INTO order_items
  (order_id, product_id, product_name_snapshot, product_sku_snapshot, quantity, unit_price, discount_amount, line_total)
VALUES
  (1, 1, 'Filtro de aceite Bosch - Ford Sigma 1.6',      'BOS-OF-1457429192', 10, 12500.00, 0.00, 125000.00),
  (1, 4, 'Bujías NGK Iridium IFR6T11 x4',                'NGK-IFR6T11-4',      5, 85000.00, 0.00, 425000.00),
  (1, 6, 'Pastillas de freno delanteras Ferodo - Focus', 'FER-FDB4456',        4, 78000.00, 0.00, 312000.00);

-- Order 2: retail, paid, delivered
--   1 x 142000 + 1 x 128000 + 2 x 6500 = 283,000
--   IVA(21%) = 49,115.70
--   Total    = 283000 + 8500 - 0 = 291,500
INSERT INTO orders (
  id, order_code, customer_id,
  customer_name, customer_email, customer_phone,
  subtotal, tax_amount, shipping_cost, discount_amount, total, currency,
  payment_status, fulfillment_status,
  payment_method, payment_reference,
  shipping_method, tracking_number,
  shipping_street, shipping_number, shipping_floor,
  shipping_city, shipping_province, shipping_postal_code, shipping_country,
  created_at, updated_at, paid_at, shipped_at, delivered_at
) VALUES (
  2, 'ORD-2026-000002', NULL,
  'Juan Pérez', 'juan.perez@gmail.com', '+54 11 5678-1234',
  283000.00, 49115.70, 8500.00, 0.00, 291500.00, 'ARS',
  'paid', 'delivered',
  'mercadopago', 'MP-76543210987',
  'oca', 'OCA-202604-55210',
  'Calle Falsa', '1234', '3B',
  'La Plata', 'Buenos Aires', '1900', 'AR',
  '2026-04-10T18:22:00Z', '2026-04-13T14:20:00Z',
  '2026-04-10T18:25:00Z', '2026-04-11T09:00:00Z', '2026-04-13T14:20:00Z'
);

INSERT INTO order_items
  (order_id, product_id, product_name_snapshot, product_sku_snapshot, quantity, unit_price, discount_amount, line_total)
VALUES
  (2, 9,  'Amortiguador delantero Monroe - Fiesta', 'MON-G7330', 1, 142000.00, 0.00, 142000.00),
  (2, 10, 'Amortiguador trasero Monroe - Fiesta',   'MON-G2217', 1, 128000.00, 0.00, 128000.00),
  (2, 5,  'Bujía NGK estándar BPR6E',               'NGK-BPR6E', 2,   6500.00, 0.00,  13000.00);

-- Order 3: workshop, pending, preparing, on-account
--   2 x 215000 + 1 x 485000 + 1 x 295000 = 1,210,000
--   IVA(21%) = 210,000.00
--   Total    = 1210000 + 0 - 121000 = 1,089,000
INSERT INTO orders (
  id, order_code, customer_id,
  customer_name, customer_email, customer_phone,
  subtotal, tax_amount, shipping_cost, discount_amount, total, currency,
  payment_status, fulfillment_status,
  payment_method, shipping_method,
  shipping_city, shipping_province, shipping_postal_code, shipping_country,
  shipping_notes, notes,
  created_at, updated_at
) VALUES (
  3, 'ORD-2026-000003', NULL,
  'Taller Mecánico Rodríguez', 'taller.rodriguez@gmail.com', '+54 341 456-7890',
  1210000.00, 210000.00, 0.00, 121000.00, 1089000.00, 'ARS',
  'pending', 'preparing',
  'account', 'pickup',
  'Rosario', 'Santa Fe', '2000', 'AR',
  'Retira en local. Cuenta corriente 30 días.',
  'Descuento 10% aplicado por segmento taller.',
  '2026-04-20T09:45:00Z', '2026-04-20T09:45:00Z'
);

INSERT INTO order_items
  (order_id, product_id, product_name_snapshot, product_sku_snapshot, quantity, unit_price, discount_amount, line_total)
VALUES
  (3, 11, 'Kit de distribución Gates - Ford Sigma 1.6', 'GAT-K015603XS',  2, 215000.00, 0.00, 430000.00),
  (3, 14, 'Kit de embrague Valeo - Ranger 3.2',         'VAL-826869',     1, 485000.00, 0.00, 485000.00),
  (3, 15, 'Alternador Bosch 14V 90A',                   'BOS-0124325045', 1, 295000.00, 0.00, 295000.00);

-- =============================================================
-- Sync identity sequences with the highest seeded id
-- so the next INSERT from the backend doesn't collide.
-- =============================================================

SELECT setval(pg_get_serial_sequence('categories',     'id'), (SELECT MAX(id) FROM categories));
SELECT setval(pg_get_serial_sequence('manufacturers',  'id'), (SELECT MAX(id) FROM manufacturers));
SELECT setval(pg_get_serial_sequence('vehicle_brands', 'id'), (SELECT MAX(id) FROM vehicle_brands));
SELECT setval(pg_get_serial_sequence('vehicle_models', 'id'), (SELECT MAX(id) FROM vehicle_models));
SELECT setval(pg_get_serial_sequence('engines',        'id'), (SELECT MAX(id) FROM engines));
SELECT setval(pg_get_serial_sequence('vehicles',       'id'), (SELECT MAX(id) FROM vehicles));
SELECT setval(pg_get_serial_sequence('products',       'id'), (SELECT MAX(id) FROM products));
SELECT setval(pg_get_serial_sequence('product_images', 'id'), (SELECT MAX(id) FROM product_images));
SELECT setval(pg_get_serial_sequence('orders',         'id'), (SELECT MAX(id) FROM orders));
SELECT setval(pg_get_serial_sequence('order_items',    'id'), (SELECT MAX(id) FROM order_items));
