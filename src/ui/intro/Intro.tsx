// Заставка входа: город на закате, логотип собирается из пикселей, над городом растёт график.
// «Новая игра» — логотип рассыпается, камера летит к окну основателя и влетает в экран его компьютера.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hash } from '../apartment/engine/art';
import { drawEditorScreen } from '../apartment/engine/editorScreen';
import { MonitorTyping } from '../apartment/engine/monitor';
import { FLIGHT_SECONDS, flightCamera, HOME_SCREEN, HOME_WINDOW, INTERIOR, LOGO, logoPixels, paintCity, paintInterior, SCENE_H, SCENE_W } from './scene';
import './intro.css';

type Phase = 'title' | 'flight';

export interface IntroProps {
  /** Есть сохранённая партия — показать «Продолжить». */
  hasSave: boolean;
  /** Полёт закончился: камера внутри экрана компьютера. */
  onDone: (choice: 'new' | 'continue') => void;
  /** Только для проверок: заморозить полёт в доле t (0…1) или показать собранный логотип сразу. */
  freeze?: { flight?: number; logoReady?: boolean };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Сколько камера стоит у окна, прежде чем войти в квартиру, и сколько длится тёплый переход. */
const HOLD_SECONDS = 1.2;
const FADE_SECONDS = 0.7;
const LOGO_PX = logoPixels();

export function Intro({ hasSave, onDone, freeze }: IntroProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>(freeze?.flight !== undefined ? 'flight' : 'title');
  const [uiShown, setUiShown] = useState(Boolean(freeze?.logoReady));
  const flightStart = useRef<number | null>(null);
  const choice = useRef<'new' | 'continue'>('new');
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const base = document.createElement('canvas');
    base.width = SCENE_W;
    base.height = SCENE_H;
    const bctx = base.getContext('2d')!;
    const room = document.createElement('canvas');
    room.width = INTERIOR.w;
    room.height = INTERIOR.h;
    const rctx = room.getContext('2d')!;

    let raf = 0;
    let finished = false;
    let last = performance.now();
    let arrived: number | null = null;
    // Код на iMac в окне печатается так же, как на мониторе в квартире.
    const typing = new MonitorTyping();
    typing.advance(14);
    const t0 = performance.now() - (freeze?.logoReady ? 4000 : 0);
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);
    const uiTimer = window.setTimeout(() => setUiShown(true), 2300);

