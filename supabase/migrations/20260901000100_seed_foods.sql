-- ============================================================================
-- Calorya — public food catalogue seed (Indonesian-first)
--
-- All values are per 100 g (or per 100 ml where is_liquid = true).
-- Figures are typical published values for home-cooked portions; they are
-- estimates, not lab measurements, and the UI says so.
-- ============================================================================

insert into public.foods
  (name, brand, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg,
   serving_label, serving_g, is_liquid, is_public)
values
  -- ---- Makanan pokok ------------------------------------------------------
  ('Nasi putih',            null, 130,  2.7,  28.2,  0.3,  0.4,  0.1,    1, '1 centong',        100, false, true),
  ('Nasi merah',            null, 111,  2.6,  23.0,  0.9,  1.8,  0.4,    5, '1 centong',        100, false, true),
  ('Nasi goreng',           null, 186,  5.6,  25.7,  6.6,  1.0,  1.5,  520, '1 porsi',          250, false, true),
  ('Bubur ayam',            null, 100,  4.5,  13.0,  3.2,  0.5,  0.8,  400, '1 mangkuk',        300, false, true),
  ('Mi goreng (matang)',    null, 180,  4.9,  25.0,  6.6,  1.2,  1.8,  600, '1 porsi',          200, false, true),
  ('Mi instan goreng',      null, 460, 10.0,  60.0, 20.0,  2.4,  4.0, 1700, '1 bungkus',         85, false, true),
  ('Roti tawar putih',      null, 265,  9.0,  49.0,  3.2,  2.7,  5.0,  490, '1 lembar',          30, false, true),
  ('Oatmeal (kering)',      null, 389, 16.9,  66.3,  6.9, 10.6,  0.0,    2, '1 takar',           40, false, true),
  ('Kentang rebus',         null,  87,  1.9,  20.1,  0.1,  1.8,  0.9,    5, '1 buah sedang',    150, false, true),
  ('Ubi jalar rebus',       null,  86,  1.6,  20.1,  0.1,  3.0,  4.2,   55, '1 buah sedang',    130, false, true),
  ('Jagung rebus',          null,  96,  3.4,  21.0,  1.5,  2.4,  4.5,   15, '1 buah',           150, false, true),
  ('Singkong rebus',        null, 160,  1.4,  38.1,  0.3,  1.8,  1.7,   14, '1 potong',         100, false, true),

  -- ---- Protein hewani -----------------------------------------------------
  ('Dada ayam tanpa kulit', null, 165, 31.0,   0.0,  3.6,  0.0,  0.0,   74, '1 potong',         120, false, true),
  ('Ayam goreng',           null, 260, 26.0,   8.0, 14.0,  0.3,  0.2,  460, '1 potong',         100, false, true),
  ('Ayam bakar',            null, 190, 27.0,   2.5,  8.0,  0.1,  1.4,  420, '1 potong',         100, false, true),
  ('Telur ayam rebus',      null, 155, 12.6,   1.1, 10.6,  0.0,  1.1,  124, '1 butir',           55, false, true),
  ('Telur dadar',           null, 154, 10.6,   0.6, 11.9,  0.0,  0.6,  155, '1 butir',           60, false, true),
  ('Ikan lele goreng',      null, 200, 19.0,   3.0, 12.0,  0.0,  0.0,  200, '1 ekor',           120, false, true),
  ('Ikan kembung goreng',   null, 220, 22.0,   1.0, 14.0,  0.0,  0.0,  180, '1 ekor',           100, false, true),
  ('Salmon panggang',       null, 208, 20.4,   0.0, 13.4,  0.0,  0.0,   59, '1 fillet',         150, false, true),
  ('Udang rebus',           null,  99, 24.0,   0.2,  0.3,  0.0,  0.0,  111, '1 porsi',          100, false, true),
  ('Daging sapi rendang',   null, 230, 15.0,   5.0, 17.0,  0.8,  2.0,  480, '1 potong',          80, false, true),
  ('Sate ayam (tanpa saus)',null, 225, 24.0,   3.0, 13.0,  0.2,  2.0,  380, '5 tusuk',          100, false, true),
  ('Bakso sapi',            null, 190, 12.0,  10.0, 11.0,  0.5,  0.6,  700, '5 butir',          100, false, true),

  -- ---- Protein nabati -----------------------------------------------------
  ('Tempe (mentah)',        null, 193, 19.0,   9.4, 11.0,  1.4,  0.0,    9, '1 potong',          50, false, true),
  ('Tempe goreng',          null, 225, 18.0,  10.0, 13.0,  1.4,  0.4,  120, '2 potong',          60, false, true),
  ('Tahu putih',            null,  76,  8.1,   1.9,  4.8,  0.4,  0.6,    7, '1 potong',          80, false, true),
  ('Tahu goreng',           null, 190, 11.0,   5.0, 14.0,  0.7,  0.6,  180, '2 potong',          70, false, true),
  ('Kacang tanah goreng',   null, 567, 25.8,  16.1, 49.2,  8.5,  4.7,   18, '1 genggam',         30, false, true),
  ('Kacang almond',         null, 579, 21.2,  21.6, 49.9, 12.5,  4.4,    1, '1 genggam',         28, false, true),

  -- ---- Sayur --------------------------------------------------------------
  ('Bayam rebus',           null,  23,  2.9,   3.6,  0.4,  2.2,  0.4,   79, '1 mangkuk',        100, false, true),
  ('Kangkung tumis',        null,  60,  2.6,   4.0,  4.0,  2.0,  0.8,  250, '1 porsi',          100, false, true),
  ('Brokoli rebus',         null,  35,  2.4,   7.2,  0.4,  3.3,  1.4,   41, '1 mangkuk',        100, false, true),
  ('Wortel',                null,  41,  0.9,   9.6,  0.2,  2.8,  4.7,   69, '1 buah',            60, false, true),
  ('Gado-gado',             null, 137,  6.0,  10.0,  8.0,  3.0,  3.5,  380, '1 porsi',          250, false, true),

  -- ---- Buah ---------------------------------------------------------------
  ('Pisang',                null,  89,  1.1,  22.8,  0.3,  2.6, 12.2,    1, '1 buah sedang',    118, false, true),
  ('Pepaya',                null,  43,  0.5,  10.8,  0.3,  1.7,  7.8,    8, '1 potong',         150, false, true),
  ('Mangga',                null,  60,  0.8,  15.0,  0.4,  1.6, 13.7,    1, '1 buah sedang',    200, false, true),
  ('Apel',                  null,  52,  0.3,  13.8,  0.2,  2.4, 10.4,    1, '1 buah sedang',    180, false, true),
  ('Jeruk',                 null,  47,  0.9,  11.8,  0.1,  2.4,  9.4,    0, '1 buah sedang',    130, false, true),
  ('Alpukat',               null, 160,  2.0,   8.5, 14.7,  6.7,  0.7,    7, '1/2 buah',         100, false, true),

  -- ---- Minuman (per 100 ml) ----------------------------------------------
  ('Air putih',             null,   0,  0.0,   0.0,  0.0,  0.0,  0.0,    0, '1 gelas',          250, true,  true),
  ('Susu UHT full cream',   null,  61,  3.2,   4.8,  3.3,  0.0,  4.8,   43, '1 gelas',          250, true,  true),
  ('Susu kedelai',          null,  54,  3.3,   6.0,  1.8,  0.6,  4.0,   51, '1 gelas',          250, true,  true),
  ('Yogurt plain',          null,  59, 10.0,   3.6,  0.4,  0.0,  3.2,   36, '1 cup',            170, true,  true),
  ('Kopi hitam tanpa gula', null,   1,  0.1,   0.0,  0.0,  0.0,  0.0,    2, '1 cangkir',        200, true,  true),
  ('Teh manis',             null,  30,  0.0,   7.5,  0.0,  0.0,  7.5,    3, '1 gelas',          250, true,  true),
  ('Es teh tawar',          null,   1,  0.0,   0.2,  0.0,  0.0,  0.0,    2, '1 gelas',          250, true,  true),

  -- ---- Lain-lain ----------------------------------------------------------
  ('Minyak goreng',         null, 884,  0.0,   0.0,100.0,  0.0,  0.0,    0, '1 sdm',             14, false, true),
  ('Gula pasir',            null, 387,  0.0, 100.0,  0.0,  0.0, 99.8,    1, '1 sdt',              4, false, true),
  ('Keju cheddar',          null, 402, 24.9,   1.3, 33.1,  0.0,  0.5,  621, '1 lembar',          20, false, true),
  ('Sambal terasi',         null,  90,  2.5,  10.0,  4.5,  2.0,  4.0,  900, '1 sdm',             15, false, true),
  ('Kerupuk udang',         null, 520,  4.0,  60.0, 28.0,  1.0,  1.5,  800, '3 keping',          15, false, true);
