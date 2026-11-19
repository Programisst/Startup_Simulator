// Темы стартапов: про что продукт. У каждой темы свои функции и свои особенности рынка.
// Названия функций лежат в src/content/<язык>/features.json, описания тем — в ui.json (new.themes, themeNotes).
// Множители рынка: 1 — без изменений. Числа подобраны так, чтобы темы ощущались по-разному, но ни одна не была обречена.
import type { ThemeDef } from '../core/types';

export const themes: ThemeDef[] = [
  {
    // Деньги доверяют неохотно: привлекать дороже, зато платят больше и уходят реже.
    id: 'finance',
    market: { cac: 1.3, price: 1.3, churn: 0.85 },
    features: [
      { id: 't_bankLink', cost: 22, value: 13 },
      { id: 't_budgets', cost: 14, value: 9 },
      { id: 't_taxExport', cost: 18, value: 10 },
      { id: 't_fraudCheck', cost: 26, value: 12 },
    ],
  },
  {
    // Здоровьем загораются быстро и так же быстро остывают: о продукте рассказывают, но бросают чаще.
    id: 'health',
    market: { churn: 1.15, viral: 1.2, conv: 1.1 },
    features: [
      { id: 't_wearables', cost: 24, value: 13 },
      { id: 't_smartReminders', cost: 10, value: 8 },
      { id: 't_doctorChat', cost: 30, value: 15 },
      { id: 't_healthPrivacy', cost: 20, value: 9 },
    ],
  },
  {
    // За учёбу платят неохотно, зато полезное находят сами и советуют друг другу.
    id: 'education',
    market: { organic: 1.25, price: 0.8, viral: 1.1 },
    features: [
      { id: 't_courses', cost: 20, value: 12 },
      { id: 't_quizzes', cost: 14, value: 10 },
      { id: 't_certificates', cost: 12, value: 8 },
      { id: 't_liveLessons', cost: 32, value: 15 },
    ],
  },
  {
    // Игры разлетаются по друзьям, но надоедают: приток большой, отток тоже, платят мало.
    id: 'games',
    market: { viral: 1.4, churn: 1.3, price: 0.7 },
    features: [
      { id: 't_newLevels', cost: 16, value: 12 },
      { id: 't_leaderboards', cost: 12, value: 9 },
      { id: 't_playWithFriends', cost: 36, value: 17 },
      { id: 't_dailyRewards', cost: 10, value: 9 },
    ],
  },
  {
    // Еда — дело местное: рынок меньше, зато привлекать дешевле. Привычки меняют легко.
    id: 'food',
    market: { marketSize: 0.8, cac: 0.9, churn: 1.1 },
    features: [
      { id: 't_photoMenu', cost: 14, value: 10 },
      { id: 't_courierMap', cost: 28, value: 14 },
      { id: 't_tableBooking', cost: 16, value: 10 },
      { id: 't_loyaltyCard', cost: 14, value: 9 },
    ],
  },
  {
    // Путешествуют пару раз в год: между поездками о продукте забывают, зато в поездке готовы платить.
    id: 'travel',
    market: { churn: 1.25, price: 1.2, viral: 1.2 },
    features: [
      { id: 't_routeMap', cost: 22, value: 13 },
      { id: 't_offlineGuides', cost: 18, value: 11 },
      { id: 't_stayBooking', cost: 28, value: 14 },
      { id: 't_tripDiary', cost: 12, value: 8 },
    ],
  },
  {
    // Рабочие инструменты выбирают долго и меняют редко: привлечь трудно, удержать легко.
    id: 'work',
    market: { cac: 1.2, price: 1.2, churn: 0.85 },
    features: [
      { id: 't_calendarSync', cost: 14, value: 10 },
      { id: 't_timeTracking', cost: 18, value: 11 },
      { id: 't_templates', cost: 10, value: 8 },
      { id: 't_roles', cost: 22, value: 11 },
    ],
  },
  {
    // Творческие люди охотно показывают работы и неохотно платят.
    id: 'creative',
    market: { viral: 1.3, conv: 0.85 },
    features: [
      { id: 't_gallery', cost: 14, value: 10 },
      { id: 't_builtInEditor', cost: 34, value: 16 },
      { id: 't_fanOrders', cost: 24, value: 13 },
      { id: 't_collab', cost: 20, value: 11 },
    ],
  },
  {
    // Семейными сервисами пользуются годами и находят по совету знакомых, но семей меньше, чем людей.
    id: 'family',
    market: { marketSize: 0.8, churn: 0.9, organic: 1.15 },
    features: [
      { id: 't_familyAccess', cost: 16, value: 11 },
      { id: 't_parentalControl', cost: 22, value: 12 },
      { id: 't_sharedCalendar', cost: 14, value: 9 },
      { id: 't_kidsMode', cost: 20, value: 11 },
    ],
  },
  {
    // Городской сервис нужен только своим: рынок маленький, зато соседи узнают друг от друга, и реклама дешёвая.
    id: 'city',
    market: { marketSize: 0.6, cac: 0.8, viral: 1.3 },
    features: [
      { id: 't_nearbyMap', cost: 20, value: 12 },
      { id: 't_districtNews', cost: 12, value: 8 },
      { id: 't_neighborsChat', cost: 18, value: 11 },
      { id: 't_cityServices', cost: 28, value: 12 },
    ],
  },
  {
    // Разработчики придирчивы, но за хороший инструмент платят и рассказывают коллегам.
    id: 'dev',
    market: { marketSize: 0.8, price: 1.2, viral: 1.2 },
    features: [
      { id: 't_commandLine', cost: 14, value: 10 },
      { id: 't_plugins', cost: 30, value: 15 },
      { id: 't_docs', cost: 12, value: 9 },
      { id: 't_buildIntegration', cost: 24, value: 13 },
    ],
  },
];
