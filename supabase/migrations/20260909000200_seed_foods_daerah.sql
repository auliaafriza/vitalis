-- ============================================================================
-- Calorya — katalog makanan, tahap tiga: masakan daerah dan celah yang tersisa
--
-- Tahap dua membawa katalog dari 53 ke 217 dan menutup masakan rumahan
-- sehari-hari. Yang masih kosong ternyata justru yang paling sering dicari di
-- luar rumah: masakan daerah (coto, gudeg, mie Aceh, papeda), buah lokal
-- musiman (manggis, markisa, cempedak), sayur yang tidak ada padanan
-- internasionalnya (petai, jengkol, genjer, rebung), dan jajanan pasar.
--
-- 139 baris berikutnya menutup itu. Semua per 100 g, atau per 100 ml untuk
-- yang cair.
--
-- TIDAK ADA MEREK DI SINI, dan itu disengaja. Mencantumkan produk bermerek
-- berarti menerbitkan angka gizi atas nama perusahaan yang tidak pernah kami
-- baca labelnya — angka karangan yang tampak resmi. Produk kemasan ditulis
-- generik ("Mi instan cup", "Sarden kaleng saus tomat"); untuk merek tertentu,
-- pemindai barcode mengambil datanya dari Open Food Facts, tempat angkanya
-- memang berasal dari label.
--
-- Angkanya perkiraan untuk porsi rumahan dan warung. Untuk hidangan yang
-- sangat bervariasi antar-juru masak, nilainya diambil di tengah rentang yang
-- umum, bukan di ujungnya.
--
-- Penjaga NOT EXISTS per nama, sama seperti tahap dua: berkas ini aman
-- dijalankan ulang, dan aman di database yang sudah menerapkannya sebagian.
-- ============================================================================

insert into public.foods
  (name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
   serving_label, serving_g, is_liquid, is_public, category)
