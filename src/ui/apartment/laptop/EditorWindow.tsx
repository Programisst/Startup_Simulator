// Окно редактора кода: дерево файлов, вкладки, код с подсветкой, автодополнение, терминал.
// Всё кликается: файлы, папки, вкладки, крестики, терминал. Любые клавиши печатают код.
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Actions } from './actions';
import { highlightLine } from './highlight';
import { FileGlyph, Icon } from './icons';
import { ED } from './layout';
import { PROJECT_FILES, TREE, visibleTree, type TermLine } from './project';
import type { LaptopState } from './store';
import { TrafficLights } from './Traffic';

const CODE_TOP = ED.title + ED.tabs + ED.crumbs;

const CodeLine = memo(function CodeLine({ text }: { text: string }) {
  const tokens = useMemo(() => highlightLine(text), [text]);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={`tk-${t.kind}`}>
          {t.text}
        </span>
      ))}
    </>
  );
});

const MinimapLine = memo(function MinimapLine({ text }: { text: string }) {
  const tokens = useMemo(() => highlightLine(text), [text]);
  return (
    <div className="ed-mini-line">
      {tokens.map((t, i) => (
        <span key={i} className={t.kind === 'space' ? 'mini-space' : `mini tk-bg-${t.kind}`} style={{ width: t.text.length * 1.25 }} />
      ))}
    </div>
  );
});

function identifiers(code: string): string[] {
  return [...new Set(code.match(/[A-Za-z_$][\w$]{2,}/g) ?? [])];
}

function currentSymbol(text: string): string | null {
  const all = [...text.matchAll(/(?:function|const|interface|type)\s+([A-Za-z_$][\w$]*)/g)];
  return all.length ? (all[all.length - 1]![1] ?? null) : null;
}

interface Props {
  s: LaptopState;
  actions: Actions;
  height: number;
  scrollable?: boolean;
}

