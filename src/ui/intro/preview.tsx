// Пробная страница заставки: http://localhost:5173/intro.html
// Для проверок: ?t=0.5 — заморозить полёт на середине, ?ready — сразу собранный логотип и кнопки, ?save — есть сохранение.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../i18n';
import { Intro } from './Intro';

const params = new URLSearchParams(window.location.search);
const t = params.get('t');
const freeze = t !== null ? { flight: Number(t), logoReady: true } : params.has('ready') ? { logoReady: true } : undefined;

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root в intro.html');

createRoot(root).render(
  <StrictMode>
    <Intro hasSave={params.has('save')} freeze={freeze} onDone={(c) => console.info('intro done:', c)} />
  </StrictMode>,
);