select v.name::text, v.brand::text, v.kcal, v.protein_g, v.carbs_g, v.fat_g,
       v.fiber_g, v.sugar_g, v.sodium_mg, v.serving_label::text, v.serving_g,
       v.is_liquid, v.is_public, v.category::public.food_category
  from (values
  -- ---- Masakan daerah ---------------------------------------------
  ('Coto Makassar',             null,  120,  10.0,   4.0,   7.0,  0.4,  1.0,   480, '1 mangkuk',    300, false, true, 'main'),
  ('Sop konro',                 null,  135,  11.0,   4.0,   8.5,  0.5,  1.5,   500, '1 mangkuk',    300, false, true, 'main'),
  ('Konro bakar',               null,  275,  19.0,   6.0,  19.5,  0.4,  4.0,   540, '1 porsi',      150, false, true, 'main'),
  ('Gudeg',                     null,  130,   3.5,  16.0,   6.0,  2.5, 10.0,   420, '1 porsi',      150, false, true, 'main'),
  ('Mie Aceh',                  null,  190,   8.0,  25.0,   6.5,  1.4,  2.0,   680, '1 porsi',      250, false, true, 'main'),
  ('Ayam betutu',               null,  185,  20.0,   4.5,   9.5,  0.9,  1.5,   520, '1 potong',     120, false, true, 'main'),
  ('Ayam taliwang',             null,  195,  21.0,   5.0,  10.0,  0.8,  3.0,   540, '1 potong',     120, false, true, 'main'),
  ('Sate lilit',                null,  175,  16.0,   4.0,  10.5,  0.6,  1.5,   420, '3 tusuk',       90, false, true, 'main'),
  ('Sate padang',               null,  200,  17.0,  10.0,  10.5,  0.5,  2.0,   620, '5 tusuk',      120, false, true, 'main'),
  ('Sate maranggi',             null,  230,  20.0,   5.0,  14.5,  0.3,  3.5,   480, '5 tusuk',      100, false, true, 'main'),
  ('Tongseng kambing',          null,  165,  12.0,   5.0,  11.0,  0.7,  2.5,   520, '1 mangkuk',    250, false, true, 'main'),
  ('Sop kambing',               null,  110,   9.5,   3.5,   6.5,  0.5,  1.0,   480, '1 mangkuk',    300, false, true, 'main'),
  ('Empal gentong',             null,  150,  10.0,   5.0,  10.0,  0.6,  1.5,   500, '1 mangkuk',    300, false, true, 'main'),
  ('Rujak cingur',              null,  135,   7.0,  12.0,   6.5,  3.0,  4.0,   400, '1 porsi',      250, false, true, 'main'),
  ('Nasi pecel',                null,  145,   5.5,  18.0,   6.0,  3.2,  3.5,   380, '1 porsi',      250, false, true, 'main'),
  ('Bakmi jawa',                null,  175,   7.5,  23.0,   6.0,  1.3,  2.0,   600, '1 porsi',      250, false, true, 'main'),
  ('Laksa',                     null,  145,   6.0,  15.0,   7.0,  1.2,  2.5,   560, '1 mangkuk',    300, false, true, 'main'),
  ('Mie celor',                 null,  160,   8.0,  18.0,   6.5,  1.0,  2.0,   580, '1 mangkuk',    300, false, true, 'main'),
  ('Mie kocok',                 null,  150,   8.5,  17.0,   5.5,  1.1,  1.5,   620, '1 mangkuk',    300, false, true, 'main'),
  ('Tekwan',                    null,   95,   7.0,  12.0,   1.8,  0.6,  1.2,   640, '1 mangkuk',    300, false, true, 'main'),
  ('Papeda',                    null,   85,   0.3,  21.0,   0.1,  0.4,  0.2,     3, '1 porsi',      200, false, true, 'main'),
  ('Nasi bakar',                null,  185,   5.5,  28.0,   5.5,  0.9,  1.0,   420, '1 bungkus',    200, false, true, 'main'),
  ('Nasi kebuli',               null,  205,   7.0,  27.0,   7.5,  1.0,  1.5,   480, '1 porsi',      250, false, true, 'main'),
  ('Ayam pop',                  null,  165,  22.0,   1.5,   8.0,  0.1,  0.5,   380, '1 potong',     120, false, true, 'main'),
  ('Dendeng balado',            null,  320,  26.0,  10.0,  19.0,  1.0,  6.0,   720, '1 potong',      60, false, true, 'main'),
  ('Sambal goreng ati',         null,  195,  15.0,   8.0,  11.5,  0.8,  3.0,   560, '1 porsi',      100, false, true, 'main'),
  ('Tahu telur',                null,  190,  11.0,  10.0,  12.0,  1.2,  3.0,   480, '1 porsi',      200, false, true, 'main'),
  -- ---- Ayam, daging, ikan lain ------------------------------------
  ('Rendang ayam',              null,  215,  18.0,   5.0,  13.5,  0.8,  2.0,   470, '1 potong',     100, false, true, 'main'),
  ('Ayam penyet',               null,  255,  22.0,  10.0,  14.5,  0.9,  1.5,   680, '1 porsi',      150, false, true, 'main'),
  ('Ayam suwir kecap',          null,  175,  20.0,   6.0,   8.0,  0.3,  4.5,   600, '1 porsi',      100, false, true, 'main'),
  ('Bebek goreng',              null,  300,  23.0,   4.0,  21.0,  0.3,  0.5,   480, '1 potong',     120, false, true, 'main'),
  ('Ikan bakar',                null,  165,  22.0,   2.0,   7.5,  0.2,  1.5,   380, '1 ekor',       150, false, true, 'main'),
  ('Ikan gurame goreng',        null,  205,  20.0,   3.0,  12.5,  0.0,  0.0,   200, '1 ekor',       150, false, true, 'main'),
  ('Ikan patin goreng',         null,  215,  18.0,   3.0,  14.0,  0.0,  0.0,   190, '1 potong',     120, false, true, 'main'),
  ('Ikan tenggiri goreng',      null,  200,  21.0,   2.0,  12.0,  0.0,  0.0,   210, '1 potong',     100, false, true, 'main'),
  ('Ikan asin goreng',          null,  310,  42.0,   0.5,  15.0,  0.0,  0.0,  3500, '1 potong',      25, false, true, 'other'),
  ('Gulai ikan',                null,  140,  14.0,   4.0,   7.5,  0.6,  1.5,   480, '1 potong',     120, false, true, 'main'),
  ('Udang goreng tepung',       null,  235,  17.0,  15.0,  12.0,  0.6,  0.8,   460, '1 porsi',      100, false, true, 'main'),
  ('Kepiting saus padang',      null,  165,  16.0,   8.0,   7.5,  0.6,  4.0,   620, '1 porsi',      150, false, true, 'main'),
  ('Otak-otak',                 null,  175,  11.0,  14.0,   8.5,  0.5,  1.5,   640, '3 buah',        90, false, true, 'snack'),
  ('Bakso ikan',                null,  130,  11.0,  12.0,   4.0,  0.4,  0.8,   660, '5 butir',      100, false, true, 'main'),
  ('Telur asin',                null,  195,  13.0,   1.5,  14.5,  0.0,  0.8,  1200, '1 butir',       60, false, true, 'main'),
  ('Ati ampela goreng',         null,  195,  22.0,   4.0,  10.0,  0.0,  0.5,   340, '1 porsi',       70, false, true, 'main'),
  ('Paru goreng',               null,  320,  22.0,   6.0,  23.0,  0.2,  0.5,   520, '1 potong',      60, false, true, 'main'),
  -- ---- Sayur ------------------------------------------------------
  ('Pare tumis',                null,   60,   2.0,   6.0,   3.5,  2.6,  1.5,   280, '1 porsi',      100, false, true, 'vegetable'),
  ('Rebung rebus',              null,   27,   2.5,   5.2,   0.3,  2.2,  3.0,     4, '1 porsi',      100, false, true, 'vegetable'),
  ('Genjer tumis',              null,   62,   2.8,   5.5,   3.6,  2.4,  1.2,   290, '1 porsi',      100, false, true, 'vegetable'),
  ('Pakcoy tumis',              null,   52,   2.2,   4.0,   3.4,  1.5,  1.2,   280, '1 porsi',      100, false, true, 'vegetable'),
  ('Sawi putih rebus',          null,   16,   1.2,   3.2,   0.2,  1.2,  1.4,     9, '1 mangkuk',    100, false, true, 'vegetable'),
  ('Kembang kol rebus',         null,   25,   1.9,   5.0,   0.3,  2.3,  1.9,    15, '1 mangkuk',    100, false, true, 'vegetable'),
  ('Jamur kancing tumis',       null,   55,   3.2,   4.5,   3.2,  1.2,  1.5,   300, '1 porsi',      100, false, true, 'vegetable'),
  ('Petai',                     null,  142,  10.4,  15.0,   2.0,  2.0,  2.5,    10, '5 papan',       50, false, true, 'vegetable'),
  ('Jengkol',                   null,  133,  12.0,  20.0,   1.5,  2.5,  1.0,    15, '1 porsi',       80, false, true, 'vegetable'),
  ('Daun pepaya rebus',         null,   48,   4.8,   6.0,   1.0,  3.0,  1.0,    16, '1 porsi',      100, false, true, 'vegetable'),
  ('Kecipir tumis',             null,   68,   3.2,   6.5,   3.6,  2.8,  1.5,   290, '1 porsi',      100, false, true, 'vegetable'),
  ('Nangka muda (gulai)',       null,   95,   2.2,  10.0,   5.5,  2.8,  4.0,   380, '1 porsi',      150, false, true, 'vegetable'),
  ('Jagung manis pipil',        null,   86,   3.2,  19.0,   1.2,  2.7,  6.3,    15, '1 mangkuk',    100, false, true, 'vegetable'),
  ('Kacang polong rebus',       null,   84,   5.4,  15.6,   0.4,  5.5,  5.9,     3, '1 mangkuk',    100, false, true, 'vegetable'),
  ('Terong goreng',             null,  180,   1.2,   9.0,  15.5,  2.8,  3.5,   220, '1 porsi',      100, false, true, 'vegetable'),
  -- ---- Buah -------------------------------------------------------
  ('Manggis',                   null,   73,   0.4,  18.0,   0.6,  1.8, 16.0,     7, '3 buah',       100, false, true, 'fruit'),
  ('Markisa',                   null,   97,   2.2,  23.4,   0.7, 10.4, 11.2,    28, '2 buah',       100, false, true, 'fruit'),
  ('Srikaya',                   null,   94,   2.1,  23.6,   0.3,  4.4, 19.0,     4, '1 buah',       100, false, true, 'fruit'),
  ('Cempedak',                  null,  116,   2.5,  28.0,   0.4,  3.4, 20.0,     5, '3 biji',       100, false, true, 'fruit'),
  ('Blewah',                    null,   34,   0.8,   8.2,   0.2,  0.9,  7.9,    16, '1 potong',     150, false, true, 'fruit'),
  ('Timun suri',                null,   21,   0.6,   5.0,   0.1,  0.6,  3.5,     4, '1 potong',     150, false, true, 'fruit'),
  ('Delima',                    null,   83,   1.7,  18.7,   1.2,  4.0, 13.7,     3, '1/2 buah',     100, false, true, 'fruit'),
  ('Jeruk bali',                null,   38,   0.8,   9.6,   0.0,  1.0,  9.0,     1, '2 potong',     150, false, true, 'fruit'),
  ('Lemon',                     null,   29,   1.1,   9.3,   0.3,  2.8,  2.5,     2, '1 buah',        60, false, true, 'fruit'),
  ('Kesemek',                   null,   70,   0.6,  18.6,   0.2,  3.6, 12.5,     1, '1 buah',       120, false, true, 'fruit'),
  ('Sukun rebus',               null,  103,   1.1,  27.1,   0.2,  4.9, 11.0,     2, '1 potong',     100, false, true, 'fruit'),
  ('Kelapa parut',              null,  354,   3.3,  15.2,  33.5,  9.0,  6.2,    20, '2 sdm',         20, false, true, 'other'),
  -- ---- Jajanan dan kue --------------------------------------------
  ('Bubur sumsum',              null,  120,   1.8,  18.0,   4.5,  0.5, 10.0,    60, '1 mangkuk',    200, false, true, 'snack'),
  ('Serabi',                    null,  180,   3.0,  28.0,   6.0,  1.0, 10.0,   150, '2 buah',        80, false, true, 'snack'),
  ('Kue putu',                  null,  195,   2.2,  38.0,   4.0,  1.4, 18.0,    70, '3 buah',        60, false, true, 'snack'),
  ('Dadar gulung',              null,  215,   3.5,  34.0,   7.5,  1.6, 16.0,    90, '2 buah',        70, false, true, 'snack'),
  ('Wajik',                     null,  260,   2.0,  50.0,   6.0,  1.0, 30.0,    60, '2 potong',      60, false, true, 'snack'),
  ('Dodol',                     null,  320,   1.5,  62.0,   8.0,  0.8, 45.0,    70, '3 potong',      50, false, true, 'snack'),
  ('Bakpia',                    null,  310,   6.0,  52.0,   9.0,  2.0, 22.0,   140, '2 buah',        60, false, true, 'snack'),
  ('Bika ambon',                null,  280,   4.0,  48.0,   8.0,  0.6, 26.0,   120, '1 potong',      60, false, true, 'snack'),
  ('Kue cubit',                 null,  265,   4.5,  42.0,   9.0,  0.8, 22.0,   180, '5 buah',        60, false, true, 'snack'),
  ('Cakwe',                     null,  330,   6.0,  42.0,  15.0,  1.6,  1.0,   480, '1 buah',        50, false, true, 'snack'),
  ('Pastel',                    null,  265,   6.0,  28.0,  14.0,  1.5,  1.5,   420, '1 buah',        60, false, true, 'snack'),
  ('Kroket',                    null,  250,   6.5,  26.0,  13.5,  1.4,  1.5,   430, '1 buah',        60, false, true, 'snack'),
  ('Sosis solo',                null,  260,   9.0,  22.0,  15.0,  1.0,  2.0,   460, '2 buah',        60, false, true, 'snack'),
  ('Arem-arem',                 null,  175,   3.5,  30.0,   4.5,  0.8,  1.0,   320, '1 buah',        80, false, true, 'snack'),
  ('Rengginang',                null,  440,   5.0,  72.0,  15.0,  1.5,  1.0,   380, '3 keping',      30, false, true, 'snack'),
  ('Emping',                    null,  470,   8.0,  62.0,  22.0,  3.0,  1.5,   320, '1 genggam',     25, false, true, 'snack'),
  ('Keripik pisang',            null,  480,   2.0,  62.0,  25.0,  3.5, 18.0,   120, '1 genggam',     30, false, true, 'snack'),
  ('Keripik tempe',             null,  470,  18.0,  38.0,  27.0,  3.0,  1.5,   420, '1 genggam',     30, false, true, 'snack'),
  ('Kacang bawang',             null,  560,  24.0,  20.0,  44.0,  7.0,  3.0,   380, '1 genggam',     30, false, true, 'snack'),
  ('Nastar',                    null,  480,   6.0,  55.0,  26.0,  1.2, 25.0,   200, '3 buah',        45, false, true, 'snack'),
  ('Kastengel',                 null,  510,  10.0,  44.0,  32.0,  1.4,  8.0,   520, '3 buah',        45, false, true, 'snack'),
  ('Putri salju',               null,  495,   6.0,  54.0,  28.0,  1.5, 24.0,   180, '3 buah',        45, false, true, 'snack'),
  -- ---- Minuman ----------------------------------------------------
  ('Es teler',                  null,  120,   1.5,  20.0,   4.0,  1.5, 16.0,    35, '1 gelas',      300, true,  true, 'drink'),
  ('Es doger',                  null,  135,   1.8,  22.0,   4.5,  0.8, 18.0,    45, '1 gelas',      300, true,  true, 'drink'),
  ('Es campur',                 null,  125,   1.2,  22.0,   3.5,  1.0, 18.0,    40, '1 gelas',      300, true,  true, 'drink'),
  ('Bandrek',                   null,   55,   0.3,  13.0,   0.2,  0.2, 12.0,    10, '1 gelas',      250, true,  true, 'drink'),
  ('Bajigur',                   null,   85,   1.0,  13.0,   3.2,  0.4, 11.0,    25, '1 gelas',      250, true,  true, 'drink'),
  ('Sekoteng',                  null,   90,   2.0,  15.0,   2.5,  0.8, 12.0,    30, '1 mangkuk',    250, true,  true, 'drink'),
  ('Jamu kunyit asam',          null,   45,   0.3,  11.0,   0.1,  0.3, 10.0,     6, '1 gelas',      200, true,  true, 'drink'),
  ('Jamu beras kencur',         null,   55,   0.6,  13.0,   0.2,  0.3, 11.5,     8, '1 gelas',      200, true,  true, 'drink'),
  ('Air tebu',                  null,   55,   0.2,  13.5,   0.1,  0.1, 13.0,     8, '1 gelas',      250, true,  true, 'drink'),
  ('Teh tarik',                 null,   85,   2.4,  13.0,   2.6,  0.0, 12.0,    38, '1 gelas',      250, true,  true, 'drink'),
  ('Es kopi susu gula aren',    null,   75,   1.2,  12.5,   2.2,  0.0, 11.0,    28, '1 gelas',      250, true,  true, 'drink'),
  ('Cokelat panas',             null,   95,   3.0,  14.5,   2.8,  0.8, 12.5,    55, '1 gelas',      250, true,  true, 'drink'),
  ('Jus jambu',                 null,   52,   0.7,  12.5,   0.3,  1.2, 10.5,     3, '1 gelas',      250, true,  true, 'drink'),
  ('Jus tomat',                 null,   20,   0.9,   4.2,   0.1,  0.4,  3.5,    10, '1 gelas',      250, true,  true, 'drink'),
  ('Jus wortel',                null,   40,   0.9,   9.3,   0.2,  0.8,  3.9,    66, '1 gelas',      250, true,  true, 'drink'),
  ('Susu almond tanpa gula',    null,   15,   0.6,   0.6,   1.2,  0.3,  0.0,    60, '1 gelas',      250, true,  true, 'drink'),
  ('Susu oat',                  null,   47,   0.8,   7.0,   1.5,  0.8,  4.0,    45, '1 gelas',      250, true,  true, 'drink'),
  -- ---- Kemasan ----------------------------------------------------
  ('Sarden kaleng saus tomat',  null,  180,  17.0,   4.0,  10.5,  0.5,  2.5,   480, '1/2 kaleng',    75, false, true, 'packaged'),
  ('Tuna kaleng dalam air',     null,  116,  25.5,   0.0,   0.8,  0.0,  0.0,   320, '1/2 kaleng',    70, false, true, 'packaged'),
  ('Mi instan cup',             null,  430,   9.0,  60.0,  17.0,  2.0,  4.0,  1800, '1 cup',         70, false, true, 'packaged'),
  ('Bubur instan',              null,  380,   8.0,  72.0,   6.0,  1.5,  6.0,  1100, '1 bungkus',     55, false, true, 'packaged'),
  ('Kopi instan sachet',        null,  410,   4.0,  82.0,   6.0,  0.5, 62.0,   190, '1 sachet',      20, false, true, 'packaged'),
  ('Teh kemasan botol',         null,   30,   0.0,   7.5,   0.0,  0.0,  7.5,    10, '1 botol',      350, true,  true, 'packaged'),
  ('Susu bubuk full cream',     null,  496,  26.3,  38.4,  26.7,  0.0, 38.4,   371, '3 sdm',         30, false, true, 'packaged'),
  ('Sereal granola',            null,  470,  10.0,  64.0,  18.0,  7.0, 20.0,   120, '1 mangkuk',     45, false, true, 'packaged'),
  ('Selai stroberi',            null,  250,   0.4,  62.0,   0.1,  1.0, 55.0,    30, '1 sdm',         20, false, true, 'packaged'),
  ('Es krim cone cokelat',      null,  290,   4.5,  36.0,  14.5,  1.2, 28.0,   110, '1 buah',        90, false, true, 'packaged'),
  ('Biskuit cokelat',           null,  490,   6.0,  64.0,  23.0,  2.5, 35.0,   340, '3 keping',      33, false, true, 'packaged'),
  ('Permen keras',              null,  390,   0.0,  98.0,   0.0,  0.0, 75.0,    20, '3 butir',       15, false, true, 'packaged'),
  ('Kacang kemasan panggang',   null,  580,  25.0,  21.0,  46.0,  8.0,  4.0,   420, '1 bungkus',     35, false, true, 'packaged'),
  ('Roti gandum kemasan',       null,  250,  12.0,  42.0,   3.5,  6.5,  5.0,   400, '2 lembar',      60, false, true, 'packaged'),
  -- ---- Bumbu dan lemak --------------------------------------------
  ('Kecap asin',                null,   60,   5.5,   5.5,   0.1,  0.8,  1.5,  5590, '1 sdm',         15, false, true, 'other'),
  ('Saus tiram',                null,   51,   2.0,  11.0,   0.0,  0.3,  4.0,  2730, '1 sdm',         15, false, true, 'other'),
  ('Terasi',                    null,  155,  30.0,   3.0,   2.0,  0.0,  0.0,  7000, '1 sdt',          5, false, true, 'other'),
  ('Petis udang',               null,  180,   8.0,  32.0,   2.0,  0.5, 20.0,  3200, '1 sdm',         15, false, true, 'other'),
  ('Bawang goreng',             null,  500,   6.0,  40.0,  35.0,  3.0,  5.0,   120, '1 sdm',         10, false, true, 'other'),
  ('Kerupuk kulit',             null,  480,  45.0,  12.0,  28.0,  0.0,  0.5,   900, '3 keping',      20, false, true, 'other'),
  ('Margarin',                  null,  717,   0.2,   0.7,  80.5,  0.0,  0.0,   751, '1 sdm',         14, false, true, 'other'),
  ('Minyak kelapa',             null,  862,   0.0,   0.0, 100.0,  0.0,  0.0,     0, '1 sdm',         14, false, true, 'other'),
  ('Minyak zaitun',             null,  884,   0.0,   0.0, 100.0,  0.0,  0.0,     2, '1 sdm',         14, false, true, 'other'),
  ('Krimer bubuk',              null,  545,   2.0,  58.0,  33.0,  0.0, 58.0,   180, '1 sdm',         12, false, true, 'other'),
  ('Sirup manis',               null,  280,   0.0,  70.0,   0.0,  0.0, 68.0,    25, '2 sdm',         30, false, true, 'other'),
  ('Tepung beras',              null,  366,   6.0,  80.0,   1.4,  2.4,  0.1,     0, '100 g',        100, false, true, 'other'),
  ('Tepung tapioka',            null,  358,   0.2,  88.7,   0.0,  0.9,  3.4,     1, '100 g',        100, false, true, 'other'),
  ('Kaldu bubuk',               null,  215,  12.0,  25.0,   7.0,  0.0,  5.0, 17000, '1 sdt',          4, false, true, 'other'),
  ('Gula aren cair',            null,  290,   0.0,  72.0,   0.0,  0.0, 68.0,    30, '1 sdm',         20, false, true, 'other')
  ) as v(name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
         sodium_mg, serving_label, serving_g, is_liquid, is_public, category)
 where not exists (
   select 1 from public.foods f
    where f.is_public and f.created_by is null
      and lower(f.name) = lower(v.name)
 );
