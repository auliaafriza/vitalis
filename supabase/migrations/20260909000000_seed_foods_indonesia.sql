-- ============================================================================
-- Calorya — catalogue expansion (Indonesian home cooking, warung and kemasan)
--
-- The first seed carried 53 foods, which is enough to demonstrate the app and
-- not enough to use it: a week of ordinary Indonesian eating runs out of
-- matches by Wednesday, and every miss pushes the user to the barcode scanner
-- or to giving up. This adds ~150 more of the dishes people actually search
-- for, with a category set on the row rather than guessed later.
--
-- All values are per 100 g, or per 100 ml where is_liquid = true.
-- They are typical published figures for home-cooked or warung portions —
-- estimates, not lab measurements, and the interface says so. Where a dish
-- varies wildly by cook (rendang, gulai, martabak) the value sits at the
-- middle of the common range rather than at either end.
--
-- Inserted with a NOT EXISTS guard on the name rather than ON CONFLICT: the
-- table has no unique index on name (two users may each keep a private
-- "Nasi ibu"), so the guard is scoped to the public catalogue. That also makes
-- this file safe to re-run against a database where it was partly applied.
-- ============================================================================

insert into public.foods
  (name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
   serving_label, serving_g, is_liquid, is_public, category)
-- The VALUES list types every literal as text, so brand/serving_label and the
-- enum need an explicit cast; without the category cast Postgres refuses the
-- insert outright, which is the good failure, but the others would too.
select v.name::text, v.brand::text, v.kcal, v.protein_g, v.carbs_g, v.fat_g,
       v.fiber_g, v.sugar_g, v.sodium_mg, v.serving_label::text, v.serving_g,
       v.is_liquid, v.is_public, v.category::public.food_category
  from (values
  -- ---- Nasi, mi dan makanan pokok ----------------------------------------
  ('Nasi uduk',                 null,  190,  3.5,  30.0,   6.0,  0.7,  1.0,  380, '1 porsi',       200, false, true, 'main'),
  ('Nasi kuning',               null,  180,  3.4,  29.0,   5.5,  0.6,  0.8,  350, '1 porsi',       200, false, true, 'main'),
  ('Nasi liwet',                null,  175,  3.6,  28.0,   5.2,  0.8,  0.7,  340, '1 porsi',       200, false, true, 'main'),
  ('Nasi tim ayam',             null,  105,  6.0,  16.0,   1.8,  0.5,  0.6,  320, '1 mangkuk',     300, false, true, 'main'),
  ('Lontong',                   null,  110,  2.0,  24.0,   0.2,  0.4,  0.1,  200, '1 buah',        150, false, true, 'main'),
  ('Ketupat',                   null,  110,  2.0,  24.0,   0.2,  0.4,  0.1,  180, '1 buah',        150, false, true, 'main'),
  ('Bubur kacang hijau',        null,  120,  3.5,  20.0,   3.2,  2.2, 11.0,   45, '1 mangkuk',     200, false, true, 'main'),
  ('Mi ayam',                   null,  165,  7.0,  22.0,   5.0,  1.2,  1.5,  620, '1 mangkuk',     300, false, true, 'main'),
  ('Kwetiau goreng',            null,  190,  6.0,  26.0,   7.0,  1.0,  2.0,  640, '1 porsi',       250, false, true, 'main'),
  ('Bihun goreng',              null,  180,  4.0,  28.0,   6.0,  0.9,  1.5,  560, '1 porsi',       200, false, true, 'main'),
  ('Mi rebus (matang)',         null,  140,  4.5,  24.0,   2.8,  1.1,  1.0,  520, '1 porsi',       250, false, true, 'main'),
  ('Roti tawar gandum',         null,  247, 13.0,  41.0,   3.4,  7.0,  5.6,  400, '1 lembar',       35, false, true, 'main'),
  ('Tepung terigu',             null,  364, 10.3,  76.3,   1.0,  2.7,  0.3,    2, '100 g',         100, false, true, 'other'),
  ('Talas rebus',               null,  112,  1.5,  26.5,   0.2,  4.1,  0.4,   11, '1 potong',      100, false, true, 'main'),

  -- ---- Berkuah ------------------------------------------------------------
  ('Soto ayam',                 null,   55,  5.0,   3.0,   2.5,  0.3,  0.6,  420, '1 mangkuk',     350, false, true, 'main'),
  ('Soto betawi',               null,  130,  7.5,   5.0,   9.0,  0.5,  1.5,  470, '1 mangkuk',     350, false, true, 'main'),
  ('Rawon',                     null,   90,  7.0,   4.0,   5.5,  0.8,  1.0,  480, '1 mangkuk',     300, false, true, 'main'),
  ('Sop ayam',                  null,   45,  4.5,   2.5,   1.8,  0.4,  0.8,  380, '1 mangkuk',     300, false, true, 'main'),
  ('Sop buntut',                null,  105,  9.0,   3.0,   6.0,  0.5,  1.0,  450, '1 mangkuk',     300, false, true, 'main'),
  ('Gulai kambing',             null,  155, 11.0,   4.0,  11.0,  0.6,  1.5,  520, '1 porsi',       150, false, true, 'main'),
  ('Opor ayam',                 null,  165, 14.0,   4.5,  10.5,  0.7,  2.0,  430, '1 potong',      120, false, true, 'main'),
  ('Semur daging',              null,  175, 14.0,   7.0,  10.0,  0.5,  4.0,  560, '1 porsi',       120, false, true, 'main'),
  ('Sayur asem',                null,   35,  1.4,   5.5,   0.8,  1.6,  2.2,  320, '1 mangkuk',     200, false, true, 'vegetable'),
  ('Sayur lodeh',               null,   75,  2.2,   6.0,   4.8,  1.8,  2.4,  350, '1 mangkuk',     200, false, true, 'vegetable'),
  ('Sayur sop',                 null,   40,  1.8,   5.0,   1.5,  1.5,  2.0,  330, '1 mangkuk',     200, false, true, 'vegetable'),
  ('Sayur bayam bening',        null,   28,  2.4,   4.0,   0.4,  1.9,  1.2,  260, '1 mangkuk',     200, false, true, 'vegetable'),

  -- ---- Ayam, daging, telur ------------------------------------------------
  ('Ayam geprek',               null,  250, 22.0,  12.0,  13.0,  0.8,  1.2,  700, '1 porsi',       150, false, true, 'main'),
  ('Ayam rica-rica',            null,  175, 21.0,   4.0,   8.5,  0.9,  2.0,  520, '1 porsi',       120, false, true, 'main'),
  ('Ayam kecap',                null,  180, 19.0,   8.0,   8.0,  0.3,  6.0,  620, '1 potong',      120, false, true, 'main'),
  ('Paha ayam goreng',          null,  280, 24.0,   8.5,  17.0,  0.3,  0.2,  470, '1 potong',      120, false, true, 'main'),
  ('Sate kambing',              null,  250, 22.0,   2.0,  17.0,  0.2,  1.0,  380, '5 tusuk',       100, false, true, 'main'),
  ('Iga bakar',                 null,  290, 20.0,   5.0,  21.0,  0.3,  3.5,  520, '1 porsi',       150, false, true, 'main'),
  ('Daging sapi giling tumis',  null,  215, 18.0,   3.0,  14.5,  0.3,  1.2,  430, '1 porsi',       100, false, true, 'main'),
  ('Hati ayam goreng',          null,  200, 24.0,   4.0,   9.5,  0.0,  0.5,  320, '2 potong',       60, false, true, 'main'),
  ('Telur balado',              null,  180, 11.0,   6.0,  12.5,  0.7,  3.0,  480, '1 butir',        65, false, true, 'main'),
  ('Telur ceplok',              null,  195, 12.0,   1.0,  15.5,  0.0,  0.5,  180, '1 butir',        55, false, true, 'main'),
  ('Telur puyuh rebus',         null,  158, 13.1,   0.4,  11.1,  0.0,  0.4,  141, '5 butir',        50, false, true, 'main'),

  -- ---- Ikan dan seafood ---------------------------------------------------
  ('Ikan nila goreng',          null,  195, 21.0,   2.0,  11.0,  0.0,  0.0,  190, '1 ekor',        120, false, true, 'main'),
  ('Ikan bandeng presto',       null,  205, 20.0,   1.0,  13.0,  0.0,  0.0,  320, '1 ekor',        120, false, true, 'main'),
  ('Ikan tongkol balado',       null,  175, 20.0,   5.0,   8.5,  0.6,  2.5,  520, '1 potong',      100, false, true, 'main'),
  ('Ikan tuna panggang',        null,  184, 29.9,   0.0,   6.3,  0.0,  0.0,   50, '1 fillet',      120, false, true, 'main'),
  ('Pepes ikan',                null,  120, 16.0,   3.0,   5.0,  0.7,  1.0,  380, '1 bungkus',     100, false, true, 'main'),
  ('Cumi goreng tepung',        null,  230, 15.0,  16.0,  12.0,  0.6,  0.8,  420, '1 porsi',       100, false, true, 'main'),
  ('Ikan teri goreng',          null,  310, 38.0,   0.5,  17.0,  0.0,  0.0, 1500, '1 sdm',          15, false, true, 'other'),
  ('Kerang rebus',              null,   86, 14.7,   3.6,   1.1,  0.0,  0.0,  510, '1 porsi',       100, false, true, 'main'),

  -- ---- Tahu, tempe, kacang ------------------------------------------------
  ('Tempe mendoan',             null,  230, 12.0,  18.0,  12.0,  1.3,  1.0,  400, '1 lembar',       50, false, true, 'snack'),
  ('Tempe orek',                null,  245, 15.0,  20.0,  12.0,  1.4,  9.0,  560, '1 porsi',        80, false, true, 'main'),
  ('Tempe bacem',               null,  215, 15.5,  16.0,  10.0,  1.3,  7.5,  480, '2 potong',       60, false, true, 'main'),
  ('Tahu bacem',                null,  140,  9.5,   8.0,   7.5,  0.6,  5.0,  420, '2 potong',       70, false, true, 'main'),
  ('Tahu isi',                  null,  230,  7.5,  18.0,  14.0,  1.5,  1.5,  380, '1 buah',         60, false, true, 'snack'),
  ('Oncom goreng',              null,  190, 13.0,  14.0,   9.5,  2.0,  1.0,  260, '1 potong',       50, false, true, 'main'),
  ('Kacang kedelai rebus',      null,  173, 16.6,   9.9,   9.0,  6.0,  3.0,    1, '1 mangkuk',     100, false, true, 'main'),
  ('Kacang hijau rebus',        null,  105,  7.0,  19.2,   0.4,  7.6,  2.0,    2, '1 mangkuk',     100, false, true, 'main'),
  ('Kacang mete panggang',      null,  574, 18.0,  30.0,  46.0,  3.3,  5.9,   16, '1 genggam',      30, false, true, 'snack'),
  ('Selai kacang',              null,  588, 25.1,  20.0,  50.4,  6.0,  9.2,  429, '1 sdm',          16, false, true, 'other'),

  -- ---- Jajanan warung dan gorengan ---------------------------------------
  ('Gorengan bakwan sayur',     null,  280,  4.0,  30.0,  16.0,  1.8,  2.0,  420, '1 buah',         50, false, true, 'snack'),
  ('Bakwan jagung',             null,  285,  5.0,  32.0,  15.0,  2.0,  3.0,  440, '1 buah',         50, false, true, 'snack'),
  ('Pisang goreng',             null,  250,  2.0,  35.0,  11.0,  2.0, 15.0,  120, '1 buah',         60, false, true, 'snack'),
  ('Risoles',                   null,  250,  6.0,  24.0,  14.0,  1.2,  2.5,  400, '1 buah',         60, false, true, 'snack'),
  ('Lumpia goreng',             null,  270,  6.5,  28.0,  14.5,  1.5,  2.0,  430, '1 buah',         50, false, true, 'snack'),
  ('Perkedel kentang',          null,  210,  5.0,  20.0,  12.0,  1.5,  1.0,  380, '1 buah',         50, false, true, 'snack'),
  ('Siomay',                    null,  170,  9.0,  16.0,   7.5,  1.0,  3.0,  520, '1 porsi',       200, false, true, 'main'),
  ('Batagor',                   null,  260,  9.0,  24.0,  14.0,  1.2,  3.5,  560, '1 porsi',       180, false, true, 'main'),
  ('Pempek',                    null,  190, 11.0,  22.0,   6.0,  0.5,  1.0,  620, '1 porsi',       150, false, true, 'main'),
  ('Ketoprak',                  null,  150,  6.0,  18.0,   6.5,  2.0,  3.0,  420, '1 porsi',       250, false, true, 'main'),
  ('Martabak telur',            null,  260, 11.0,  20.0,  15.0,  1.0,  1.5,  540, '1 potong',       80, false, true, 'main'),
  ('Cireng',                    null,  310,  2.5,  42.0,  14.0,  1.0,  1.0,  480, '3 buah',         60, false, true, 'snack'),
  ('Cilok',                     null,  230,  3.0,  38.0,   7.0,  0.8,  1.5,  520, '5 buah',         80, false, true, 'snack'),
  ('Telur gulung',              null,  240,  9.0,  14.0,  16.0,  0.4,  1.0,  380, '2 tusuk',        60, false, true, 'snack'),

  -- ---- Sayur --------------------------------------------------------------
  ('Capcay',                    null,   65,  3.5,   7.0,   2.8,  1.8,  2.5,  420, '1 porsi',       200, false, true, 'vegetable'),
  ('Tumis buncis',              null,   70,  2.2,   6.5,   4.2,  2.4,  2.0,  300, '1 porsi',       100, false, true, 'vegetable'),
  ('Tumis kacang panjang',      null,   65,  2.6,   6.0,   3.6,  2.5,  2.0,  300, '1 porsi',       100, false, true, 'vegetable'),
  ('Tumis tauge',               null,   55,  3.0,   5.0,   2.8,  1.6,  1.5,  280, '1 porsi',       100, false, true, 'vegetable'),
  ('Tumis sawi hijau',          null,   55,  2.4,   4.0,   3.6,  1.8,  1.0,  280, '1 porsi',       100, false, true, 'vegetable'),
  ('Tumis jamur tiram',         null,   60,  3.0,   5.0,   3.5,  2.2,  1.2,  300, '1 porsi',       100, false, true, 'vegetable'),
  ('Terong balado',             null,  120,  1.5,   9.0,   9.0,  2.5,  4.0,  400, '1 porsi',       100, false, true, 'vegetable'),
  ('Urap sayur',                null,   95,  3.5,   8.0,   5.5,  3.2,  3.0,  300, '1 porsi',       150, false, true, 'vegetable'),
  ('Karedok',                   null,  105,  4.5,   9.0,   6.0,  3.0,  4.0,  280, '1 porsi',       200, false, true, 'vegetable'),
  ('Pecel sayur',               null,  110,  5.0,   9.0,   6.5,  3.0,  3.5,  340, '1 porsi',       200, false, true, 'vegetable'),
  ('Daun singkong rebus',       null,   50,  5.0,   7.0,   1.0,  3.7,  1.0,   12, '1 porsi',       100, false, true, 'vegetable'),
  ('Kol rebus',                 null,   23,  1.3,   5.5,   0.1,  2.3,  2.8,    8, '1 mangkuk',     100, false, true, 'vegetable'),
  ('Buncis rebus',              null,   35,  1.8,   7.9,   0.1,  3.4,  3.3,    6, '1 mangkuk',     100, false, true, 'vegetable'),
  ('Labu siam rebus',           null,   24,  0.8,   5.1,   0.1,  1.7,  2.0,    2, '1 mangkuk',     100, false, true, 'vegetable'),
  ('Terong rebus',              null,   35,  0.8,   8.7,   0.2,  2.5,  3.2,    2, '1 buah',        100, false, true, 'vegetable'),
  ('Timun',                     null,   15,  0.7,   3.6,   0.1,  0.5,  1.7,    2, '1 buah',        100, false, true, 'vegetable'),
  ('Tomat',                     null,   18,  0.9,   3.9,   0.2,  1.2,  2.6,    5, '1 buah',        100, false, true, 'vegetable'),
  ('Selada',                    null,   15,  1.4,   2.9,   0.2,  1.3,  0.8,   28, '1 mangkuk',      70, false, true, 'vegetable'),
  ('Labu kuning rebus',         null,   26,  1.0,   6.5,   0.1,  0.5,  2.8,    1, '1 potong',      100, false, true, 'vegetable'),

  -- ---- Buah ---------------------------------------------------------------
  ('Semangka',                  null,   30,  0.6,   7.6,   0.2,  0.4,  6.2,    1, '1 potong',      150, false, true, 'fruit'),
  ('Melon',                     null,   34,  0.8,   8.2,   0.2,  0.9,  7.9,   16, '1 potong',      150, false, true, 'fruit'),
  ('Nanas',                     null,   50,  0.5,  13.1,   0.1,  1.4,  9.9,    1, '1 potong',      100, false, true, 'fruit'),
  ('Jambu biji',                null,   68,  2.6,  14.3,   0.9,  5.4,  8.9,    2, '1 buah',        130, false, true, 'fruit'),
  ('Jambu air',                 null,   25,  0.6,   5.7,   0.1,  1.0,  4.5,    0, '3 buah',        120, false, true, 'fruit'),
  ('Salak',                     null,   82,  0.4,  20.9,   0.4,  0.3, 12.0,    2, '3 buah',        100, false, true, 'fruit'),
  ('Rambutan',                  null,   82,  0.7,  20.9,   0.2,  0.9, 15.0,   11, '5 buah',        100, false, true, 'fruit'),
  ('Duku',                      null,   63,  1.0,  16.1,   0.2,  0.8, 13.0,    1, '10 buah',       100, false, true, 'fruit'),
  ('Durian',                    null,  147,  1.5,  27.1,   5.3,  3.8, 20.0,    2, '3 biji',        100, false, true, 'fruit'),
  ('Kelengkeng',                null,   60,  1.3,  15.1,   0.1,  1.1, 14.0,    0, '10 buah',       100, false, true, 'fruit'),
  ('Anggur',                    null,   69,  0.7,  18.1,   0.2,  0.9, 15.5,    2, '1 genggam',     100, false, true, 'fruit'),
  ('Stroberi',                  null,   32,  0.7,   7.7,   0.3,  2.0,  4.9,    1, '5 buah',         80, false, true, 'fruit'),
  ('Buah naga',                 null,   60,  1.2,  13.0,   0.4,  3.0,  8.0,    0, '1/2 buah',      150, false, true, 'fruit'),
  ('Sawo',                      null,   83,  0.4,  20.0,   1.1,  5.3, 15.0,   12, '1 buah',        100, false, true, 'fruit'),
  ('Belimbing',                 null,   31,  1.0,   6.7,   0.3,  2.8,  4.0,    2, '1 buah',        120, false, true, 'fruit'),
  ('Nangka',                    null,   95,  1.7,  23.2,   0.6,  1.5, 19.1,    2, '5 biji',        100, false, true, 'fruit'),
  ('Sirsak',                    null,   66,  1.0,  16.8,   0.3,  3.3, 13.5,   14, '1 potong',      100, false, true, 'fruit'),
  ('Kelapa muda (daging)',      null,   45,  0.9,   9.0,   0.9,  2.0,  6.0,  105, '1 porsi',       100, false, true, 'fruit'),
  ('Pir',                       null,   57,  0.4,  15.2,   0.1,  3.1,  9.8,    1, '1 buah',        170, false, true, 'fruit'),
  ('Kiwi',                      null,   61,  1.1,  14.7,   0.5,  3.0,  9.0,    3, '1 buah',         75, false, true, 'fruit'),
  ('Kurma',                     null,  277,  1.8,  75.0,   0.2,  6.7, 66.5,    1, '3 butir',        24, false, true, 'fruit'),
  ('Pisang raja',               null,  120,  1.2,  31.2,   0.3,  2.0, 17.5,    1, '1 buah',        100, false, true, 'fruit'),

  -- ---- Camilan dan manis --------------------------------------------------
  ('Klepon',                    null,  190,  2.0,  38.0,   3.5,  1.2, 20.0,   60, '3 buah',         60, false, true, 'snack'),
  ('Onde-onde',                 null,  280,  5.0,  40.0,  11.0,  2.0, 15.0,   90, '1 buah',         50, false, true, 'snack'),
  ('Lemper',                    null,  200,  4.5,  32.0,   6.0,  0.8,  3.0,  240, '1 buah',         60, false, true, 'snack'),
  ('Kue lapis',                 null,  230,  2.0,  40.0,   7.0,  0.6, 22.0,   80, '1 potong',       50, false, true, 'snack'),
  ('Nagasari',                  null,  185,  2.2,  36.0,   4.0,  1.0, 15.0,   70, '1 buah',         60, false, true, 'snack'),
  ('Getuk singkong',            null,  200,  1.2,  42.0,   3.5,  1.6, 20.0,   45, '1 potong',       60, false, true, 'snack'),
  ('Martabak manis',            null,  320,  6.0,  45.0,  13.0,  1.5, 22.0,  220, '1 potong',       80, false, true, 'snack'),
  ('Donat gula',                null,  400,  6.0,  50.0,  20.0,  1.5, 22.0,  350, '1 buah',         60, false, true, 'snack'),
  ('Roti manis isi cokelat',    null,  340,  6.5,  52.0,  12.0,  1.6, 22.0,  300, '1 buah',         70, false, true, 'snack'),
  ('Bolu kukus',                null,  290,  5.0,  52.0,   7.0,  0.8, 28.0,  180, '1 buah',         50, false, true, 'snack'),
  ('Puding cokelat',            null,  130,  2.5,  22.0,   3.5,  0.5, 18.0,   90, '1 cup',         120, false, true, 'snack'),
  ('Es krim vanila',            null,  207,  3.5,  23.6,  11.0,  0.7, 21.2,   80, '1 scoop',        65, false, true, 'snack'),
  ('Cokelat susu',              null,  535,  7.7,  59.4,  29.7,  3.4, 51.5,   79, '1 batang',       45, false, true, 'packaged'),
  ('Biskuit marie',             null,  440,  7.0,  76.0,  12.0,  2.0, 22.0,  380, '4 keping',       30, false, true, 'packaged'),
  ('Wafer cokelat',             null,  500,  5.0,  62.0,  26.0,  1.5, 38.0,  220, '1 bungkus',      30, false, true, 'packaged'),
  ('Keripik singkong',          null,  500,  2.5,  60.0,  27.0,  3.0,  2.0,  480, '1 genggam',      30, false, true, 'packaged'),
  ('Keripik kentang',           null,  536,  7.0,  53.0,  34.0,  4.4,  0.3,  525, '1 genggam',      30, false, true, 'packaged'),
  ('Kerupuk putih',             null,  480,  3.0,  65.0,  22.0,  0.8,  1.0,  700, '3 keping',       15, false, true, 'packaged'),
  ('Popcorn tawar',             null,  387, 12.9,  78.0,   4.5, 14.5,  0.9,    8, '1 mangkuk',      30, false, true, 'snack'),
  ('Roti bakar cokelat keju',   null,  360,  8.0,  46.0,  16.0,  1.8, 18.0,  420, '1 porsi',       120, false, true, 'snack'),

  -- ---- Kemasan ------------------------------------------------------------
  ('Mi instan kuah',            null,  440,  9.0,  62.0, 17.0,   2.2,  3.5, 1900, '1 bungkus',      75, false, true, 'packaged'),
  ('Sereal jagung',             null,  378,  7.5,  84.0,   0.9,  3.3, 10.0,  729, '1 mangkuk',      35, false, true, 'packaged'),
  ('Roti sobek',                null,  310,  8.0,  50.0,   8.5,  1.8, 12.0,  360, '1 buah',         50, false, true, 'packaged'),
  ('Sosis ayam',                null,  270, 12.0,   6.0,  22.0,  0.2,  1.5,  900, '1 buah',         50, false, true, 'packaged'),
  ('Nugget ayam goreng',        null,  296, 15.0,  16.0,  19.0,  1.0,  0.5,  600, '5 buah',         85, false, true, 'packaged'),
  ('Kornet sapi',               null,  250, 15.0,   1.0,  20.0,  0.0,  0.5, 1000, '2 sdm',          40, false, true, 'packaged'),
  ('Abon sapi',                 null,  380, 22.0,  30.0,  18.0,  1.0, 22.0, 1200, '2 sdm',          20, false, true, 'packaged'),
  ('Keju mozzarella',           null,  280, 22.2,   2.2,  17.1,  0.0,  1.0,  373, '1 lembar',       25, false, true, 'packaged'),
  ('Yogurt buah',               null,   95,  3.5,  15.5,   1.5,  0.2, 14.0,   50, '1 cup',         150, true,  true, 'packaged'),

  -- ---- Minuman (per 100 ml) ----------------------------------------------
  ('Kopi susu gula',            null,   60,  1.4,   9.0,   1.8,  0.0,  8.5,   30, '1 gelas',       250, true,  true, 'drink'),
  ('Kopi hitam gula',           null,   30,  0.1,   7.5,   0.0,  0.0,  7.5,    3, '1 cangkir',     200, true,  true, 'drink'),
  ('Susu cokelat',              null,   83,  3.2,  12.5,   2.5,  0.5, 11.5,   60, '1 gelas',       250, true,  true, 'drink'),
  ('Susu kental manis',         null,  321,  7.9,  54.4,   8.7,  0.0, 54.4,  127, '1 sdm',          20, true,  true, 'packaged'),
  ('Susu rendah lemak',         null,   42,  3.4,   5.0,   1.0,  0.0,  5.0,   44, '1 gelas',       250, true,  true, 'drink'),
  ('Jus jeruk tanpa gula',      null,   45,  0.7,  10.4,   0.2,  0.2,  8.3,    1, '1 gelas',       250, true,  true, 'drink'),
  ('Jus mangga',                null,   55,  0.3,  13.5,   0.2,  0.3, 12.0,    3, '1 gelas',       250, true,  true, 'drink'),
  ('Jus alpukat dengan susu',   null,  120,  2.0,  14.0,   6.5,  1.5, 11.0,   25, '1 gelas',       250, true,  true, 'drink'),
  ('Air kelapa',                null,   19,  0.7,   3.7,   0.2,  1.1,  2.6,  105, '1 gelas',       250, true,  true, 'drink'),
  ('Es cendol',                 null,  130,  1.0,  25.0,   3.5,  0.7, 20.0,   40, '1 gelas',       250, true,  true, 'drink'),
  ('Minuman boba (teh susu)',   null,   90,  1.0,  18.0,   2.0,  0.1, 15.0,   35, '1 gelas',       500, true,  true, 'drink'),
  ('Minuman bersoda',           null,   42,  0.0,  10.6,   0.0,  0.0, 10.6,    4, '1 kaleng',      330, true,  true, 'packaged'),
  ('Minuman isotonik',          null,   26,  0.0,   6.4,   0.0,  0.0,  6.0,   40, '1 botol',       500, true,  true, 'packaged'),
  ('Minuman probiotik',         null,   65,  0.8,  15.0,   0.0,  0.0, 15.0,   12, '1 botol',        65, true,  true, 'packaged'),
  ('Wedang jahe',               null,   40,  0.1,  10.0,   0.0,  0.1,  9.5,    5, '1 gelas',       250, true,  true, 'drink'),

  -- ---- Bumbu, lemak, pemanis ---------------------------------------------
  ('Kecap manis',               null,  268,  4.0,  60.0,   0.5,  0.5, 55.0, 3200, '1 sdm',          15, false, true, 'other'),
  ('Saus sambal botol',         null,  100,  1.0,  22.0,   0.5,  1.0, 18.0, 1300, '1 sdm',          15, false, true, 'other'),
  ('Saus tomat botol',          null,  102,  1.2,  24.0,   0.2,  0.6, 21.0, 1100, '1 sdm',          15, false, true, 'other'),
  ('Mayones',                   null,  680,  1.0,   2.0,  75.0,  0.0,  1.5,  600, '1 sdm',          14, false, true, 'other'),
  ('Santan kental',             null,  230,  2.3,   5.5,  24.0,  2.2,  3.3,   15, '1 sdm',          15, true,  true, 'other'),
  ('Mentega',                   null,  717,  0.9,   0.1,  81.1,  0.0,  0.1,  576, '1 sdm',          14, false, true, 'other'),
  ('Madu',                      null,  304,  0.3,  82.4,   0.0,  0.2, 82.1,    4, '1 sdm',          21, false, true, 'other'),
  ('Gula merah',                null,  380,  0.0,  95.0,   0.0,  0.0, 90.0,   40, '1 sdm',          15, false, true, 'other'),
  ('Sambal matah',              null,  150,  1.5,   7.0,  13.0,  1.8,  3.0,  620, '1 sdm',          15, false, true, 'other'),
  ('Bumbu kacang',              null,  330, 12.0,  22.0,  22.0,  4.0, 12.0,  700, '2 sdm',          30, false, true, 'other')
  ) as v(name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
         sodium_mg, serving_label, serving_g, is_liquid, is_public, category)
 where not exists (
   select 1
     from public.foods f
    where f.is_public
      and f.created_by is null
      and lower(f.name) = lower(v.name)
 );
