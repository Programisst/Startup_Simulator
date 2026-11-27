// Подключение переводов. Все тексты интерфейса лежат в src/content/<язык>/.
// Английский перевод экранов появится на этапе публичной демо-версии;
// пока недостающие английские строки берутся из русских.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enEvents from '../content/en/events.json';
import enUi from '../content/en/ui.json';
import ruCoworking from '../content/ru/coworking.json';
import ruEvents from '../content/ru/events.json';
import ruFeatures from '../content/ru/features.json';
import ruIntro from '../content/ru/intro.json';
import ruLaptop from '../content/ru/laptop.json';
import ruOpening from '../content/ru/opening.json';
import ruRoom from '../content/ru/room.json';
import ruUi from '../content/ru/ui.json';

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: { ...ruUi, coworking: ruCoworking, events: ruEvents, features: ruFeatures, room: ruRoom, laptop: ruLaptop, intro: ruIntro, opening: ruOpening } },
    en: { translation: { ...enUi, events: enEvents } },
  },
  lng: 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;