    const frame = (now: number) => {
      const time = (now - t0) / 1000;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      typing.advance(dt);
      const view = { w: canvas.width, h: canvas.height };
      // Доля полёта: из заморозки, по таймеру после нажатия или 0 на титульном экране.
      let fly = 0;
      if (freeze?.flight !== undefined) fly = freeze.flight;
      else if (flightStart.current !== null) fly = clamp01((now - flightStart.current) / 1000 / FLIGHT_SECONDS);
      const cam = flightCamera(fly, view);

      // График растёт после появления логотипа и остаётся на месте.
      paintCity(bctx, time, clamp01((time - 0.9) / 2.4));
      // Рама и блики на стекле растворяются, пока камера подплывает к окну.
      paintInterior(rctx, time, 1 - smooth(0.55, 0.95, fly));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#eef3f7';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.setTransform(cam.scale, 0, 0, cam.scale, cam.x, cam.y);
      ctx.drawImage(base, 0, 0);
      ctx.drawImage(room, HOME_WINDOW.x, HOME_WINDOW.y, HOME_WINDOW.w, HOME_WINDOW.h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Вблизи на iMac проступает настоящий код.
      const sw = HOME_SCREEN.w * cam.scale;
      drawEditorScreen(
        ctx,
        { x: HOME_SCREEN.x * cam.scale + cam.x, y: HOME_SCREEN.y * cam.scale + cam.y, w: sw, h: HOME_SCREEN.h * cam.scale },
        typing,
        time,
        smooth(140, 260, sw),
      );

      // Логотип в пикселях экрана: блоки слетаются на место, при полёте — разлетаются.
      // Логотип слева, на чистом небе; дом основателя и график — справа.
      const block = Math.max(3, Math.floor(Math.min((view.w * 0.4) / LOGO.w, (view.h * 0.2) / LOGO.h)));
      const lx = Math.round(view.w * 0.3 - (LOGO.w * block) / 2);
      const ly = Math.round(view.h * 0.2);
      const scatter = easeOut(clamp01(fly / 0.18));
      if (scatter < 1) {
        for (const [i, p] of LOGO_PX.entries()) {
          const delay = 0.25 + hash(i, 1) * 0.9 + (p.x / LOGO.w) * 0.5;
          const k = easeOutBack(clamp01((time - delay) / 0.75));
          if (k <= 0) continue;
          // Откуда прилетает: из случайной точки неба.
          const sx = hash(i, 2) * view.w;
          const sy = hash(i, 3) * view.h * 0.7;
          let x = sx + (lx + p.x * block - sx) * k;
          let y = sy + (ly + p.y * block - sy) * k;
          if (scatter > 0) {
            const ang = hash(i, 4) * Math.PI * 2;
            x += Math.cos(ang) * scatter * view.w * 0.6;
            y += Math.sin(ang) * scatter * view.h * 0.6 - scatter * view.h * 0.2;
          }
          ctx.globalAlpha = Math.min(1, k * 1.4) * (1 - scatter);
          // Тень-ступенька светлее неба — логотип как будто приподнят над ним.
          ctx.fillStyle = 'rgba(38,50,74,0.18)';
          ctx.fillRect(Math.round(x) + Math.ceil(block / 2), Math.round(y) + Math.ceil(block / 2), block, block);
          ctx.fillStyle = p.line === 0 ? (p.y < 6 ? '#26324a' : '#1d2638') : '#c4553b';
          ctx.fillRect(Math.round(x), Math.round(y), block, block);
        }
        ctx.globalAlpha = 1;
      }

      // Затемнение по краям и плавное появление из темноты.
      const g = ctx.createRadialGradient(view.w / 2, view.h * 0.55, view.h * 0.3, view.w / 2, view.h * 0.55, view.h * 1.1);
      g.addColorStop(0, 'rgba(38,50,74,0)');
      g.addColorStop(1, `rgba(38,50,74,${0.16 * (1 - fly)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
      const fadeIn = 1 - clamp01(time / 1.1);
      if (fadeIn > 0) {
        ctx.fillStyle = `rgba(238,243,247,${fadeIn})`;
        ctx.fillRect(0, 0, view.w, view.h);
      }

      // Камера у окна: постоять, потом тёплый свет из окна заливает экран — и мы в квартире.
      if (fly >= 1 && freeze?.flight === undefined) {
        if (arrived === null) arrived = now;
        const fade = clamp01(((now - arrived) / 1000 - HOLD_SECONDS) / FADE_SECONDS);
        if (fade > 0) {
          ctx.fillStyle = `rgba(246,234,216,${smooth(0, 1, fade)})`;
          ctx.fillRect(0, 0, view.w, view.h);
        }
        if (fade >= 1 && !finished) {
          finished = true;
          doneRef.current(choice.current);
          return;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(uiTimer);
      window.removeEventListener('resize', resize);
    };
  }, [freeze]);

  const start = useCallback((which: 'new' | 'continue') => {
    if (flightStart.current !== null) return;
    choice.current = which;
    flightStart.current = performance.now();
    setPhase('flight');
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (!uiShown) setUiShown(true);
        else start(hasSave ? 'continue' : 'new');
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [hasSave, start, uiShown]);

  return (
    <div className={`in-page${phase === 'flight' ? ' flying' : ''}`} onPointerDown={() => !uiShown && setUiShown(true)}>
      <canvas ref={canvasRef} className="in-stage" />
      <div className={`in-ui${uiShown && phase === 'title' ? ' shown' : ''}`}>
        <p className="in-tagline">{t('intro.tagline')}</p>
        <div className="in-buttons">
          <button type="button" className="in-btn primary" onClick={() => start('new')}>
            {t('intro.newGame')}
          </button>
          {hasSave && (
            <button type="button" className="in-btn" onClick={() => start('continue')}>
              {t('intro.continue')}
            </button>
          )}
        </div>
        <p className="in-hint">{t('intro.hint')}</p>
      </div>
    </div>
  );
}
