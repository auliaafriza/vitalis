-- ============================================================================
-- Calorya — food categories
--
-- The "Kategori Populer" grid needs a category to browse by. Deriving one from
-- the food's name at read time was the cheaper option and the wrong one: it
-- would guess differently on every screen, and it cannot classify the foods a
-- user imports by barcode, which is exactly where a guess is least reliable.
-- ============================================================================

create type public.food_category as enum (
  'main',       -- Makanan Utama
  'snack',      -- Camilan
  'drink',      -- Minuman
  'fruit',      -- Buah
  'vegetable',  -- Sayur
  'packaged',   -- Makanan Kemasan
  'other'       -- Bumbu, minyak, gula — real foods, just not worth a tile
);

-- 'other' rather than 'main' as the default: an unclassified food should look
-- unclassified, not quietly inflate the category people browse most.
alter table public.foods
  add column category public.food_category not null default 'other';

create index foods_category_idx on public.foods (category) where is_public;

-- ---------------------------------------------------------------------------
-- Classify the seed catalogue.
--
-- Written as explicit name lists rather than LIKE patterns so that the
-- classification is reviewable: 'Susu kedelai' is a drink and 'Tahu putih' is
-- a main, and no pattern gets both right.
-- ---------------------------------------------------------------------------
update public.foods set category = 'main' where name in (
  'Nasi putih', 'Nasi merah', 'Nasi goreng', 'Bubur ayam', 'Mi goreng (matang)',
  'Roti tawar putih', 'Oatmeal (kering)', 'Kentang rebus', 'Ubi jalar rebus',
  'Jagung rebus', 'Singkong rebus',
  'Dada ayam tanpa kulit', 'Ayam goreng', 'Ayam bakar', 'Telur ayam rebus',
  'Telur dadar', 'Ikan lele goreng', 'Ikan kembung goreng', 'Salmon panggang',
  'Udang rebus', 'Daging sapi rendang', 'Sate ayam (tanpa saus)', 'Bakso sapi',
  'Tempe (mentah)', 'Tempe goreng', 'Tahu putih', 'Tahu goreng', 'Gado-gado'
);

update public.foods set category = 'snack' where name in (
  'Kacang tanah goreng', 'Kacang almond', 'Kerupuk udang'
);

update public.foods set category = 'drink' where name in (
  'Air putih', 'Susu UHT full cream', 'Susu kedelai', 'Kopi hitam tanpa gula',
  'Teh manis', 'Es teh tawar'
);

update public.foods set category = 'fruit' where name in (
  'Pisang', 'Pepaya', 'Mangga', 'Apel', 'Jeruk', 'Alpukat'
);

update public.foods set category = 'vegetable' where name in (
  'Bayam rebus', 'Kangkung tumis', 'Brokoli rebus', 'Wortel'
);

update public.foods set category = 'packaged' where name in (
  'Mi instan goreng', 'Yogurt plain', 'Keju cheddar'
);

-- Minyak goreng, Gula pasir and Sambal terasi keep 'other' on purpose: they
-- are ingredients people log as part of a dish, not things they browse for.

-- ---------------------------------------------------------------------------
-- search_foods() must return the new column, and gains a category filter so
-- the grid and the search box are the same query with different arguments.
-- ---------------------------------------------------------------------------
-- The old two-argument function is DROPped rather than replaced: adding a
-- parameter with a default creates an overload, and PostgREST would then have
-- two candidates for the same RPC name and refuse to choose.
drop function if exists public.search_foods(text, int);

/**
 * Search, optionally narrowed to one category.
 *
 * `in_category` is not called `category`: a parameter sharing a name with a
 * column makes `f.category = category` ambiguous, and Postgres resolves that
 * silently in the parameter's favour — the filter would match every row.
 *
 * Still SECURITY INVOKER, so the RLS policy on `foods` (public rows plus your
 * own) is what decides visibility, exactly as before.
 */
create or replace function public.search_foods(
  query       text,
  max_results int default 25,
  in_category public.food_category default null
)
returns setof public.foods
language sql
stable
as $$
  select f.*
    from public.foods f
   where (in_category is null or f.category = in_category)
     and (
       query is null
       or length(trim(query)) = 0
       or f.search_vector @@ plainto_tsquery('simple', query)
       or f.name ilike '%' || query || '%'
     )
   order by
     -- exact prefix matches first, then full-text rank, then alphabetically.
     -- nullif() keeps an empty query from emitting a "no lexemes" notice.
     (f.name ilike coalesce(query, '') || '%') desc,
     ts_rank(
       f.search_vector,
       plainto_tsquery('simple', coalesce(nullif(trim(query), ''), 'zzzznomatch'))
     ) desc,
     f.name
   limit least(coalesce(max_results, 25), 100);
$$;

grant execute on function public.search_foods(text, int, public.food_category)
  to authenticated;
