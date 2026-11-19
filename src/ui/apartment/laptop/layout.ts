// Размеры экрана ноутбука. Всё рисуется на «экране» 1440×900 и затем масштабируется,
// поэтому координаты кнопок известны заранее — по ним ездит мышь.

export const SCREEN_W = 1440;
export const SCREEN_H = 900;
export const MENU_H = 30;

export const WINDOW = { x: 12, y: 40, w: 1416, h: 770 };

export const DOCK_ITEMS = ['files', 'browser', 'editor', 'messenger', 'mail', 'notes', 'bank', 'settings'] as const;
export type DockItem = (typeof DOCK_ITEMS)[number];
export const DOCK_ICON = 54;
export const DOCK_GAP = 10;
export const DOCK_PAD = 9;
export const DOCK_H = DOCK_ICON + DOCK_PAD * 2;
export const DOCK_W = DOCK_ITEMS.length * DOCK_ICON + (DOCK_ITEMS.length - 1) * DOCK_GAP + DOCK_PAD * 2;
export const DOCK_X = (SCREEN_W - DOCK_W) / 2;
export const DOCK_Y = SCREEN_H - DOCK_H - 8;

export function dockIconCenter(item: DockItem): { x: number; y: number } {
  const i = DOCK_ITEMS.indexOf(item);
  return { x: DOCK_X + DOCK_PAD + i * (DOCK_ICON + DOCK_GAP) + DOCK_ICON / 2, y: DOCK_Y + DOCK_H / 2 };
}

// Редактор
export const ED = {
  title: 38,
  activity: 48,
  sidebar: 256,
  tabs: 35,
  crumbs: 24,
  status: 24,
  panel: 268,
  line: 20,
  treeTop: 38 + 34 + 24,
  treeRow: 22,
};

export function explorerRowCenter(index: number, depth: number): { x: number; y: number } {
  return {
    x: WINDOW.x + ED.activity + 30 + depth * 12 + 40,
    y: WINDOW.y + ED.treeTop + index * ED.treeRow + ED.treeRow / 2,
  };
}

// Браузер
export const BR = {
  tabsH: 42,
  toolbarH: 46,
  tabW: 236,
  tabsX: 96,
};

export const BR_CONTENT_Y = WINDOW.y + BR.tabsH + BR.toolbarH;

export function browserTabCenter(index: number): { x: number; y: number } {
  return { x: WINDOW.x + BR.tabsX + index * BR.tabW + BR.tabW / 2 - 20, y: WINDOW.y + BR.tabsH / 2 + 3 };
}

export function browserTabClose(index: number): { x: number; y: number } {
  return { x: WINDOW.x + BR.tabsX + (index + 1) * BR.tabW - 26, y: WINDOW.y + BR.tabsH / 2 + 3 };
}

export const OMNIBOX = { x: WINDOW.x + 640, y: WINDOW.y + BR.tabsH + BR.toolbarH / 2 };
export const RELOAD = { x: WINDOW.x + 104, y: WINDOW.y + BR.tabsH + BR.toolbarH / 2 };
export const NTP_SEARCH = { x: SCREEN_W / 2 + 40, y: BR_CONTENT_Y + 300 };
