// Сцена после заставки: вечер в квартире, переписка с другом на компьютере, сон — и утро первого дня.
// Из переписки собирается своя партия. Нейросеть помогает понять идею; нет её — друг понимает по словам.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiAnalyzeIdea } from '../../ai/client';
import type { NewGameSetup } from '../../core';
import { RoomGuard } from '../office/GameRoom';
import { chatSetup, choose, reply, resolveIdea, startChat } from './chat';
import { Messenger } from './Messenger';

const Apartment = lazy(() => import('../apartment/Apartment').then((m) => ({ default: m.Apartment })));

/** Друг «думает» над идеей хотя бы столько, даже если нейросеть ответила мгновенно. */
const THINK_MS = 1600;
/** Пауза после последней реплики друга, прежде чем герой встаёт из-за стола. */
const LEAVE_MS = 2200;

export function Opening({ onStart }: { onStart: (setup: NewGameSetup) => void }) {
  const { t, i18n } = useTranslation();
  const [chat, setChat] = useState(startChat);
  const [settled, setSettled] = useState(false);
  const [finished, setFinished] = useState(false);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  // Начальное число партии берётся здесь, а не в ядре: ядро должно оставаться повторяемым.
  const seed = useMemo(() => Math.floor(Math.random() * 2 ** 31), []);

  // Друг думает над идеей: спрашиваем нейросеть, а если её нет — он поймёт по словам.
  useEffect(() => {
    if (chat.stage !== 'thinking') return;
    let alive = true;
    const started = performance.now();
    const lang = i18n.language === 'en' ? 'en' : 'ru';
    void aiAnalyzeIdea(`${chat.idea}. ${chat.audienceText}`, lang).then((review) => {
      const wait = Math.max(0, THINK_MS - (performance.now() - started));
      window.setTimeout(() => {
        if (alive) setChat((s) => resolveIdea(s, review));
      }, wait);
    });
    return () => {
      alive = false;
    };
  }, [chat.stage, chat.idea, chat.audienceText, i18n.language]);

  // Друг попрощался — герой встаёт и идёт спать.
  useEffect(() => {
    if (chat.stage !== 'done' || !settled) return;
    const id = window.setTimeout(() => setFinished(true), LEAVE_MS);
    return () => window.clearTimeout(id);
  }, [chat.stage, settled]);

  const onSlept = useCallback(() => onStart(chatSetup(chatRef.current, seed, t('new.defaultName'))), [onStart, seed, t]);

  const app = (
    <Messenger chat={chat} onReply={(text) => setChat((s) => reply(s, text))} onChoose={(id) => setChat((s) => choose(s, id))} onSettled={setSettled} />
  );

  return (
    <RoomGuard>
      <Suspense fallback={null}>
        <Apartment opening={{ app, title: t('opening.appTitle'), finished, onSlept }} />
      </Suspense>
    </RoomGuard>
  );
}
