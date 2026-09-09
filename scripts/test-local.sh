#!/usr/bin/env bash
#
# Calorya — jalankan semua pemeriksaan di mesin sendiri.
#
#   ./scripts/test-local.sh          # semuanya
#   ./scripts/test-local.sh --cepat  # lewati bagian database (tanpa Docker)
#
# Empat lapis, dari yang paling murah ke yang paling mahal:
#
#   1. Unit test      — perhitungan gizi, tanggal, entitlement (@calorya/core, @calorya/api)
#   2. Typecheck      — 4 workspace, tanpa emit
#   3. Test SQL       — RLS, trigger, paywall, gerbang tutorial, di Postgres sungguhan
#   4. Build          — Next.js dan bundle Android
#
# Nomor 3 butuh Supabase lokal (Docker). psql TIDAK perlu dipasang: perintahnya
# dijalankan di dalam kontainer database lewat `docker exec`, jadi satu-satunya
# syarat adalah Docker plus Supabase CLI.
#
# Skrip ini tidak pernah menyentuh database produksi. `supabase db reset`
# hanya mengenai kontainer lokal di port 54322.

set -uo pipefail
cd "$(dirname "$0")/.."

CEPAT=0
[ "${1:-}" = "--cepat" ] && CEPAT=1

# Warna hanya kalau keluarannya terminal, supaya aman dipipe ke file.
if [ -t 1 ]; then
  H='\033[1m'; HIJAU='\033[32m'; MERAH='\033[31m'; KUNING='\033[33m'; N='\033[0m'
else
  H=''; HIJAU=''; MERAH=''; KUNING=''; N=''
fi

# Dikumpulkan sebagai teks berbaris, bukan array: bash bawaan macOS masih 3.2,
# dan di sana `${#ARR[@]}` pada array kosong dengan `set -u` justru meledak —
# skrip pemeriksa yang gagal karena dirinya sendiri adalah lelucon yang buruk.
GAGAL=""
LEWAT=""
N_GAGAL=0
N_LEWAT=0

judul() { printf "\n${H}▸ %s${N}\n" "$1"; }
lolos()  { printf "  ${HIJAU}✓${N} %s\n" "$1"; }
gagal()  { printf "  ${MERAH}✗${N} %s\n" "$1"; GAGAL="${GAGAL}${1}\n"; N_GAGAL=$((N_GAGAL + 1)); }
lewati() { printf "  ${KUNING}–${N} %s\n" "$1"; LEWAT="${LEWAT}${1}\n"; N_LEWAT=$((N_LEWAT + 1)); }

# ---------------------------------------------------------------------------
# 1. Unit test
# ---------------------------------------------------------------------------
judul "1/4  Unit test (@calorya/core, @calorya/api)"
if npm test 2>&1 | tee /tmp/calorya-unit.log | grep -E "Test Files|Tests "; then
  if grep -q "failed" /tmp/calorya-unit.log; then
    gagal "unit test"
  else
    lolos "unit test"
  fi
else
  gagal "unit test (lihat /tmp/calorya-unit.log)"
fi

# ---------------------------------------------------------------------------
# 2. Typecheck
# ---------------------------------------------------------------------------
judul "2/4  Typecheck 4 workspace"
if npm run typecheck > /tmp/calorya-tsc.log 2>&1; then
  lolos "typecheck bersih"
else
  gagal "typecheck"
  grep -E "error TS" /tmp/calorya-tsc.log | head -10
fi

# ---------------------------------------------------------------------------
# 3. Test SQL
# ---------------------------------------------------------------------------
judul "3/4  Test SQL (RLS, trigger, paywall, tutorial)"
DB_CONTAINER="supabase_db_calorya"

if [ "$CEPAT" = "1" ]; then
  lewati "test SQL (dilewati dengan --cepat)"
elif ! command -v supabase > /dev/null; then
  lewati "test SQL — Supabase CLI belum terpasang (brew install supabase/tap/supabase)"
