// Города, где можно основать компанию. Все цифры настоящие — открытая статистика США.
// Что они значат в игре, считает src/core/cities.ts; описание — docs/02-economy.md, раздел 36.
//
// Источники (собраны 27 ноября 2026):
// - devJobs, devWage — программисты (Software Developers, код 15-1252): число рабочих мест и средняя годовая зарплата.
//   Бюро трудовой статистики США, обследование занятости и зарплат по профессиям (BLS OEWS), май 2025.
// - marketerWage — аналитики рынка и маркетологи (код 13-1161), средняя годовая зарплата. Тот же источник.
// - priceLevel — региональный паритет цен, все товары и услуги, США = 100. Бюро экономического анализа (BEA), 2024 год.
// - officeRent — средняя запрашиваемая аренда офиса, $ за квадратный фут в год, все классы зданий.
//   CommercialEdge / Yardi, данные на октябрь 2026. Роли и Солт-Лейк-Сити — Cushman & Wakefield, III квартал 2026 (другая методика).
//   Нью-Йорк — только Манхэттен; Сан-Хосе — рынок «Bay Area» у Yardi, его границы не проверены.
// - venture — сумма венчурных сделок за 2024 год, $ млрд. Ежегодник NVCA 2025 (данные PitchBook), таблица по городам.
//   Границы городов в этой таблице уже, чем в статистике труда.
import type { CityDef, CountryDef } from '../core/types';

/** Средние цифры по США из тех же источников. */
export const country: CountryDef = { devWage: 148_100, marketerWage: 89_490, officeRent: 33.3 };

// Первым идёт Остин — ближе всех к среднему по стране: он выбран по умолчанию на экране новой партии.
export const cities: CityDef[] = [
  { id: 'austin', devJobs: 31_960, devWage: 143_630, marketerWage: 89_840, priceLevel: 98.1, officeRent: 46.61, venture: 3.68 },
  { id: 'sanFrancisco', devJobs: 69_030, devWage: 193_430, marketerWage: 130_760, priceLevel: 115.6, officeRent: 64.31, venture: 65.25 },
  { id: 'sanJose', devJobs: 87_350, devWage: 221_710, marketerWage: 154_130, priceLevel: 110.4, officeRent: 56.18, venture: 34.13 },
  { id: 'newYork', devJobs: 121_000, devWage: 165_870, marketerWage: 106_310, priceLevel: 112.6, officeRent: 74.44, venture: 26.59 },
  { id: 'boston', devJobs: 42_310, devWage: 162_440, marketerWage: 109_840, priceLevel: 108.3, officeRent: 47.71, venture: 15.51 },
  { id: 'seattle', devJobs: 92_770, devWage: 174_920, marketerWage: 116_050, priceLevel: 111.1, officeRent: 35.17, venture: 3.51 },
  { id: 'losAngeles', devJobs: 55_540, devWage: 161_900, marketerWage: 95_930, priceLevel: 113.6, officeRent: 47.79, venture: 11.21 },
  { id: 'denver', devJobs: 27_010, devWage: 149_400, marketerWage: 103_200, priceLevel: 105.8, officeRent: 31.45, venture: 3.49 },
  { id: 'chicago', devJobs: 40_370, devWage: 141_640, marketerWage: 90_330, priceLevel: 103.6, officeRent: 27.78, venture: 2.69 },
  { id: 'atlanta', devJobs: 36_300, devWage: 135_870, marketerWage: 88_200, priceLevel: 100.1, officeRent: 38.93, venture: 1.43 },
  { id: 'miami', devJobs: 18_900, devWage: 144_730, marketerWage: 82_060, priceLevel: 114.2, officeRent: 63.58, venture: 2.15 },
  { id: 'raleigh', devJobs: 12_580, devWage: 136_640, marketerWage: 89_970, priceLevel: 98.2, officeRent: 31.6, venture: 1.87 },
  { id: 'saltLakeCity', devJobs: 19_040, devWage: 131_400, marketerWage: 72_690, priceLevel: 100.9, officeRent: 26.64, venture: 0.81 },
];
