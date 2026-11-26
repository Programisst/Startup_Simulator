// Окно браузера: вкладки, адресная строка, стартовая страница, поиск, статьи и продукт основателя.
// Всё кликается и печатается: вкладки, «назад», «вперёд», «обновить», адрес, поиск, ссылки.
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Actions } from './actions';
import { Icon, PulseMark, SearchMark } from './icons';
import { Landscape } from './Landscape';
import { BR } from './layout';
import { resultsFor, type SearchResult } from './logic';
import type { BrowserTab, LaptopState } from './store';
import { TrafficLights } from './Traffic';

function tabTitle(tab: BrowserTab, t: (k: string) => string, searchBrand?: string): string {
  if (tab.view === 'product') return `${t('laptop.brand.product')} — ${t('laptop.product.title')}`;
  if (tab.view === 'results') return `${tab.query} — ${searchBrand ?? t('laptop.brand.search')}`;
  if (tab.view === 'article') return tab.article?.title ?? tab.url;
  if (tab.view === 'error') return tab.url;
  return t('laptop.browser.newTab');
}

function Favicon({ tab }: { tab: BrowserTab }) {
  if (tab.loading) return <span className="br-spinner" />;
  if (tab.view === 'product') return <PulseMark size={16} />;
  if (tab.view === 'article') return <span className="br-fav-letter">{tab.article?.site.slice(0, 1)}</span>;
  if (tab.view === 'error') return <span className="br-fav-error"><Icon name="info" size={14} /></span>;
  return <SearchMark size={16} />;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BrowserWindow({ s, actions, searchBrand, searchPlaceholder }: { s: LaptopState; actions: Actions; searchBrand?: string; searchPlaceholder?: string }) {
  const { t } = useTranslation();
  const active = s.tabs.find((tab) => tab.id === s.activeTab) ?? s.tabs[0];
  const canBack = (active?.back.length ?? 0) > 0;
  const canForward = (active?.forward.length ?? 0) > 0;

  let page: ReactNode = null;
  if (active?.view === 'newtab') page = <NewTab s={s} actions={actions} searchBrand={searchBrand} searchPlaceholder={searchPlaceholder} />;
  else if (active?.view === 'product')
    page = (
      <ProductPage
        loading={active.loading}
        scroll={s.pageScroll}
        hoverDay={s.hoverChart}
        section={s.productSection}
        onSection={(i) => actions.setProductSection(i)}
      />
    );
  else if (active?.view === 'results') page = <ResultsPage s={s} tab={active} actions={actions} searchBrand={searchBrand} />;
  else if (active?.view === 'article') page = <ArticlePage tab={active} scroll={s.pageScroll} actions={actions} />;
  else if (active?.view === 'error') page = <ErrorPage tab={active} actions={actions} />;

  return (
    <div className="br">
      <div className="br-tabs" style={{ height: BR.tabsH }}>
        <TrafficLights app="browser" actions={actions} />
        <div className="br-tablist" style={{ left: BR.tabsX }}>
          {s.tabs.map((tab, i) => {
            const isActive = tab.id === active?.id;
            const nextActive = s.tabs[i + 1]?.id === active?.id;
            return (
              <div
                key={tab.id}
                className={`br-tab${isActive ? ' active' : ''}${nextActive || isActive ? ' no-divider' : ''}`}
                style={{ width: BR.tabW }}
                onClick={() => actions.selectTab(tab.id)}
              >
                <Favicon tab={tab} />
                <span className="br-tab-title">{tabTitle(tab, t, searchBrand)}</span>
                <button
                  type="button"
                  className="br-tab-x"
                  onClick={(e) => {
                    stop(e);
                    actions.closeTab(tab.id);
                  }}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            );
          })}
          <button type="button" className="br-newtab" onClick={() => actions.newTab()}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>

      <div className="br-toolbar" style={{ height: BR.toolbarH }}>
        <button type="button" className={`br-btn${canBack ? '' : ' dim'}`} onClick={() => actions.back()}>
          <Icon name="back" size={17} />
        </button>
        <button type="button" className={`br-btn${canForward ? '' : ' dim'}`} onClick={() => actions.forward()}>
          <Icon name="forward" size={17} />
        </button>
        <button type="button" className="br-btn" onClick={() => actions.reload()}>
          <Icon name="reload" size={17} />
        </button>
        <div
          className={`br-omnibox${s.omniboxFocus ? ' focus' : ''}`}
          onClick={(e) => {
            stop(e);
            if (!s.omniboxFocus) actions.focusOmnibox();
          }}
        >
          <span className="br-omni-icon">{active && active.view !== 'newtab' && active.view !== 'results' ? <Icon name="info" size={15} /> : <SearchMark size={15} />}</span>
          {s.omniboxFocus ? (
            <span className="br-omni-text">
              <span className={s.omniSelected ? 'br-selected' : ''}>{s.omnibox}</span>
              {!s.omniSelected && <span key={s.keystroke} className="text-caret" />}
            </span>
          ) : active?.url ? (
            <span className="br-omni-text">
              <b>{active.url.split('/')[0]}</b>
              <span className="dim">{active.url.includes('/') ? `/${active.url.split('/').slice(1).join('/')}` : ''}</span>
            </span>
          ) : (
            <span className="br-omni-placeholder">{t('laptop.browser.omniboxPlaceholder')}</span>
          )}
          <span className="br-omni-end">
            <Icon name="star" size={15} />
          </span>
          {s.omniboxFocus && s.omnibox && !s.omniSelected && (
            <div className="br-omni-drop">
              <button type="button" className="br-drop-row selected" onClick={(e) => (stop(e), actions.navigate(s.omnibox))}>
                <Icon name="search" size={14} />
                <b>{s.omnibox}</b>
                <span className="dim">— {t('laptop.brand.search')}</span>
              </button>
              <button type="button" className="br-drop-row" onClick={(e) => (stop(e), actions.navigate('localhost:5173'))}>
                <Icon name="info" size={14} />
                localhost:5173 <span className="dim">— {t('laptop.brand.product')}</span>
              </button>
            </div>
          )}
        </div>
        <span className="br-btn">
          <Icon name="puzzle" size={17} />
        </span>
        <span className="br-avatar">Ф</span>
        <span className="br-btn">
          <Icon name="dots" size={17} />
        </span>
      </div>

      <div className="br-content" onWheel={(e) => actions.scrollPage(e.deltaY)} onClick={() => actions.blurInputs()}>
        {page}
      </div>
    </div>
  );
}

function NewTab({ s, actions, searchBrand, searchPlaceholder }: { s: LaptopState; actions: Actions; searchBrand?: string; searchPlaceholder?: string }) {
  const { t } = useTranslation();
  const shortcuts = t('laptop.browser.shortcuts', { returnObjects: true }) as string[];
  const targets = t('laptop.browser.shortcutTargets', { returnObjects: true }) as string[];
  const icons = ['pulse', 'mail', 'card', 'report', 'plus'];
  const typed = s.ntpSearch;
  return (
    <div className="ntp">
      <Landscape variant="dawn" id="ntp" />
      <div className="ntp-center">
        <div className="ntp-logo">{searchBrand ?? t('laptop.brand.search')}</div>
        {searchBrand ? (
          <form className="ntp-search native-search" onSubmit={(event) => {
            event.preventDefault();
            const query = new FormData(event.currentTarget).get('query')?.toString().trim();
            if (query) actions.navigate(query);
          }}>
            <Icon name="search" size={19} />
            <input type="search" name="query" aria-label={searchPlaceholder} placeholder={searchPlaceholder} autoComplete="off" />
          </form>
        ) : (
        <div
          className={`ntp-search${s.ntpFocus ? ' focus' : ''}${s.ntpFocus && typed ? ' open' : ''}`}
          onClick={(e) => {
            stop(e);
            actions.focusNtp();
          }}
        >
          <span className="ntp-plus">
            <Icon name="plus" size={20} />
          </span>
          <span className="ntp-input">
            {typed || (s.ntpFocus ? '' : <span className="ntp-placeholder">{t('laptop.browser.placeholder')}</span>)}
            {s.ntpFocus && <span key={s.keystroke} className="text-caret dark" />}
          </span>
          <span className="ntp-icons">
            <Icon name="mic" size={20} />
            <Icon name="lens" size={20} />
            <span className="ntp-ai">
              <Icon name="spark" size={15} /> {t('laptop.browser.aiMode')}
            </span>
          </span>
          {s.ntpFocus && typed && (
            <div className="ntp-drop">
              {[typed, `${typed} формула`, `${typed} пример`, `${typed} для новичков`].map((q, i) => (
                <button type="button" key={q} className={`ntp-drop-row${i === 0 ? ' selected' : ''}`} onClick={(e) => (stop(e), actions.navigate(q))}>
                  <Icon name="search" size={16} />
                  <span>
                    {q.slice(0, typed.length)}
                    <b>{q.slice(typed.length)}</b>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        <div className="ntp-shortcuts">
          {shortcuts.map((label, i) => (
            <button
              type="button"
              key={label}
              className="ntp-short"
              onClick={(e) => {
                stop(e);
                const target = targets[i];
                if (target) actions.navigate(target);
                else actions.focusOmnibox();
              }}
            >
              <span className="ntp-short-icon">{i === 0 ? <PulseMark size={22} /> : <Icon name={icons[i]!} size={20} />}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ntp-credit">
        <Icon name="info" size={14} /> {t('laptop.browser.photo')}
      </div>
      <div className="ntp-edit">
        <Icon name="tune" size={16} />
      </div>
    </div>
  );
}

// ——— Продукт основателя: панель Pulse ———

function revenueSeries(): number[] {
  return Array.from({ length: 30 }, (_, i) => Math.round(84 + i * 3.1 + Math.sin(i * 1.3) * 13 + (i % 7 === 5 ? -16 : 0)));
}

function smoothPath(points: [number, number][]): string {
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)},${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)},${c2[1]!.toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`;
  }
  return d;
}

function ProductPage({ loading, scroll, hoverDay, section, onSection }: { loading: boolean; scroll: number; hoverDay: number | null; section: number; onSection: (i: number) => void }) {
  const { t } = useTranslation();
  const nav = t('laptop.product.nav', { returnObjects: true }) as string[];
  const stats = t('laptop.product.stats', { returnObjects: true }) as { label: string; value: string; trend: string }[];
  const columns = t('laptop.product.columns', { returnObjects: true }) as string[];
  const rows = t('laptop.product.rows', { returnObjects: true }) as string[][];
  const navIcons = ['home', 'users', 'card', 'report', 'gear'];

  const W = 900;
  const H = 230;
  const data = useMemo(revenueSeries, []);
  const max = 200;
  const pts = data.map((v, i) => [44 + (i / (data.length - 1)) * (W - 60), 16 + (1 - v / max) * (H - 40)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1]![0]},${H - 24} L${pts[0]![0]},${H - 24} Z`;
  const hp = hoverDay !== null ? pts[hoverDay] : undefined;

  return (
    <div className="pp">
      <aside className="pp-side">
        <div className="pp-logo">
          <PulseMark size={26} />
          <b>{t('laptop.brand.product')}</b>
        </div>
        {nav.map((n, i) => (
          <button type="button" key={n} className={`pp-nav${i === section ? ' active' : ''}`} onClick={() => onSection(i)}>
            <Icon name={navIcons[i]!} size={17} />
            {n}
          </button>
        ))}
        <div className="pp-dev">
          <i /> {t('laptop.product.dev')}
        </div>
      </aside>
      <div className="pp-main">
        <div className="pp-scroll" style={{ transform: `translateY(${-scroll}px)` }}>
          <div className="pp-top">
            <div className="pp-search">
              <Icon name="search" size={15} />
              {t('laptop.product.search')}
            </div>
            <Icon name="bell" size={18} />
            <span className="pp-avatar">МК</span>
          </div>
          <div className="pp-head">
            <h1>{nav[section] ?? t('laptop.product.title')}</h1>
            <span className="pp-range">
              <Icon name="calendar" size={15} /> {t('laptop.product.range')}
            </span>
          </div>
          {loading ? (
            <div className="pp-skeleton">
              <div className="sk-row">
                <i />
                <i />
                <i />
              </div>
              <i className="sk-big" />
              <i className="sk-big short" />
            </div>
          ) : (
            <div className="pp-loaded">
              <div className="pp-stats">
                {stats.map((st, i) => (
                  <div key={st.label} className="pp-card">
                    <span className="pp-label">{st.label}</span>
                    <span className="pp-value">{st.value}</span>
                    <span className={`pp-trend${i === 2 ? ' good-down' : ''}`}>{st.trend}</span>
                    <svg className="pp-spark" viewBox="0 0 100 28" preserveAspectRatio="none">
                      <path d={`M0,${22 - i * 3} C20,${16 + i} 35,${24 - i * 2} 55,${14 + i} S85,${8 + i * 3} 100,${5 + i * 4}`} />
                    </svg>
                  </div>
                ))}
              </div>
              <div className="pp-card pp-chart">
                <div className="pp-card-head">
                  <b>{t('laptop.product.chart')}</b>
                  <span className="pp-legend">
                    <i /> 2026
                  </span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
                  <defs>
                    <linearGradient id="pp-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#6d5efc" stopOpacity="0.28" />
                      <stop offset="1" stopColor="#6d5efc" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[200, 150, 100, 50, 0].map((v) => {
                    const y = 16 + (1 - v / max) * (H - 40);
                    return (
                      <g key={v}>
                        <line x1="40" x2={W - 16} y1={y} y2={y} className="pp-grid" />
                        <text x="0" y={y + 4} className="pp-axis">
                          ${v}
                        </text>
                      </g>
                    );
                  })}
                  <path d={area} fill="url(#pp-area)" className="pp-area" />
                  <path d={line} className="pp-line" pathLength={1} />
                  {[0, 7, 14, 21, 29].map((d) => (
                    <text key={d} x={pts[d]![0]} y={H - 4} textAnchor="middle" className="pp-axis">
                      {d + 1}
                    </text>
                  ))}
                  {hp && (
                    <g className="pp-hover">
                      <line x1={hp[0]} x2={hp[0]} y1="12" y2={H - 24} />
                      <circle cx={hp[0]} cy={hp[1]} r="5" />
                      <g transform={`translate(${hp[0] - 52} ${hp[1] - 50})`}>
                        <rect width="104" height="36" rx="8" />
                        <text x="52" y="15" textAnchor="middle" className="pp-tip-a">
                          {`День ${(hoverDay ?? 0) + 1}`}
                        </text>
                        <text x="52" y="29" textAnchor="middle" className="pp-tip-b">
                          ${data[hoverDay ?? 0]}
                        </text>
                      </g>
                    </g>
                  )}
                </svg>
              </div>
              <div className="pp-card">
                <div className="pp-card-head">
                  <b>{t('laptop.product.payments')}</b>
                </div>
                <table className="pp-table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r[0]}>
                        <td>
                          <span className="pp-client">{r[0]?.slice(0, 1)}</span>
                          {r[0]}
                        </td>
                        <td>{r[1]}</td>
                        <td>{r[2]}</td>
                        <td>
                          <span className={`pp-status s-${['Оплачено', 'Пробный', 'Ошибка'].indexOf(r[3] ?? '')}`}>{r[3]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ——— Страница результатов поиска ———

function ResultsPage({ s, tab, actions, searchBrand }: { s: LaptopState; tab: BrowserTab; actions: Actions; searchBrand?: string }) {
  const { t } = useTranslation();
  const curated = {
    queries: t('laptop.browser.curatedQueries', { returnObjects: true }) as string[],
    results: t('laptop.browser.results', { returnObjects: true }) as SearchResult[],
  };
  const templates = t('laptop.browser.templates', { returnObjects: true }) as SearchResult[];
  const results = resultsFor(tab.query, curated, templates);
  const isCurated = curated.queries.some((q) => q.toLowerCase() === tab.query.trim().toLowerCase());
  const ai = isCurated ? t('laptop.browser.aiText') : (t('laptop.browser.aiTemplate') as string).replaceAll('{q}', tab.query);
  const tabs = t('laptop.browser.searchTabs', { returnObjects: true }) as string[];
  const editing = s.focus === 'srbox';
  return (
    <div className="sr">
      <div className="sr-scroll" style={{ transform: `translateY(${-s.pageScroll}px)` }}>
        <div className="sr-head">
          <button type="button" className="sr-logo" onClick={(e) => (stop(e), actions.goTo({ view: 'newtab', url: '', query: '' }, 200))}>
            {searchBrand ?? t('laptop.brand.search')}
          </button>
          <div className={`sr-box${editing ? ' focus' : ''}`} onClick={(e) => (stop(e), actions.focusSearchBox())}>
            <span className="sr-box-text">
              {editing ? s.srInput : tab.query}
              {editing && <span key={s.keystroke} className="text-caret dark" />}
            </span>
            <span className="sr-box-icons">
              <Icon name="close" size={18} />
              <i className="sr-sep" />
              <Icon name="mic" size={18} />
              <Icon name="lens" size={18} />
              <button type="button" className="sr-go" onClick={(e) => (stop(e), actions.navigate(editing ? s.srInput : tab.query))}>
                <Icon name="search" size={18} />
              </button>
            </span>
          </div>
          <span className="sr-avatar">Ф</span>
        </div>
        <div className="sr-tabs">
          {tabs.map((x, i) => (
            <span key={x} className={i === 0 ? 'active' : ''}>
              {x}
            </span>
          ))}
        </div>
        {tab.loading ? (
          <div className="sr-skeleton">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <i className="w30" />
                <i className="w60" />
                <i className="w90" />
                <i className="w70" />
              </div>
            ))}
          </div>
        ) : (
          <div className="sr-body">
            <div className="sr-stat">{t('laptop.browser.resultsStat')}</div>
            <div className="sr-ai">
              <div className="sr-ai-head">
                <Icon name="spark" size={16} /> {t('laptop.browser.aiOverview')}
              </div>
              <p>{ai}</p>
            </div>
            {results.map((r, i) => (
              <div key={r.url + i} className={`sr-item${s.hoverResult === i ? ' hover' : ''}`}>
                <div className="sr-site">
                  <span className="sr-fav">{r.site.slice(0, 1)}</span>
                  <span>
                    <b>{r.site}</b>
                    <small>{r.url}</small>
                  </span>
                </div>
                <button type="button" className="sr-title" onClick={(e) => (stop(e), actions.openResult(r))}>
                  {r.title}
                </button>
                <p>{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ——— Статья на чужом сайте ———

function ArticlePage({ tab, scroll, actions }: { tab: BrowserTab; scroll: number; actions: Actions }) {
  const { t } = useTranslation();
  const article = t('laptop.browser.article', { returnObjects: true }) as { meta: string; paragraphs: string[]; related: string; relatedItems: string[] };
  const r = tab.article;
  if (!r) return null;
  return (
    <div className="ar">
      {tab.loading ? (
        <div className="ar-loading">
          <span className="br-spinner big" />
        </div>
      ) : (
        <div className="ar-scroll" style={{ transform: `translateY(${-scroll}px)` }}>
          <header className="ar-top">
            <span className="ar-site">
              <span className="sr-fav">{r.site.slice(0, 1)}</span>
              {r.site}
            </span>
            <nav>
              <span>Статьи</span>
              <span>Гайды</span>
              <span>Сообщество</span>
            </nav>
          </header>
          <article className="ar-body">
            <h1>{r.title}</h1>
            <div className="ar-meta">{article.meta}</div>
            <p className="ar-lead">{r.text.replace(/…$/, '.')}</p>
            {article.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <div className="ar-related">
              <b>{article.related}</b>
              {article.relatedItems.map((x) => (
                <button type="button" key={x} onClick={(e) => (stop(e), actions.navigate(x))}>
                  {x}
                </button>
              ))}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

// ——— Сайт не открылся ———

function ErrorPage({ tab, actions }: { tab: BrowserTab; actions: Actions }) {
  const { t } = useTranslation();
  const err = t('laptop.browser.error', { returnObjects: true }) as { title: string; text: string; hints: string[]; reload: string; code: string };
  return (
    <div className="er">
      <div className="er-box">
        <svg className="er-icon" viewBox="0 0 64 64" aria-hidden="true">
          <rect x="8" y="14" width="48" height="34" rx="4" />
          <path d="M8 22h48M24 56h16M32 48v8" />
          <path d="M26 31l12 10M38 31L26 41" className="er-x" />
        </svg>
        <h1>{err.title}</h1>
        <p>{err.text.replace('{url}', tab.url.split('/')[0] ?? tab.url)}</p>
        <ul>
          {err.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div className="er-code">{err.code}</div>
        <button type="button" className="er-reload" onClick={(e) => (stop(e), actions.reload())}>
          {err.reload}
        </button>
      </div>
    </div>
  );
}
