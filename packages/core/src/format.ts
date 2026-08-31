import type { ActivityLevel, Goal, MealType, Sex } from './types';
import type { BmiCategory } from './health';

/** Indonesian display labels, kept beside the domain so both apps agree. */

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Sarapan',
  lunch: 'Makan siang',
  dinner: 'Makan malam',
  snack: 'Camilan',
};

export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '🍽️',
  dinner: '🌙',
  snack: '🍎',
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Jarang bergerak',
  light: 'Aktivitas ringan',
  moderate: 'Aktivitas sedang',
  active: 'Aktif',
  very_active: 'Sangat aktif',
};

export const ACTIVITY_HINT: Record<ActivityLevel, string> = {
  sedentary: 'Kerja duduk, hampir tidak olahraga',
  light: 'Olahraga ringan 1-3 hari/minggu',
  moderate: 'Olahraga sedang 3-5 hari/minggu',
  active: 'Olahraga berat 6-7 hari/minggu',
  very_active: 'Pekerjaan fisik atau latihan dua kali sehari',
};

export const GOAL_LABEL: Record<Goal, string> = {
  lose: 'Turunkan berat badan',
  maintain: 'Pertahankan berat badan',
  gain: 'Naikkan massa otot',
};

export const SEX_LABEL: Record<Sex, string> = {
  male: 'Laki-laki',
  female: 'Perempuan',
};

export const BMI_LABEL: Record<BmiCategory, string> = {
  underweight: 'Berat kurang',
  normal: 'Normal',
  overweight: 'Berat berlebih',
  obese_1: 'Obesitas I',
  obese_2: 'Obesitas II',
};

const nf = new Intl.NumberFormat('id-ID');

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatKcal(value: number): string {
  return `${nf.format(Math.round(value))} kkal`;
}

export function formatGrams(value: number): string {
  return `${formatNumber(value, value < 10 ? 1 : 0)} g`;
}

/** 1750 -> "1,75 L" ; 300 -> "300 ml" */
export function formatVolume(ml: number): string {
  return ml >= 1000 ? `${formatNumber(ml / 1000, 2)} L` : `${nf.format(ml)} ml`;
}

export function formatWeight(kg: number): string {
  return `${formatNumber(kg, 1)} kg`;
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/** "2026-08-31" -> "Sen, 31 Agu" — parsed as UTC so the label never shifts. */
export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return dateKey;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${DAY_NAMES[date.getUTCDay()]}, ${d} ${MONTH_NAMES[m - 1]}`;
}

/** "2026-08-31" -> "31 Agu" */
export function formatShortDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  if (m === undefined || d === undefined) return dateKey;
  return `${d} ${MONTH_NAMES[m - 1]}`;
}

export function relativeDayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Hari ini';
  const [ty, tm, td] = todayKey.split('-').map(Number);
  if (ty === undefined || tm === undefined || td === undefined) return formatDayLabel(dateKey);
  const yesterday = new Date(Date.UTC(ty, tm - 1, td - 1)).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.UTC(ty, tm - 1, td + 1)).toISOString().slice(0, 10);
  if (dateKey === yesterday) return 'Kemarin';
  if (dateKey === tomorrow) return 'Besok';
  return formatDayLabel(dateKey);
}
