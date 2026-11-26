"""Маленький пиксельный изометрический «движок» для образцов офиса.

Мир: x — вправо-вниз, y — влево-вниз, z — вверх. Проекция 2:1:
  sx = x - y,  sy = (x + y) / 2 - z.  Глубина (ближе к зрителю) = x + y + z.
Видны три грани коробки: верх (z = z1), левая (y = y1) и правая (x = x1).
"""
import numpy as np
from PIL import Image


def hx(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def mix(a, b, t):
    return hx(a) * (1 - t) + hx(b) * t if isinstance(a, str) else a * (1 - t) + b * t


def solid(col):
    c = hx(col) if isinstance(col, str) else np.asarray(col, float)

    def f(X, Y, Z):
        return np.tile(c, (X.shape[0], 1))
    return f


def ihash(*arrs):
    h = np.zeros_like(np.asarray(arrs[0]), dtype=np.int64) + 1469598103
    for a in arrs:
        h = (h ^ np.asarray(a, dtype=np.int64)) * 16777619 % 2147483647
    h = (h ^ (h >> 13)) * 1274126177 % 2147483647
    return (h % 1000) / 1000.0


class Scene:
    def __init__(self, W, H, ox, oy, bg):
        self.W, self.H, self.ox, self.oy = W, H, ox, oy
        self.col = np.zeros((H, W, 3))
        self.dep = np.full((H, W), -1e9)
        self.obj = np.full((H, W), -1, int)
        self.face = np.zeros((H, W), int)
        self.mode = {}  # id -> 'full' | 'bg' | 'none'
        self.outc = {}  # id -> outline colour or None (auto)
        self.nid = 0
        self.overlay = []
        bg(self)

    def new_id(self, mode='full', outc=None):
        self.nid += 1
        self.mode[self.nid] = mode
        self.outc[self.nid] = outc
        return self.nid

    def proj(self, x, y, z):
        return self.ox + (x - y), self.oy + (x + y) / 2 - z

    # ── коробка ──────────────────────────────────────────────
    def box(self, x0, x1, y0, y1, z0, z1, top, left=None, right=None, mode='full', oid=None, bias=0.0, outc=None):
        """top/left/right — цвет '#rrggbb' или функция (X, Y, Z) -> (N, 3). None — грань не рисуется."""
        if oid is None:
            oid = self.new_id(mode, outc)
        conv = lambda f: solid(f) if isinstance(f, str) else f
        top, left, right = conv(top), conv(left), conv(right)
        pts = [self.proj(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
        i0 = max(0, int(min(p[0] for p in pts)) - 1)
        i1 = min(self.W, int(max(p[0] for p in pts)) + 2)
        j0 = max(0, int(min(p[1] for p in pts)) - 1)
        j1 = min(self.H, int(max(p[1] for p in pts)) + 2)
        if i0 >= i1 or j0 >= j1:
            return oid
        I, J = np.meshgrid(np.arange(i0, i1), np.arange(j0, j1))
        sx = I + 0.5 - self.ox
        sy = J + 0.5 - self.oy
        eps = 1e-6
        faces = []
        if top is not None:
            X = (sx + 2 * (sy + z1)) / 2
            Y = (2 * (sy + z1) - sx) / 2
            Z = np.full_like(X, z1)
            m = (X >= x0 - eps) & (X < x1 - eps) & (Y >= y0 - eps) & (Y < y1 - eps)
            faces.append((1, top, X, Y, Z, m, 0.0))
        if left is not None:  # грань y = y1
            X = sx + y1
            Y = np.full_like(X, y1)
            Z = (X + y1) / 2 - sy
            m = (X >= x0 - eps) & (X < x1 - eps) & (Z >= z0 - eps) & (Z < z1 - eps)
            faces.append((2, left, X, Y, Z, m, 0.001))
        if right is not None:  # грань x = x1
            Y = x1 - sx
            X = np.full_like(Y, x1)
            Z = (x1 + Y) / 2 - sy
            m = (Y >= y0 - eps) & (Y < y1 - eps) & (Z >= z0 - eps) & (Z < z1 - eps)
            faces.append((3, right, X, Y, Z, m, 0.001))
        for fid, fn, X, Y, Z, m, b in faces:
            D = X + Y + Z + b + bias
            cur = self.dep[J, I]
            w = m & (D > cur)
            if not w.any():
                continue
            jj, ii = J[w], I[w]
            self.col[jj, ii] = fn(X[w], Y[w], Z[w])
            self.dep[jj, ii] = D[w]
            self.obj[jj, ii] = oid
            self.face[jj, ii] = fid
        return oid

    # ── спрайт (по строкам, как в игре) ───────────────────────
    def sprite(self, rows, pal, x, y, z, ax, ay, flip=False, bias=0.5, mode='none'):
        oid = self.new_id(mode)
        px, py = self.proj(x, y, z)
        px, py = int(np.floor(px)), int(np.floor(py))
        D = x + y + z + bias
        for r, row in enumerate(rows):
            if flip:
                row = row[::-1]
            for c, ch in enumerate(row):
                col = pal.get(ch)
                if col is None:
                    continue
                i, j = px - ax + c, py - ay + r
                if 0 <= i < self.W and 0 <= j < self.H and D > self.dep[j, i]:
                    self.col[j, i] = hx(col)
                    self.dep[j, i] = D
                    self.obj[j, i] = oid
                    self.face[j, i] = 4
        return oid

    def over(self, rows, pal, x, y, z, ax, ay):
        """Значки поверх всего (над головами)."""
        self.overlay.append((rows, pal, x, y, z, ax, ay))

    # ── обработка ────────────────────────────────────────────
    def finish(self, out_default='#3a3a50', glows=(), grade=None):
        H, W = self.H, self.W
        col = self.col.copy()
        obj, dep, face = self.obj, self.dep, self.face
        # блик на верхнем ребре: верх, под которым боковая грань того же предмета
        below_obj = np.roll(obj, -1, 0)
        below_face = np.roll(face, -1, 0)
        edge = (face == 1) & (below_obj == obj) & ((below_face == 2) | (below_face == 3)) & (obj > 0)
        col[edge] = np.minimum(255, col[edge] * 1.12 + 10)
        # ребро между левой и правой гранью — светлая вертикаль на левой
        right_obj = np.roll(obj, -1, 1)
        right_face = np.roll(face, -1, 1)
        e2 = (face == 2) & (right_obj == obj) & (right_face == 3) & (obj > 0)
        col[e2] = np.minimum(255, col[e2] * 1.06 + 6)
        # контур снаружи силуэта
        outl = np.zeros((H, W), bool)
        for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            no = np.roll(np.roll(obj, dj, 0), di, 1)
            nd = np.roll(np.roll(dep, dj, 0), di, 1)
            diff = (no != obj) & (obj > 0)
            further = (no <= 0) | (nd < dep - 1.5)
            outl |= diff & further & self._mode_mask(obj, no)
        outc = hx(out_default)
        for oid in np.unique(obj[outl]):
            m = outl & (obj == oid)
            oc = self.outc.get(int(oid))
            if oc is None:
                col[m] = col[m] * 0.35 + outc * 0.65
            else:
                col[m] = hx(oc)
        # свечение ламп и окон: ступенями, как в пиксельной графике
        if glows:
            yy, xx = np.mgrid[0:H, 0:W]
            for (gx, gy, r, gc, k) in glows:
                d = np.sqrt((xx - gx) ** 2 + ((yy - gy) * 1.6) ** 2) / r
                band = np.where(d < 0.45, 1.0, np.where(d < 0.75, 0.6, np.where(d < 1.0, 0.3, 0.0)))
                col = col + band[..., None] * k * (hx(gc)[None, None, :] - col * 0.25)
        if grade is not None:
            col = grade(col)
        col = np.clip(col, 0, 255)
        img = Image.fromarray(col.astype(np.uint8), 'RGB')
        px = img.load()
        for rows, pal, x, y, z, ax, ay in self.overlay:
            sx, sy = self.proj(x, y, z)
            sx, sy = int(np.floor(sx)), int(np.floor(sy))
            for r, row in enumerate(rows):
                for c, ch in enumerate(row):
                    cc = pal.get(ch)
                    if cc is None:
                        continue
                    i, j = sx - ax + c, sy - ay + r
                    if 0 <= i < W and 0 <= j < H:
                        px[i, j] = tuple(int(v) for v in hx(cc))
        return img

    def _mode_mask(self, obj, no):
        modes = np.vectorize(lambda o: {'full': 2, 'bg': 1, 'none': 0}[self.mode.get(int(o), 'none')] if o > 0 else 0)
        mo = modes(obj)
        return (mo == 2) | ((mo == 1) & (no <= 0))
