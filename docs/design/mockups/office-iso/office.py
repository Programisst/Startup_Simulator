"""Draw three 2:1 coworking scenes from a SceneTeam JSON on stdin."""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from iso import Scene, hx, ihash


WIDTH, HEIGHT = 408, 276
ROOM_X, ROOM_Y = 195, 145
# Each index is a permanent ScenePerson.seat. Keep holes when someone leaves.
DESKS = ((33, 28), (82, 28), (131, 28), (42, 92), (91, 92), (140, 92))
COFFEE = (6, 25, 59, 108)
RUG = (32, 176, 68, 87)
FLOOR_PLANTS = ((13, 118), (187, 69))
WINDOW_START, WINDOW_SPACING = 48, 39
WINDOW_BAYS = tuple(WINDOW_START + i * WINDOW_SPACING for i in range(3))
WINDOW_END = WINDOW_BAYS[-1] + WINDOW_SPACING - 2

# The three faces are top, y-facing and x-facing, in that order.
LOOKS = {
    "evening": {
        "name": "1 · Коворкинг — Тёплый вечер",
        "backdrop": "25222c 312a32 211e27",
        "floor": "97704f 775137 513749",
        "walls": "cab090 94705d 735b5a",
        "wood": "ba895b 896045 63474a",
        "trim": "977157 6d4b3a 523d46",
        "metal": "786d72 564b58 3c3747",
        "fabric": "a36452 754a4c 533d47",
        "rug": "766c72 b28b71 554d60",
        "sky": "686780 b18583 d4a384",
        "city": "7e6c7b 645666 4d465a 403c50",
        "light": "f9c28a",
        "screen": "6d9b8e a9d0aa c7b586",
    },
    "loft": {
        "name": "2 · Коворкинг — Ночной лофт",
        "backdrop": "1a2332 232f40 171f2d",
        "floor": "5e6570 474b59 373744",
        "walls": "9e8581 76636a 63595e",
        "wood": "846d64 615253 463e4a",
        "trim": "686571 4a4959 3d3e4d",
        "metal": "666a78 454954 353848",
        "fabric": "57868b 45646e 3c4b59",
        "rug": "495965 778486 394754",
        "sky": "29354e 364661 4d6175",
        "city": "40536b 37465c 333e53 273246",
        "light": "99d1df",
        "screen": "69a2ba b6e3dd d1a67f",
    },
    "day": {
        "name": "3 · Коворкинг — Светлый день",
        "backdrop": "343836 3d423c 2d312f",
        "floor": "c2a47d a88b66 766453",
        "walls": "e5d7ba cbb99d a79b86",
        "wood": "d5b78c ab8e67 82705b",
        "trim": "cac0a6 8c8773 746e60",
        "metal": "93968a 6c736d 565c5c",
        "fabric": "819281 657b71 4a5e5e",
        "rug": "6f8580 a5b4a0 566a67",
        "sky": "8fb5bb b7cdd0 dfddd1",
        "city": "a9b8b4 91a6a4 809797 718787",
        "light": "fff0c2",
        "screen": "638a80 a9c4a8 e3c18c",
    },
}

WORKER = (
    ".....ooooooo.....",
    "...ooHHHHhhhoo...",
    "..oHHHhhhhhhhho..",
    "..oHHhhhhhhhhho..",
    "..ohhhhhhhhdSso..",
    "..ohhhhhhhdSSso..",
    "...odhhhhhdsso...",
    "...oddddddSSo....",
    "....oooSSSoo.....",
    ".....ooSSo.......",
    "...ooWWwwWoo.....",
    "..oWWwwwwwwWoo...",
    ".oWWwwwwwwwwWSo..",
    ".oWWwwwwwwwwWSSo.",
    ".oWWWWwwwwWWoSSo.",
    "..oWWWWWWWWo.oo..",
    "...oWWWWWWo......",
    "....oooooo.......",
)

