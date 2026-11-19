// Данные для экрана создания компании: словарь для разбора идеи игрока,
// темы и готовые идеи-подсказки, слоги для названий.
// Тексты идей и названия тем лежат в переводах (new.ideas.*, new.themes.*), здесь — только связи и слова для поиска.
import type { BusinessModel, IdeaLexicon, ProductTypeId } from '../core';

/** Слова пишутся строчными, «ё» заменена на «е». Слово из списка — это начало слова в тексте. */
export const ideaLexicon: IdeaLexicon = {
  productTypes: {
    saas: ['бизнес', 'компани', 'crm', 'учет', 'бухгалтер', 'склад', 'документ', 'сотрудник', 'команд', 'офис', 'b2b', 'отчет', 'планировщик', 'задач', 'счета', 'касс', 'business', 'team', 'invoice'],
    social: ['соцсет', 'социальн', 'общени', 'друз', 'лент', 'знакомств', 'сообществ', 'чат', 'подписчик', 'блог', 'мессенджер', 'social', 'friends', 'community', 'dating', 'feed'],
    mobile: ['приложени', 'мобильн', 'телефон', 'смартфон', 'трекер', 'фитнес', 'привычк', 'медитац', 'app', 'mobile'],
    ai: ['ии', 'ai', 'нейросет', 'искусственн', 'интеллект', 'gpt', 'бот', 'ассистент', 'генер', 'распозна', 'помощник', 'chatbot', 'neural'],
    marketplace: ['маркетплейс', 'площадк', 'прода', 'покуп', 'аренд', 'доставк', 'заказ', 'исполнител', 'объявлен', 'бронир', 'сделк', 'биржа', 'marketplace', 'rent', 'delivery', 'booking'],
    game: ['игра', 'игры', 'игру', 'игре', 'игрой', 'игрок', 'игров', 'геймер', 'уровн', 'головоломк', 'шутер', 'стратеги', 'аркад', 'квест', 'rpg', 'game', 'gamer', 'puzzle'],
    devtools: ['разработчик', 'программист', 'код', 'api', 'библиотек', 'сервер', 'деплой', 'тестирован', 'баг', 'git', 'sdk', 'хостинг', 'devops', 'опенсорс', 'developer'],
  },
  audiences: {
    smallBusiness: ['бизнес', 'магазин', 'кафе', 'ресторан', 'салон', 'предпринимател', 'мастерск', 'небольш', 'shop'],
    enterprise: ['корпорац', 'крупн', 'банк', 'завод', 'холдинг', 'enterprise'],
    freelancers: ['фриланс', 'самозанят', 'репетитор', 'дизайнер', 'гид', 'freelance'],
    everyone: ['все', 'люд', 'кажд', 'сосед', 'everyone'],
    students: ['студент', 'школьник', 'учени', 'университет', 'вуз', 'экзамен', 'student'],
    professionals: ['специалист', 'врач', 'юрист', 'професси', 'карьер', 'резюме'],
    parents: ['родител', 'дет', 'ребен', 'мам', 'семь'],
    developers: ['разработчик', 'программист', 'developer'],
    gamers: ['геймер', 'заядл', 'киберспорт', 'gamer'],
  },
  models: {
    subscription: ['подписк', 'ежемесячн', 'тариф', 'subscription'],
    ads: ['реклам', 'бесплатн', 'ads'],
    oneTime: ['разов', 'один раз', 'навсегда', 'лицензи'],
    commission: ['комисси', 'процент'],
  },
  defaultModel: {
    saas: 'subscription',
    social: 'ads',
    mobile: 'subscription',
    ai: 'subscription',
    marketplace: 'commission',
    devtools: 'subscription',
    game: 'ads',
  },
};

export const ideaThemes = ['finance', 'health', 'education', 'games', 'food', 'travel', 'work', 'creative', 'family', 'city', 'dev'] as const;
export type IdeaThemeId = (typeof ideaThemes)[number];

/** По каким словам в идее узнаётся тема. Слова — начала слов, строчными, «ё» заменена на «е». */
export const themeLexicon: Record<IdeaThemeId, string[]> = {
  finance: ['деньг', 'финанс', 'бюджет', 'трат', 'налог', 'счет', 'бухгалтер', 'инвест', 'банк', 'оплат', 'money', 'finance', 'budget'],
  health: ['здоров', 'врач', 'фитнес', 'спорт', 'трениров', 'привычк', 'сон', 'медитац', 'питани', 'пациент', 'health', 'fitness'],
  education: ['учеб', 'урок', 'курс', 'студент', 'школьник', 'экзамен', 'репетитор', 'конспект', 'обучени', 'вуз', 'learn', 'course'],
  games: ['игра', 'игры', 'игру', 'игре', 'игрой', 'игрок', 'игров', 'геймер', 'уровн', 'головоломк', 'шутер', 'киберспорт', 'game', 'gamer'],
  food: ['еда', 'еды', 'кафе', 'ресторан', 'рецепт', 'повар', 'обед', 'доставк', 'кофе', 'продукт', 'food', 'recipe'],
  travel: ['путешеств', 'поездк', 'маршрут', 'экскурс', 'гид', 'отел', 'турист', 'попутчик', 'travel', 'trip'],
  work: ['задач', 'команд', 'резюме', 'ваканси', 'собеседован', 'офис', 'сотрудник', 'планировщик', 'карьер', 'work', 'team'],
  creative: ['дизайн', 'художник', 'музык', 'ролик', 'шаблон', 'творч', 'рисун', 'фото', 'design', 'music', 'art'],
  family: ['родител', 'ребен', 'дети', 'детей', 'детск', 'семь', 'нян', 'собак', 'питом', 'кружк', 'family', 'kids', 'pet'],
  city: ['сосед', 'район', 'город', 'двор', 'аренд', 'магазин', 'дом', 'city', 'neighbor'],
  dev: ['разработчик', 'программист', 'код', 'кода', 'коде', 'api', 'sdk', 'сервер', 'тестирован', 'developer', 'code'],
};

