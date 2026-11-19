// Пробная страница квартиры без партии: http://localhost:5173/room.html
// Время суток: ?time=ЧЧ:ММ (по умолчанию 21:30).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../i18n';
import { Apartment } from './Apartment';

document.documentElement.classList.add('lm-standalone');

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root в room.html');

createRoot(root).render(
  <StrictMode>
    <Apartment />
  </StrictMode>,
);
