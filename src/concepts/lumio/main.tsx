// Вход концепта «Люмио»: http://localhost:5173/concept-lumio.html
// Квартира основателя в пиксель-арте, вид сверху. Время суток: ?time=ЧЧ:ММ (по умолчанию 21:30).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../ui/i18n';
import texts from './texts.ru.json';
import { LumioRoom } from './LumioRoom';

// Свои тексты концепта подключаем к общим переводам, не трогая общие файлы.
i18n.addResourceBundle('ru', 'translation', { conceptLumio: texts }, true, true);

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root в concept-lumio.html');

createRoot(root).render(
  <StrictMode>
    <LumioRoom />
  </StrictMode>,
);