elif ! docker info > /dev/null 2>&1; then
  lewati "test SQL — Docker belum jalan (buka Docker Desktop dulu)"
else
  # Menyalakan Supabase kalau belum, lalu menerapkan SELURUH migrasi dari nol.
  # Dari nol, bukan tambal: itulah satu-satunya cara membuktikan migrasi baru
  # jalan di database kosong, yang persis situasi kolaborator berikutnya.
  if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "  menyalakan Supabase lokal…"
    supabase start > /tmp/calorya-supabase.log 2>&1 || {
      gagal "supabase start (lihat /tmp/calorya-supabase.log)"
    }
  fi

  if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "  menerapkan migrasi dari nol…"
    if supabase db reset > /tmp/calorya-reset.log 2>&1; then
      lolos "semua migrasi jalan di database kosong"
    else
      gagal "supabase db reset (lihat /tmp/calorya-reset.log)"
    fi

    for berkas in rls_and_triggers entitlements paywall_switch tutorial; do
      keluaran=$(docker exec -i "$DB_CONTAINER" \
        psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
        < "supabase/tests/${berkas}.sql" 2>&1)
      jumlah=$(printf '%s' "$keluaran" | grep -c "PASS:")
      if printf '%s' "$keluaran" | grep -qiE "^ERROR|FAIL:"; then
        gagal "supabase/tests/${berkas}.sql"
        printf '%s\n' "$keluaran" | grep -iE "^ERROR|FAIL:" | head -5
      else
        lolos "${berkas}.sql — ${jumlah} pemeriksaan"
      fi
    done

    # Katalog makanan: bukan sekadar "migrasi jalan", tapi datanya benar-benar
    # ada. Migrasi yang sukses tapi menyisipkan nol baris adalah kegagalan yang
    # diam-diam, dan itu jenis yang paling lama tidak ketahuan.
    jumlah_makanan=$(docker exec -i "$DB_CONTAINER" \
      psql -U postgres -d postgres -Atc \
      "select count(*) from public.foods where is_public" 2>/dev/null | tr -d '\r')
    if [ "${jumlah_makanan:-0}" -ge 350 ]; then
      lolos "katalog makanan berisi ${jumlah_makanan} item"
    else
      gagal "katalog makanan hanya ${jumlah_makanan:-0} item (harusnya 350+)"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 4. Build
# ---------------------------------------------------------------------------
judul "4/4  Build"
if npm run build:web > /tmp/calorya-web.log 2>&1; then
  lolos "build Next.js"
else
  gagal "build Next.js (lihat /tmp/calorya-web.log)"
fi

echo "  membundel Android (butuh satu menit)…"
if (cd apps/mobile && npx expo export:embed --eager --platform android --dev false \
      --bundle-output /tmp/calorya.bundle --assets-dest /tmp/calorya-assets) \
      > /tmp/calorya-metro.log 2>&1; then
  modul=$(grep -oE "\([0-9]+ modules\)" /tmp/calorya-metro.log | tail -1)
  lolos "bundle Android ${modul}"
else
  gagal "bundle Android (lihat /tmp/calorya-metro.log)"
fi

# ---------------------------------------------------------------------------
# Ringkasan
# ---------------------------------------------------------------------------
printf "\n${H}────────────────────────────────${N}\n"
if [ "$N_LEWAT" -gt 0 ]; then
  printf "${KUNING}Dilewati:${N}\n"
  printf "$LEWAT" | sed 's/^/  – /'
fi
if [ "$N_GAGAL" -eq 0 ]; then
  printf "${HIJAU}${H}Semua pemeriksaan lolos.${N}\n"
  exit 0
fi
printf "${MERAH}${H}%d gagal:${N}\n" "$N_GAGAL"
printf "$GAGAL" | sed 's/^/  ✗ /'
exit 1