PLANT = (
    ".....ll........",
    "....lgg..llg...",
    ".ll.lgg.lgggg..",
    "lggg.lg.gg.....",
    ".lggg.g.g..llg.",
    "..ggg.gg.lggggg",
    "..ll..g.ggggg..",
    ".lggg.gg.gg....",
    "..ggggg.gg.....",
    "......ggg......",
    "...oooogooo....",
    "...oPPppppo....",
    "....oPppdo.....",
    "....oPppdo.....",
    ".....oooo......",
)

WORKER_COLORS = (
    ("#8b6e60", "#55423d", "#b3a492", "#ede1ce", "#bb897c", "#e8bfa1"),
    ("#7b6175", "#4b3d52", "#818574", "#a9a489", "#a26f5e", "#c9947d"),
    ("#986455", "#684840", "#a67369", "#c08a79", "#c29178", "#f0c49f"),
    ("#586373", "#373d4f", "#657e8a", "#86a0a5", "#875a53", "#b88974"),
)

MOOD_ICONS = {
    "high": ("#456c5f", ("     ", " x x ", "     ", "x   x", " xxx ")),
    "mid": ("#716350", ("     ", " x x ", "     ", " xxx ", "     ")),
    "low": ("#965750", ("     ", " x x ", "     ", " xxx ", "x   x")),
}
BUSY_ICON = ("#4a6973", ("     ", "xxxxx", "x x x", "xxxxx", "     "))
LEAVING_ICON = ("#9d4e42", ("  x  ", "  x  ", "  x  ", "     ", "  x  "))
STAR_ICON = ("#936532", ("  x  ", " xxx ", "xxxxx", " xxx ", " x x "))


def status_icons(person):
    icons = [MOOD_ICONS[person["mood"]]]
    if person["busy"]:
        icons.append(BUSY_ICON)
    if person["leaving"]:
        icons.append(LEAVING_ICON)
    if person["star"]:
        icons.append(STAR_ICON)
    return icons