/** Готовая идея-подсказка: её текст лежит в переводах под ключом new.ideas.<id>. */
export interface IdeaSeed {
  id: string;
  theme: IdeaThemeId;
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
}

export const ideaSeeds: IdeaSeed[] = [
  { id: 'budgetApp', theme: 'finance', productType: 'mobile', audienceId: 'everyone', businessModel: 'subscription' },
  { id: 'invoiceSaas', theme: 'finance', productType: 'saas', audienceId: 'smallBusiness', businessModel: 'subscription' },
  { id: 'freelanceTax', theme: 'finance', productType: 'saas', audienceId: 'freelancers', businessModel: 'subscription' },

  { id: 'habitTracker', theme: 'health', productType: 'mobile', audienceId: 'everyone', businessModel: 'subscription' },
  { id: 'doctorNotes', theme: 'health', productType: 'ai', audienceId: 'professionals', businessModel: 'subscription' },
  { id: 'trainers', theme: 'health', productType: 'marketplace', audienceId: 'everyone', businessModel: 'commission' },

  { id: 'aiTutor', theme: 'education', productType: 'ai', audienceId: 'students', businessModel: 'subscription' },
  { id: 'tutorsMarket', theme: 'education', productType: 'marketplace', audienceId: 'freelancers', businessModel: 'commission' },
  { id: 'studentsNet', theme: 'education', productType: 'social', audienceId: 'students', businessModel: 'ads' },

  { id: 'puzzleGame', theme: 'games', productType: 'game', audienceId: 'everyone', businessModel: 'ads' },
  { id: 'farmGame', theme: 'games', productType: 'game', audienceId: 'everyone', businessModel: 'ads' },
  { id: 'arenaGame', theme: 'games', productType: 'game', audienceId: 'gamers', businessModel: 'oneTime' },
  { id: 'gamersNet', theme: 'games', productType: 'social', audienceId: 'everyone', businessModel: 'ads' },
  { id: 'gameAnalytics', theme: 'games', productType: 'devtools', audienceId: 'developers', businessModel: 'subscription' },

  { id: 'cafeCrm', theme: 'food', productType: 'saas', audienceId: 'smallBusiness', businessModel: 'subscription' },
  { id: 'homeCooks', theme: 'food', productType: 'marketplace', audienceId: 'everyone', businessModel: 'commission' },
  { id: 'aiRecipes', theme: 'food', productType: 'ai', audienceId: 'students', businessModel: 'subscription' },

  { id: 'tripPlanner', theme: 'travel', productType: 'ai', audienceId: 'students', businessModel: 'subscription' },
  { id: 'localGuides', theme: 'travel', productType: 'marketplace', audienceId: 'freelancers', businessModel: 'commission' },
  { id: 'travelNet', theme: 'travel', productType: 'social', audienceId: 'everyone', businessModel: 'ads' },

  { id: 'teamTasks', theme: 'work', productType: 'saas', audienceId: 'smallBusiness', businessModel: 'subscription' },
  { id: 'aiResume', theme: 'work', productType: 'ai', audienceId: 'professionals', businessModel: 'subscription' },
  { id: 'proNet', theme: 'work', productType: 'social', audienceId: 'professionals', businessModel: 'ads' },

  { id: 'designMarket', theme: 'creative', productType: 'marketplace', audienceId: 'freelancers', businessModel: 'commission' },
  { id: 'aiMusic', theme: 'creative', productType: 'ai', audienceId: 'smallBusiness', businessModel: 'subscription' },
  { id: 'artNet', theme: 'creative', productType: 'social', audienceId: 'everyone', businessModel: 'ads' },

  { id: 'kidsSchedule', theme: 'family', productType: 'mobile', audienceId: 'parents', businessModel: 'subscription' },
  { id: 'nannies', theme: 'family', productType: 'marketplace', audienceId: 'everyone', businessModel: 'commission' },
  { id: 'petsApp', theme: 'family', productType: 'mobile', audienceId: 'everyone', businessModel: 'oneTime' },

  { id: 'rentThings', theme: 'city', productType: 'marketplace', audienceId: 'everyone', businessModel: 'commission' },
  { id: 'shopSaas', theme: 'city', productType: 'saas', audienceId: 'smallBusiness', businessModel: 'subscription' },
  { id: 'neighborsNet', theme: 'city', productType: 'social', audienceId: 'everyone', businessModel: 'ads' },

  { id: 'errorMonitor', theme: 'dev', productType: 'devtools', audienceId: 'developers', businessModel: 'subscription' },
  { id: 'apiTests', theme: 'dev', productType: 'devtools', audienceId: 'enterprise', businessModel: 'subscription' },
  { id: 'learnCode', theme: 'dev', productType: 'devtools', audienceId: 'students', businessModel: 'oneTime' },
];

/** Выдуманные слоги для названий компаний: начало + конец. */
export const nameParts = {
  starts: ['Nova', 'Luma', 'Kvant', 'Orbi', 'Zeno', 'Vela', 'Tempo', 'Pixo', 'Astra', 'Ferro', 'Lyra', 'Runa', 'Sigma', 'Brio'],
  ends: ['ly', 'io', 'hub', 'lab', 'flow', 'ix', 'ora', 'base', 'wave', 'nest', 'desk', 'mint'],
};