export function EditorWindow({ s, actions, height, scrollable = false }: Props) {
  const { t } = useTranslation();
  const file = PROJECT_FILES[s.fileIndex];
  const text = file ? (s.texts[s.fileIndex] ?? '') : '';
  const lines = text.split('\n');
  const readOnly = !!file?.static;
  const caretLine = readOnly ? 0 : lines.length - 1;
  const caretCol = readOnly ? 0 : (lines[caretLine]?.length ?? 0);
  const focused = s.focus === 'editor' || !s.manual;

  const codeHeight = height - CODE_TOP - ED.status - (s.terminalOpen ? ED.panel : 0);
  const visible = Math.max(1, Math.floor(codeHeight / ED.line));
  const scroll = readOnly || scrollable ? 0 : Math.max(0, caretLine - visible + 4);
  const totalShown = Math.max(lines.length, visible + scroll);

  const words = useMemo(() => identifiers(file?.code ?? ''), [file?.code]);
  const typoWord = s.typo ? (/[\w$]+$/.exec(lines[caretLine] ?? '')?.[0] ?? '') : '';
  const symbol = file ? currentSymbol(readOnly ? file.code : text) : null;
  const justSaved = Date.now() - s.savedAt < 1600;
  const tree = visibleTree(s.collapsed);
  const language = !file ? '' : file.name.endsWith('.tsx') ? 'TypeScript JSX' : file.name.endsWith('.json') ? 'JSON' : file.name.endsWith('.md') ? 'Markdown' : 'TypeScript';

  let suggestions: string[] = [];
  if (s.suggest) {
    const { prefix, word } = s.suggest;
    const others = words.filter((w) => w !== word && w.toLowerCase().startsWith(prefix[0]!.toLowerCase())).slice(0, 5);
    suggestions = [word, ...others];
  }

  return (
    <div className="ed">
      <div className="ed-title" style={{ height: ED.title }}>
        <TrafficLights app="editor" actions={actions} />
        <div className="ed-nav">
          <Icon name="back" size={15} />
          <Icon name="forward" size={15} />
        </div>
        <div className="ed-command">
          <Icon name="search" size={13} />
          <span>{t('laptop.editor.search')}</span>
        </div>
        <div className="ed-title-tools">
          <Icon name="layout" size={15} />
          <button type="button" className="ed-tool" onClick={() => actions.toggleTerminal()} aria-label={t('laptop.editor.empty.terminal')}>
            <Icon name="split" size={15} />
          </button>
          <Icon name="layout" size={15} />
        </div>
      </div>

      <div className="ed-body">
        <div className="ed-activity" style={{ width: ED.activity }}>
          <div className="ed-act active">
            <Icon name="files" size={24} />
          </div>
          <div className="ed-act">
            <Icon name="search" size={24} />
          </div>
          <div className="ed-act">
            <Icon name="branch" size={24} />
            <b className="ed-badge">3</b>
          </div>
          <div className="ed-act">
            <Icon name="run" size={24} />
          </div>
          <div className="ed-act">
            <Icon name="blocks" size={24} />
          </div>
          <div className="ed-act">
            <Icon name="spark" size={24} />
          </div>
          <div className="ed-act-spacer" />
          <div className="ed-act">
            <Icon name="account" size={24} />
          </div>
          <div className="ed-act">
            <Icon name="gear" size={24} />
          </div>
        </div>

        <div className="ed-sidebar" style={{ width: ED.sidebar }}>
          <div className="ed-side-head">
            <span>{t('laptop.editor.explorer')}</span>
            <Icon name="dotsH" size={16} />
          </div>
          <div className="ed-project">
            <Icon name="chevronDown" size={14} />
            PULSE-APP
          </div>
          <div className="ed-tree">
            {tree.map((node) => {
              const open = node.folder && !s.collapsed.includes(node.name);
              return (
                <button
                  type="button"
                  key={node.name + node.depth}
                  className={`ed-row${node.name === s.explorerSelected ? ' selected' : ''}${node.dim ? ' dim' : ''}${node.git ? ` git-${node.git}` : ''}`}
                  style={{ paddingLeft: 10 + node.depth * 12, height: ED.treeRow }}
                  onClick={() => actions.selectTreeRow(node.name, !!node.folder)}
                >
                  {Array.from({ length: node.depth }, (_, i) => (
                    <i key={i} className="ed-guide" style={{ left: 16 + i * 12 }} />
                  ))}
                  {node.folder ? (
                    <span className={`ed-chev${open ? ' open' : ''}`}>
                      <Icon name="chevronRight" size={14} />
                    </span>
                  ) : (
                    <span className="ed-chev-space">
                      <FileGlyph name={node.name} />
                    </span>
                  )}
                  <span className="ed-row-name">{node.name}</span>
                  {node.git && <span className="ed-git">{node.git}</span>}
                </button>
              );
            })}
          </div>
          <div className="ed-side-section">
            <Icon name="chevronRight" size={14} />
            {t('laptop.editor.outline')}
          </div>
          <div className="ed-side-section">
            <Icon name="chevronRight" size={14} />
            {t('laptop.editor.timeline')}
          </div>
        </div>

        <div className="ed-main">
          <div className="ed-tabs" style={{ height: ED.tabs }}>
            {s.openFiles.map((index) => {
              const f = PROJECT_FILES[index]!;
              const active = index === s.fileIndex;
              const node = TREE.find((n) => n.name === f.name);
              return (
                <div key={f.name} className={`ed-tab${active ? ' active' : ''}${node?.git ? ` git-${node.git}` : ''}`} onClick={() => actions.openFile(index)}>
                  <FileGlyph name={f.name} />
                  <span>{f.name}</span>
                  <button
                    type="button"
                    className="ed-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.closeFile(index);
                    }}
                  >
                    {s.dirty[index] ? <i className="ed-dirty" /> : null}
                    <Icon name="close" size={13} />
                  </button>
                </div>
              );
            })}
            <div className="ed-tabs-fill" />
            <div className="ed-tabs-tools">
              <Icon name="split" size={15} />
              <Icon name="dotsH" size={15} />
            </div>
          </div>

          {file ? (
            <>
              <div className="ed-crumbs" style={{ height: ED.crumbs }}>
                {file.path.map((p) => (
                  <span key={p} className="ed-crumb">
                    {p}
                    <Icon name="chevronRight" size={12} />
                  </span>
                ))}
                <span className="ed-crumb">
                  <FileGlyph name={file.name} />
                  {file.name}
                </span>
                {symbol && (
                  <span className="ed-crumb">
                    <Icon name="chevronRight" size={12} />
                    <span className="ed-sym">
                      <Icon name="method" size={13} />
                    </span>
                    {symbol}
                  </span>
                )}
                {readOnly && <span className="ed-readonly">{t('laptop.editor.readonly')}</span>}
              </div>

              <div key={scrollable ? s.fileIndex : undefined} className={`ed-code${scrollable ? ' scrollable' : ''}${focused ? ' focused' : ''}`} style={{ height: codeHeight }} onClick={() => actions.setFocus('editor')}>
                <div className="ed-code-inner" style={{ transform: `translateY(${-scroll * ED.line}px)`, height: scrollable ? totalShown * ED.line : undefined }}>
                  <div className="ed-current" style={{ top: caretLine * ED.line }} />
                  {Array.from({ length: totalShown }, (_, i) => {
                    const line = lines[i];
                    const indent = line ? Math.floor((/^ */.exec(line)?.[0].length ?? 0) / 2) : 0;
                    return (
                      <div key={i} className="ed-line" style={{ top: i * ED.line }}>
                        <span className={`ed-num${i === caretLine ? ' current' : ''}`}>{line !== undefined ? i + 1 : ''}</span>
                        <span className="ed-text">
                          {Array.from({ length: indent }, (_, k) => (
                            <i key={k} className="ed-indent" style={{ left: `${k * 2}ch` }} />
                          ))}
                          {line !== undefined && <CodeLine text={line} />}
                        </span>
                      </div>
                    );
                  })}
                  <div className="ed-caret-layer" style={{ top: caretLine * ED.line }}>
                    {typoWord && <span className="ed-squiggle" style={{ left: `${caretCol - typoWord.length}ch`, width: `${typoWord.length}ch` }} />}
                    {focused && <span key={s.keystroke} className="ed-caret" style={{ left: `${caretCol}ch` }} />}
                    {s.suggest && (
                      <div className="ed-suggest" style={{ left: `${caretCol - s.suggest.prefix.length}ch` }}>
                        {suggestions.map((w, i) => {
                          const method = file.code.includes(`${w}(`);
                          return (
                            <div key={w} className={`ed-suggest-row${i === 0 ? ' selected' : ''}`}>
                              <span className={method ? 'sg-method' : 'sg-var'}>
                                <Icon name={method ? 'method' : 'variable'} size={14} />
                              </span>
                              <span className="sg-label">
                                <b>{w.slice(0, s.suggest!.prefix.length)}</b>
                                {w.slice(s.suggest!.prefix.length)}
                              </span>
                              {i === 0 && <span className="sg-detail">{method ? '(method)' : t('laptop.editor.suggestHint')}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="ed-minimap">
                  <div className="ed-mini-inner" style={{ transform: `translateY(${-Math.max(0, scroll - 20) * 3}px)` }}>
                    {lines.map((l, i) => (
                      <MinimapLine key={i} text={l} />
                    ))}
                    <div className="ed-mini-view" style={{ top: scroll * 3, height: visible * 3 }} />
                  </div>
                </div>
                <div className="ed-scrollbar">
                  <div className="ed-thumb" style={{ top: `${(scroll / totalShown) * 100}%`, height: `${(visible / totalShown) * 100}%` }} />
                </div>
              </div>
            </>
          ) : (
            <div className="ed-empty" style={{ height: height - ED.title - ED.tabs - ED.status }}>
              <div className="ed-empty-mark">{'</>'}</div>
              <div className="ed-empty-keys">
                <span>{t('laptop.editor.empty.open')}</span>
                <kbd>⌘ P</kbd>
                <span>{t('laptop.editor.empty.terminal')}</span>
                <kbd>⌃ `</kbd>
                <span>{t('laptop.editor.empty.save')}</span>
                <kbd>⌘ S</kbd>
              </div>
            </div>
          )}

          <div className={`ed-panel${s.terminalOpen ? ' open' : ''}${s.focus === 'terminal' ? ' focused' : ''}`} style={{ height: ED.panel }} onClick={() => actions.setFocus('terminal')}>
            <div className="ed-panel-head">
              {(t('laptop.editor.panels', { returnObjects: true }) as string[]).map((p, i) => (
                <span key={p} className={i === 3 ? 'active' : ''}>
                  {p.toUpperCase()}
                </span>
              ))}
              <div className="ed-panel-fill" />
              <span className="ed-panel-shell">
                <Icon name="remote" size={13} /> zsh
              </span>
              <Icon name="plus" size={14} />
              <Icon name="split" size={14} />
              <button
                type="button"
                className="ed-tool"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.clearTerminal();
                }}
              >
                <Icon name="trash" size={14} />
              </button>
              <Icon name="dotsH" size={14} />
              <button
                type="button"
                className="ed-tool"
                onClick={(e) => {
                  e.stopPropagation();
                  actions.toggleTerminal(false);
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="ed-term">
              {s.terminal.slice(-11).map((l, i) => (
                <TermRow key={s.terminal.length - 11 + i} line={l} />
              ))}
              {!s.termRunning && (
                <div className="term-row">
                  <span className="term-user">founder@laptop</span> <span className="term-dir">pulse-app</span> <span className="term-sign">%</span> {s.termInput}
                  {(s.focus === 'terminal' || !s.manual) && <span key={s.keystroke} className="term-cursor" />}
                </div>
              )}
              {s.termRunning && <div className="term-row term-spin">⠋</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="ed-status" style={{ height: ED.status }}>
        <span className="st-remote">
          <Icon name="remote" size={13} />
        </span>
        <span className="st-item">
          <Icon name="branch" size={13} /> main*
        </span>
        <span className="st-item">
          <Icon name="sync" size={13} /> 0↓ 1↑
        </span>
        <span className="st-item">
          <Icon name="error" size={13} /> 0 <Icon name="warning" size={13} /> 0
        </span>
        {justSaved && <span className="st-item st-saved">✓ {t('laptop.editor.saved')}</span>}
        {s.manual && s.focus === 'editor' && !readOnly && file && <span className="st-item st-hint">{t('laptop.autopilot.typeHint')}</span>}
        <span className="st-fill" />
        {file && <span className="st-item">{t('laptop.editor.line', { line: caretLine + 1, col: caretCol + 1 })}</span>}
        <span className="st-item">{t('laptop.editor.spaces')}</span>
        <span className="st-item">UTF-8</span>
        <span className="st-item">LF</span>
        {file && (
          <span className="st-item">
            <Icon name="braces" size={13} /> {language}
          </span>
        )}
        <span className="st-item">
          <Icon name="bell" size={13} />
        </span>
      </div>
    </div>
  );
}

function TermRow({ line }: { line: TermLine }) {
  if (line.tone === 'prompt') {
    const cmd = line.text.split('% ')[1] ?? '';
    return (
      <div className="term-row">
        <span className="term-user">founder@laptop</span> <span className="term-dir">pulse-app</span> <span className="term-sign">%</span> {cmd}
      </div>
    );
  }
  if (line.tone === 'ok' && line.text.startsWith(' ✓')) {
    return (
      <div className="term-row">
        <span className="term-ok">{line.text.slice(0, 3)}</span>
        <span>{line.text.slice(3).replace(/\(\d+ tests\).*/, '')}</span>
        <span className="term-muted">{/\(\d+ tests\).*/.exec(line.text)?.[0]}</span>
      </div>
    );
  }
  if (line.tone === 'accent' && line.text.startsWith(' RUN')) {
    return (
      <div className="term-row">
        <span className="term-badge"> RUN </span>
        <span className="term-muted">{line.text.replace(' RUN ', '')}</span>
      </div>
    );
  }
  if (line.tone === 'bold' && line.text.includes('passed')) {
    const [label, rest] = line.text.split(/(?<=Files|Tests)\s+/);
    return (
      <div className="term-row">
        <span className="term-muted">{label} </span>
        <span className="term-pass">{rest?.split(' (')[0]}</span>
        <span className="term-muted"> ({rest?.split(' (')[1]}</span>
      </div>
    );
  }
  return <div className={`term-row term-${line.tone ?? 'plain'}`}>{line.text || ' '}</div>;
}
