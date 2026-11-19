import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/i18n';
import './ui/styles.css';
import { Root } from './ui/Root';

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root в index.html');

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
