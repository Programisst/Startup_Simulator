// Вход страницы квартиры: http://localhost:5173/room.html
// По умолчанию — 3D-квартира. Старая пиксельная версия: room.html?pixel
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../i18n';
import { HeroSheet } from '../room3d/hero/HeroSheet';
import { Room3D } from '../room3d/Room3D';
import { RoomPrototype } from './RoomPrototype';

// Только на этой странице квартира занимает всё окно без прокрутки.
document.documentElement.classList.add('r3-standalone');

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root в room.html');

const params = new URLSearchParams(window.location.search);
const pixel = params.has('pixel');

createRoot(root).render(<StrictMode>{params.has('sheet') ? <HeroSheet /> : pixel ? <RoomPrototype /> : <Room3D />}</StrictMode>);