def show_status(scene, person, x, y):
    icons = status_icons(person)
    ink_keys = ("i", "j", "k", "l")
    cells = []
    palette = {"o": "#3a3a50", "b": "#efe1c8"}
    for ink, (tone, glyph) in zip(ink_keys, icons):
        cells.append(tuple("b" + row.replace(" ", "b").replace("x", ink) + "b" for row in glyph))
        palette[ink] = tone
    width = 7 * len(cells) + 2
    rows = (
        "." + "o" * (width - 2) + ".",
        *("o" + "".join(line) + "o" for line in zip(*cells)),
        "o" + "b" * (width - 2) + "o",
        "." + "o" * (width - 2) + ".",
    )
    scene.over(rows, palette, x, y, 34, width // 2, 7)


def colors(look, surface):
    return tuple("#" + code for code in look[surface].split())


def material(scene, bounds, palette, *, outline="full"):
    return scene.box(*bounds, *palette, mode=outline)


def paint(base, *, x_wall=False, brick=False):
    color = hx(base)

    def sample(x, y, z):
        run = y if x_wall else x
        grain = (ihash(run // 2, z // 2) - .5)[:, None] * 5
        if not brick:
            return color + grain
        row = z // 6
        column = (run + (row % 2) * 8) // 16
        tone = (ihash(row, column) - .5) * 14
        mortar = (z % 6 < .8) | ((run + row % 2 * 8) % 16 < .8)
        return color + grain + (tone - mortar * 15)[:, None]

    return sample


def floor_color(look, style, rug=False):
    main, stripe, edge = map(hx, colors(look, "rug" if rug else "floor"))
    lamp = hx(look["light"])

    def sample(x, y, _):
        if rug:
            x0, x1, y0, y1 = RUG
            rim = np.minimum(np.minimum(x - x0, x1 - x), np.minimum(y - y0, y1 - y))
            stripe_mask = ((rim >= 3) & (rim < 5)) | ((rim >= 6) & (rim < 7))
            base = np.where((rim < 1.6)[:, None], edge, main)
            base = np.where(stripe_mask[:, None], stripe, base)
            texture = (ihash(x // 2, y // 2) - .5) * 10
        elif style == "loft":
            tx, ty = x // 32, y // 27
            seam = (x % 32 < .8) | (y % 27 < .8)
            texture = (ihash(tx, ty) - .5) * 9 + (ihash(x // 2, y // 2) - .5) * 7 - seam * 13
            base = main
        else:
            slat = y // 7
            row_offset = (slat % 4) * 11
            plank = (x + row_offset) // 44
            joints = (y % 7 < .8) | ((x + row_offset) % 44 < .8)
            grain = ihash(x // 10, y // 1) > .73
            texture = (ihash(plank, slat) - .5) * 14 - joints * 14 + grain * 5
            base = main

        ambient = np.minimum(np.minimum(x, y), np.minimum(ROOM_X - x, ROOM_Y - y))
        shade = np.where(ambient < 4, 9, np.where(ambient < 9, 4, 0))
        for dx, dy in DESKS:
            distance = np.maximum.reduce((dx - x, x - dx - 35, dy - y, y - dy - 35))
            shade += np.where(distance < 1, 11, np.where(distance < 5, 4, 0))
        x0, x1, y0, y1 = COFFEE
        near_cabinet = np.maximum.reduce((x0 - x, x - x1, y0 - y, y - y1))
        shade += np.where(near_cabinet < 1, 12, np.where(near_cabinet < 4, 4, 0))
        for px, py in FLOOR_PLANTS:
            under_pot = ((x - px - 1) / 4) ** 2 + ((y - py - 1) / 4) ** 2
            shade += np.where(under_pot < 1, 16, np.where(under_pot < 2, 7, 0))

        # The window mullions cast shadows in the same direction as the light.
        through_window = x - y * (.58 if style == "day" else .37)
        slit = (through_window > WINDOW_START) & (through_window < WINDOW_END)
        slit &= ((through_window - WINDOW_START) % WINDOW_SPACING > 2) & (y > 11)
        if style == "day":
            lower_rail = (y > 44) & (y < 48)
            window = (slit & ~lower_rail) * np.where(y < 63, .44, np.where(y < 78, .23, 0))
        elif style == "evening":
            window = slit * np.where(y < 55, .15, np.where(y < 67, .065, 0))
        else:
            window = slit * np.where(y < 51, .14, 0)
        return base + (texture - shade)[:, None] + window[:, None] * (lamp - main)

    return sample


def backdrop(look):
    base, halo, shadow = map(hx, colors(look, "backdrop"))

    def draw(scene):
        yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
        distance = ((xx - WIDTH / 2) / 205) ** 2 + ((yy - 122) / 152) ** 2
        levels = np.floor(np.maximum(0, 1 - distance) * 10) / 10
        scene.col[:] = base + levels[:, :, None] * (halo - base)
        mask = Image.new("1", (WIDTH, HEIGHT))
        corners = ((0, 0), (ROOM_X, 0), (ROOM_X, ROOM_Y), (0, ROOM_Y))
        silhouette = [scene.proj(x, y, -9) for x, y in corners]
        ImageDraw.Draw(mask).polygon([(x + 8, y + 4) for x, y in silhouette], fill=1)
        scene.col[np.asarray(mask)] = shadow

    return draw


def city(look, style):
    sky = np.stack([hx(code) for code in colors(look, "sky")])
    skyline = np.stack([hx(code) for code in colors(look, "city")])
    lit = hx("e7b77b" if style != "day" else "d6d9c9")
    buildings = ((0, 14, 8), (16, 12, 13), (28, 17, 10), (47, 11, 15), (58, 15, 8),
                 (74, 11, 18), (85, 13, 11), (4, 15, 7), (19, 13, 10), (35, 9, 16),
                 (44, 20, 7), (65, 11, 13), (77, 21, 8))

    def view(x, _, z):
        u = (x - WINDOW_START) * 98 / (WINDOW_END - WINDOW_START)
        v = z - 17
        band = np.clip(np.floor(v / 9), 0, 2).astype(int)
        result = sky[2 - band].copy()
        if style == "evening":
            sun = (u - 77) ** 2 + (v - 20) ** 2 < 22
            result[sun] = hx("f4bf91")
            clouds = ((v // 2 == 9) & (u > 7) & (u < 29)) | ((v // 2 == 11) & (u > 40) & (u < 62))
            result[clouds] += (12, 6, 4)
        if style == "loft":
            stars = (v > 17) & (ihash(u // 2, v // 2) > .986) & (u % 2 < 1)
            result[stars] = hx("8194a6")
        if style == "day":
            clouds = ((u - 25) / 14) ** 2 + ((v - 19) / 3.5) ** 2 < 1
            clouds |= ((u - 75) / 13) ** 2 + ((v - 24) / 2.5) ** 2 < 1
            result[clouds] = hx("dce0d6")
        for index, (start, width, height) in enumerate(buildings):
            building = (u >= start) & (u < start + width) & (v < height)
            result[building] = skyline[(index % 2) + (2 if index > 6 else 0)]
            windows = building & ((u - start) % 4 < 1.3) & (v % 4 < 1.25) & (v > 1)
            windows &= ihash(u // 4, v // 4, np.full_like(u, index)) > (.35 if style == "loft" else .70)
            result[windows] = lit
        return result

    return view


def architecture(scene, look, style):
    wall = colors(look, "walls")
    trim = colors(look, "trim")
    floor = colors(look, "floor")
    metal = colors(look, "metal")
    material(scene, (0, ROOM_X, 0, ROOM_Y, -8, -2), (None, floor[1], floor[2]), outline="bg")
    material(scene, (0, ROOM_X, 0, ROOM_Y, -2, 0), (floor_color(look, style), *trim[1:]))
    material(scene, (0, 4, 0, ROOM_Y, 0, 51),
             (wall[0], trim[1], paint(wall[2], x_wall=True, brick=style == "loft")))
    material(scene, (4, ROOM_X, 0, 4, 0, 51), (wall[0], paint(wall[1]), trim[2]))
    material(scene, (0, 5, 0, ROOM_Y, 49, 52), (wall[0], trim[1], wall[2]), outline="bg")
    material(scene, (5, ROOM_X, 0, 5, 49, 52), (wall[0], wall[1], trim[2]), outline="bg")
    material(scene, (4, 6, 5, ROOM_Y, 0, 5), trim)
    material(scene, (6, ROOM_X, 4, 6, 0, 5), trim)

    # Three window bays share a single city view behind their mullions.
    frame = metal if style == "loft" else trim
    window_left, window_right = WINDOW_START - 3, WINDOW_END + 4
    material(scene, (window_left, window_right, 3, 6, 15, 47), frame)
    glass = city(look, style)
    for left in WINDOW_BAYS:
        material(scene, (left, left + WINDOW_SPACING - 2, 6, 7, 18, 44),
                 (None, glass, None), outline="none")
    material(scene, (window_left, window_right, 4, 8, 15, 18), frame)
    material(scene, (window_left, window_right, 5, 7, 33, 34), frame, outline="none")
    if style != "loft":
        for left in WINDOW_BAYS:
            material(scene, (left + 1, left + 2, 6, 7.2, 35, 43),
                     (None, colors(look, "sky")[1], None), outline="none")
    if style == "day":
        for left, bottom in zip(WINDOW_BAYS, (39, 42, 43)):
            right = left + WINDOW_SPACING - 2
            material(scene, (left, right, 7, 8, bottom, 45),
                     ("#eee4cd", "#c7bda8", "#989583"), outline="none")
            material(scene, (left, right, 8, 9, bottom, bottom + 1),
                     ("#d8cdb4", "#a89f8e", "#989583"), outline="none")

    # Door and threshold at the end of the aisle.
    door_x = ROOM_X - 23
    material(scene, (door_x, door_x + 20, 3, 6, 0, 41), frame)
    door = colors(look, "wood") if style != "loft" else metal
    material(scene, (door_x + 2, door_x + 18, 5, 6.5, 1, 38), door)
    material(scene, (door_x + 4, door_x + 16, 6, 7, 12, 34), (None, door[0], None), outline="none")
    material(scene, (door_x + 3, door_x + 7, 7, 8, 15, 17), ("#d0b68b", "#a78a6f", "#776b67"))
    material(scene, (door_x, door_x + 20, 6, 10, 0, .8), trim, outline="none")


def pinboard(scene, look, style):
    woods = colors(look, "wood")
    trim = colors(look, "trim")
    metal = colors(look, "metal")
    if style == "loft":
        material(scene, (4, 10, 16, 108, 41, 46), metal)
        for y in (17, 39, 67, 94, 105):
            material(scene, (4, 11, y, y + 2, 40.5, 46.5), trim)
        material(scene, (4, 10, 16, 20, 22, 44), metal)
        frame, backing = metal, "#53646a"
    elif style == "day":
        material(scene, (4, 5, 7, 117, 5, 22), (trim[0], trim[1], "#999a83"), outline="none")
        material(scene, (4, 6, 7, 117, 21, 23), trim, outline="none")
        frame, backing = trim, "#eee0bb"
    else:
        for y in range(8, 117, 6):
            material(scene, (4, 5, y, y + 5, 6, 43), (None, None, "#846458"), outline="none")
        frame, backing = woods, "#b18767"

    material(scene, (4, 8, 23, 57, 23, 39), frame)
    material(scene, (8, 8.5, 25, 55, 25, 37), (None, None, backing), outline="none")
    notes = ((28, 32, 31, 35, "#dcca96"), (34, 41, 27, 34, "#e8d2ad"),
             (43, 47, 30, 35, "#b5bab2"), (49, 53, 28, 32, "#c88770"))
    for y0, y1, z0, z1, color in notes:
        material(scene, (8.5, 9, y0, y1, z0, z1), (None, None, color), outline="none")
    for y, z in ((29, 34), (36, 33), (45, 34), (51, 31)):
        material(scene, (9, 9.5, y, y + 1, z, z + 1), (None, None, "#765560"), outline="none")


def plant(scene, x, y, z=0, *, tabletop=False):
    palette = {
        "l": "#8b9b73", "g": "#566f60", "o": "#3a3a50", "P": "#c09476",
        "p": "#a56e5a", "d": "#7b5351",
    }
    if tabletop:
        rows = ("...lg..", ".l.gg..", ".ggg.gl", "..gggg.", "...g...", ".oPPpo.", "..Ppd..", "..ooo..")
        scene.sprite(rows, palette, x, y, z, 3, 7, bias=3)
    else:
        scene.sprite(PLANT, palette, x, y, z, 7, 14, bias=5)


def mug(scene, x, y, z, color):
    material(scene, (x, x + 3, y, y + 3, z, z + 3), ("#473843", color, color), outline="none")
    material(scene, (x + 3, x + 4, y + 1, y + 3, z + 1, z + 2.4),
             (color, color, color), outline="none")


def coffee_corner(scene, look, style):
    x0, x1, y0, y1 = COFFEE
    wood = colors(look, "wood")
    trim = colors(look, "trim")
    metal = colors(look, "metal")
    case = metal if style == "loft" else trim
    material(scene, (x0, x1 - 1, y0 + 1, y1 - 1, 1, 14), case)
    material(scene, (x0, x1, y0, y1, 14, 17), wood)
    for y in (62, 77, 92):
        material(scene, (24, 26, y, y + 12, 3, 13), (None, None, case[1]))
        material(scene, (26, 27, y + 2, y + 6, 10, 11), ("#d4b58e", None, "#b29a81"), outline="none")

    # Coffee maker, carafe, two mugs and an open shelf of supplies.
    material(scene, (8, 21, 85, 100, 17, 19), metal)
    material(scene, (8, 14, 86, 99, 19, 31), metal)
    material(scene, (8, 18, 86, 99, 27, 31), metal)
    material(scene, (14, 19, 89, 96, 19, 25), ("#8c7466", "#524959", "#60525b"))
    material(scene, (19, 20, 92, 95, 20, 23), ("#b29780", None, "#796669"), outline="none")
    material(scene, (17, 19, 91, 94, 29, 30), (None, None, "#d8a476"), outline="none")
    mug(scene, 19, 67, 17, "#decda7")
    mug(scene, 13, 74, 17, "#a18173")
    material(scene, (4, 13, 66, 103, 37, 39), wood)
    if style == "loft":
        material(scene, (7, 12, 82, 100, 36, 37), (None, "#b4917a", "#a27d67"), outline="none")
    for y, height, color in ((74, 6, "#af937f"), (79, 7, "#ccaa79"), (88, 5, "#868d82"), (95, 7, "#bd9d8e")):
        material(scene, (7, 11, y, y + 4, 39, 39 + height), (color, color, color))
    plant(scene, 12, 62, 17, tabletop=True)


def lamp(scene, look, style, x, y, z):
    metal = colors(look, "metal")
    light = colors(look, "light")[0]
    material(scene, (x, x + 6, y, y + 6, z, z + 1), metal)
    material(scene, (x + 2, x + 4, y + 2, y + 4, z + 1, z + 13), metal, outline="none")
    material(scene, (x, x + 9, y + 1, y + 5, z + 12, z + 14), metal)
    shade = metal if style == "loft" else ("#d2ad79", "#a78468", "#80665d")
    material(scene, (x + 5, x + 12, y, y + 7, z + 10, z + 14), shade)
    material(scene, (x + 6, x + 11, y + 1, y + 6, z + 9, z + 10), (None, light, light), outline="none")


def keyboard(scene, x, y, occupied):
    case = "#bab1a2" if occupied else "#a08d81"
    material(scene, (x, x + 12, y, y + 5, 16, 17), (case, "#655c65", "#514954"))
    for row in (y + .7, y + 2.4):
        for column in (x + 1, x + 3, x + 5, x + 7, x + 9):
            material(scene, (column, column + 1.3, row, row + .9, 17, 17.1),
                     ("#e0d4bd", None, None), outline="none")
    material(scene, (x + 16, x + 19, y + 1, y + 5, 16, 17), ("#b5b0a4", "#797780", "#565360"))


def desktop(scene, look, style, seat, person):
    x, y = DESKS[seat]
    walnut, front, side = colors(look, "wood")
    metal = colors(look, "metal")
    fabric = colors(look, "fabric")
    screen, signal, caret = (hx(c) for c in colors(look, "screen"))

    def surface(X, Y, _):
        streaks = (ihash(X // 8, Y // 1) - .5) * 7
        delta = (Y % 5 < .85) * -6
        return hx(walnut) + (streaks + delta)[:, None]

    for dx in (1, 31):
        for dy in (1, 17):
            material(scene, (x + dx, x + dx + 2.8, y + dy, y + dy + 2.8, 0, 14), metal)
    material(scene, (x, x + 35, y, y + 21, 14, 16), (surface, front, side))
    material(scene, (x + 10, x + 21, y + 3, y + 8, 16, 17), metal)
    material(scene, (x + 14, x + 17, y + 4, y + 6, 17, 21), metal, outline="none")
    material(scene, (x + 7, x + 24, y + 3, y + 6, 20, 32), metal)

    def display(X, _Y, Z):
        if person is None or not person["busy"]:
            return np.tile(hx("434450"), (len(X), 1))
        dx = X - x - 8
        dz = Z - 21
        result = np.tile(screen * .48, (len(X), 1))
        bar = (dz >= 8) | (dx < 2)
        result[bar] = screen * .72
        lines = (np.floor(dz) % 2 == 0) & (dz < 8) & (dz > 1) & (dx > 3)
        lines &= dx < 12 - np.floor(dz) % 5
        result[lines] = signal
        result[(dx > 3) & (dx < 5) & (dz > 2) & (dz < 3)] = caret
        return result

    material(scene, (x + 8, x + 23, y + 6, y + 6.3, 21, 31), (None, display, None), outline="none")
    keyboard(scene, x + 9, y + 12, person is not None)
    if seat == 0:
        mug(scene, x + 4, y + 13, 16, "#d9bea0")
        lamp(scene, look, style, x + 26, y + 3, 16)
    elif seat in (2, 5):
        plant(scene, x + 30, y + 5, 16, tabletop=True)
        material(scene, (x + 2, x + 7, y + 10, y + 17, 16, 16.6),
                 ("#b08877", "#86655c", "#796269"), outline="none")
    else:
        material(scene, (x + 3, x + 10, y + 5, y + 12, 16, 17),
                 ("#b4aba4", "#71656b", "#71656b"), outline="none")

    cy = y + (26 if person else 30)
    cx = x + 16
    material(scene, (cx - 6, cx + 7, cy + 1, cy + 3, 0, 2), metal)
    material(scene, (cx, cx + 2, cy - 4, cy + 7, 0, 2), metal)
    material(scene, (cx - 1, cx + 2, cy, cy + 3, 2, 8), metal)
    material(scene, (cx - 6, cx + 7, cy - 5, cy + 6, 8, 11), fabric)
    material(scene, (cx - 6, cx + 7, cy + 4, cy + 7, 9, 20), fabric)

    if person:
        palette = dict(zip("HhWwSs", WORKER_COLORS[person["nameSeed"] % len(WORKER_COLORS)]))
        palette.update(o="#3a3a50", d="#382c38")
        scene.sprite(WORKER, palette, cx, cy, 11, 8, 17, bias=19)
        show_status(scene, person, cx + 1, cy)


def details(scene, look, style):
    wood = colors(look, "wood")
    metal = colors(look, "metal")
    x0, x1, y0, y1 = RUG
    material(scene, (x0, x1, y0, y1, 0, .4),
             (floor_color(look, style, rug=True), None, None), outline="none")
    for x, y in FLOOR_PLANTS:
        plant(scene, x, y)
    material(scene, (9, 28, 123, 135, 0, 9), wood)
    material(scene, (10, 27, 124, 132, 9, 10), ("#a6957b", wood[1], wood[2]), outline="none")
    material(scene, (15, 22, 134, 135.5, 4, 6), ("#d1b48a", "#c0a17a", "#a7846d"), outline="none")
    material(scene, (182, 188, 43, 49, 0, 7), metal)
    material(scene, (183, 187, 44, 48, 7, 7.2), ("#3a3a50", None, None), outline="none")


def people_by_seat(team):
    office = team["office"]
    if office["id"] != "coworking" or office["seats"] != len(DESKS):
        raise ValueError("The layout must match the coworking capacity from SceneTeam.")
    people = {person["seat"]: person for person in team["people"]}
    all_seats = set(range(office["seats"]))
    if len(people) != len(team["people"]) or not people.keys() <= all_seats:
        raise ValueError("Every employee needs their own seat in the layout.")
    if team["freeSeats"] != sorted(all_seats - people.keys()):
        raise ValueError("SceneTeam.freeSeats must match the unoccupied desks.")
    return people


def render(style, team):
    people = people_by_seat(team)
    look = LOOKS[style]
    scene = Scene(WIDTH, HEIGHT, 176, 79, backdrop(look))
    architecture(scene, look, style)
    details(scene, look, style)
    pinboard(scene, look, style)
    coffee_corner(scene, look, style)
    for seat in range(team["office"]["seats"]):
        desktop(scene, look, style, seat, people.get(seat))

    light = colors(look, "light")[0]
    gx, gy = scene.proj(63, 33, 25)
    coffee_x, coffee_y = scene.proj(16, 90, 30)
    glows = ()
    if style == "evening":
        glows = ((gx, gy, 27, light, .24), (coffee_x, coffee_y, 22, light, .12))
    if style == "loft":
        glows = ((gx, gy, 23, light, .12), (coffee_x, coffee_y, 20, "#efa678", .16))
    return scene.finish(glows=glows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directory for the native-resolution PNGs")
    args = parser.parse_args()
    team = json.load(sys.stdin)
    args.output.mkdir(parents=True, exist_ok=True)
    for style, look in LOOKS.items():
        render(style, team).save(args.output / (look["name"] + ".png"))


if __name__ == "__main__":
    main()
