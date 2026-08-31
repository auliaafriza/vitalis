import { z } from 'zod';

/**
 * Validation schemas shared by the web forms, the mobile forms, and the data
 * layer. One definition means the two apps cannot drift apart on what counts
 * as a valid entry — and the same messages are shown on both.
 */

export const sexSchema = z.enum(['male', 'female']);

export const activityLevelSchema = z.enum([
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);

export const goalSchema = z.enum(['lose', 'maintain', 'gain']);

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus berformat YYYY-MM-DD');

export const credentialsSchema = z.object({
  email: z.email('Alamat email tidak valid'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
});

export const onboardingSchema = z.object({
  fullName: z.string().trim().min(1, 'Nama tidak boleh kosong').max(80),
  birthDate: dateKeySchema.refine((value) => {
    const age = (Date.now() - new Date(value).getTime()) / 31_557_600_000;
    return age >= 13 && age <= 120;
  }, 'Usia harus antara 13 dan 120 tahun'),
  sex: sexSchema,
  heightCm: z.coerce.number().min(80, 'Tinggi minimal 80 cm').max(260, 'Tinggi maksimal 260 cm'),
  weightKg: z.coerce.number().min(20, 'Berat minimal 20 kg').max(400, 'Berat maksimal 400 kg'),
  activityLevel: activityLevelSchema,
  goal: goalSchema,
  timezone: z.string().min(1).default('Asia/Jakarta'),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const targetsSchema = z.object({
  kcal: z.coerce.number().int().min(800).max(8000),
  proteinG: z.coerce.number().int().min(0).max(500),
  carbsG: z.coerce.number().int().min(0).max(1000),
  fatG: z.coerce.number().int().min(0).max(400),
  fiberG: z.coerce.number().int().min(0).max(100),
  waterMl: z.coerce.number().int().min(500).max(8000),
  sleepMin: z.coerce.number().int().min(120).max(900),
  steps: z.coerce.number().int().min(0).max(100000),
});
export type TargetsInput = z.infer<typeof targetsSchema>;

export const weightEntrySchema = z.object({
  loggedOn: dateKeySchema,
  weightKg: z.coerce.number().min(20).max(400),
  bodyFatPct: z.coerce.number().min(1).max(70).nullable().optional(),
  note: z.string().max(280).nullable().optional(),
});
export type WeightEntryInput = z.infer<typeof weightEntrySchema>;

export const waterEntrySchema = z.object({
  loggedOn: dateKeySchema,
  amountMl: z.coerce
    .number()
    .int()
    .min(1, 'Jumlah minimal 1 ml')
    .max(3000, 'Sekali catat maksimal 3000 ml'),
});
export type WaterEntryInput = z.infer<typeof waterEntrySchema>;

export const sleepEntrySchema = z
  .object({
    loggedOn: dateKeySchema,
    bedtime: z.string().datetime({ offset: true }).nullable().optional(),
    wakeAt: z.string().datetime({ offset: true }).nullable().optional(),
    durationMin: z.coerce.number().int().min(0).max(1440),
    quality: z.coerce.number().int().min(1).max(5).nullable().optional(),
    note: z.string().max(280).nullable().optional(),
  })
  .refine(
    (v) => !v.bedtime || !v.wakeAt || new Date(v.wakeAt) > new Date(v.bedtime),
    { message: 'Waktu bangun harus setelah waktu tidur', path: ['wakeAt'] },
  );
export type SleepEntryInput = z.infer<typeof sleepEntrySchema>;

export const stepEntrySchema = z.object({
  loggedOn: dateKeySchema,
  steps: z.coerce.number().int().min(0).max(200000),
  distanceM: z.coerce.number().int().min(0).nullable().optional(),
  source: z.string().default('manual'),
});
export type StepEntryInput = z.infer<typeof stepEntrySchema>;

export const moodEntrySchema = z.object({
  loggedOn: dateKeySchema,
  score: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5).nullable().optional(),
  note: z.string().max(280).nullable().optional(),
});
export type MoodEntryInput = z.infer<typeof moodEntrySchema>;

export const foodSchema = z.object({
  name: z.string().trim().min(1, 'Nama makanan wajib diisi').max(120),
  brand: z.string().trim().max(80).nullable().optional(),
  barcode: z.string().trim().max(32).nullable().optional(),
  kcal: z.coerce.number().min(0).max(900),
  proteinG: z.coerce.number().min(0).max(100).default(0),
  carbsG: z.coerce.number().min(0).max(100).default(0),
  fatG: z.coerce.number().min(0).max(100).default(0),
  fiberG: z.coerce.number().min(0).max(100).default(0),
  sugarG: z.coerce.number().min(0).max(100).default(0),
  sodiumMg: z.coerce.number().min(0).max(50000).default(0),
  servingLabel: z.string().trim().max(40).nullable().optional(),
  servingG: z.coerce.number().positive().max(5000).nullable().optional(),
  isLiquid: z.boolean().default(false),
});
export type FoodInput = z.infer<typeof foodSchema>;

export const foodEntrySchema = z.object({
  foodId: z.uuid('Makanan tidak valid'),
  loggedOn: dateKeySchema,
  meal: mealTypeSchema,
  quantityG: z.coerce
    .number()
    .positive('Porsi harus lebih dari 0')
    .max(5000, 'Porsi maksimal 5000 g'),
});
export type FoodEntryInput = z.infer<typeof foodEntrySchema>;
