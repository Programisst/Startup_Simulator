"""Generate the daylight small-office colour/depth atlas and its floor plan."""

import argparse
import json
from pathlib import Path

import numpy as np

from iso import Scene, hx, ihash
from office import DESK_DEPTH, DESK_WIDTH, LOOKS, MONITOR, SEAT_OFFSET, city, desktop, material, mug, plant, save_atlas

WIDTH, HEIGHT = 696, 408
ORIGIN = (316, 56)
ROOM = (360, 300)
FOUNDER = (308, 223)
DESKS = tuple((x, y) for columns in ((29, 81, 133), (207, 259, 311))
              for y in (32, 108) for x in columns) + (FOUNDER,)
COFFEE = {"target": {"x": 149, "y": 247}, "surface": {"x": 129, "y": 247}, "height": 31}
REST = {"target": {"x": 233, "y": 252}, "surface": {"x": 221, "y": 253}, "height": 14}
AREAS = [
    (6, 179, 9, 154, "#b7b5a0", "#a09c86"),
    (188, 354, 9, 154, "#c9ba9e", "#ad9e81"),
    (6, 107, 200, 294, "#ccb099", "#ab8873"),
    (113, 202, 200, 294, "#ded6bf", "#b9b3a2"),
    (208, 286, 200, 294, "#b7bb9f", "#909778"),
    (292, 354, 200, 294, "#b3bcba", "#929f9f"),
]
LOOK = LOOKS["day"]
STONE = ("#e1d7bb", "#bdaa90", "#aa9e88")
OAK = ("#d7b88a", "#a48160", "#826955")
JADE = ("#9da99a", "#748c81", "#5e736c")
TERRACOTTA = ("#c2947b", "#a77360", "#845d53")
INDIGO = ("#9aabb0", "#6f858d", "#586975")
GRAPHITE = ("#8a928c", "#626e68", "#515a59")


def floor(x, y, _):
    row = y // 7
    grain = (ihash(x // 11, y // 1) - .5) * 7
    stagger = (x + row % 5 * 9) % 44
    lines = (y % 7 < .8) | (stagger < .8)
    result = hx("caae87") + (grain - lines * 14)[:, None]
    for index, (x0, x1, y0, y1, main, edge) in enumerate(AREAS):
        inset = np.minimum.reduce((x - x0, x1 - x, y - y0, y1 - y))
        inside = inset >= 0
        if index == 3:
            seam = (x % 12 < .8) | (y % 12 < .8)
            tile = hx(main) + ((ihash(x // 12, y // 12) - .5) * 12 - seam * 20)[:, None]
            result[inside] = tile[inside]
        else:
            tone = np.where((inset < 1.5)[:, None], hx(edge), hx(main))
            texture = (ihash(x // 2, y // 2) - .5) * 9
            result[inside] = (tone + texture[:, None])[inside]
    for dx, dy in DESKS:
        distance = np.maximum.reduce((dx - x, x - dx - DESK_WIDTH, dy - y, y - dy - 34))
        result -= np.where(distance < 1, 12, np.where(distance < 4, 4, 0))[:, None]
    for start, end in ((13, 177), (192, 350)):
        light = x - y * .48
        sun = (light >= start) & (light < end) & ((light - start) % 33 > 2) & (y > 7)
        strength = np.where(y < 49, .3, np.where(y < 67, .16, 0))
        strength *= sun & ((y < 30) | (y > 33))
        result += (hx("fff0c2") - result) * strength[:, None]
    return result


class OfficePlan:
    def __init__(self):
        self.scene = Scene(WIDTH, HEIGHT, *ORIGIN, self.backdrop)
        self.blockers = []

    @staticmethod
    def backdrop(scene):
        scene.col[:] = hx("343836")
        material(scene, (7, ROOM[0] + 7, 0, ROOM[1] + 7, -11, -9),
                 ("#2c312e", "#2c312e", "#2c312e"), outline="none")

    def box(self, bounds, heights, palette, *, solid=False, outline="full"):
        material(self.scene, (*bounds, *heights), palette, outline=outline)
        if solid:
            self.blockers.append(bounds)

    def wall(self, bounds, height=10):
        self.box(bounds, (0, height - 1), STONE, solid=True)
        self.box(bounds, (height - 1, height), OAK, outline="none")

    def potted(self, x, y):
        plant(self.scene, x, y)
        self.blockers.append((x - 4, x + 4, y - 4, y + 4))

    def architecture(self):
        w, h = ROOM
        self.box((0, w, 0, h), (-8, -2), (None, "#a1886b", "#786856"), outline="bg")
        self.box((0, w, 0, h), (-2, 0), (floor, "#b49a78", "#92816d"))
        self.wall((0, 5, 0, 177), 34)
        self.wall((0, 5, 177, 210), 11)
        self.wall((0, 5, 210, 249), 41)
        self.wall((0, 5, 249, h), 11)
        for y, ink in ((61, "#728a81"), (82, "#b2846e")):
            self.box((4, 6, y, y + 16), (16, 29), OAK)
            self.box((6, 6.5, y + 1, y + 15), (17, 28), (None, None, "#ede1c6"), outline="none")
            self.box((6.5, 7, y + 4, y + 12), (20, 23), (None, None, ink), outline="none")
            self.box((6.5, 7, y + 7, y + 12), (23, 25), (None, None, ink), outline="none")
        self.wall((5, w, 0, 5), 46)
        view = city(LOOK, "day", window_start=13, window_end=350)
        for x in (*range(13, 177, 33), *range(192, 350, 32)):
            self.box((x - 1, x + 31, 4, 6), (12, 43), OAK, outline="none")
            self.box((x, x + 29, 6, 7), (15, 41), (None, view, None), outline="none")
            self.box((x, x + 29, 7, 8), (29, 30), (None, "#c0af97", None), outline="none")
            self.box((x - 2, x + 31, 4, 9), (12, 14), STONE, outline="none")

        for y0, y1 in ((6, 58), (111, 150)):
            self.wall((179, 184, y0, y1), 13)
        for x in (108, 203, 287):
            self.wall((x, x + 4, 200, 300))
        # Open cutaway doors with oak thresholds in the four rooms.
        doors = ((65, 96), (151, 182), (241, 272), (302, 332))
        for (x0, x1, *_), (left, right) in zip(AREAS[2:], doors):
            self.wall((x0, left, 195, 200), 10)
            self.wall((right, x1, 195, 200), 10)
            self.box((left, right, 195, 200), (0, .65), OAK, outline="none")
        # The meeting room's glazed corner leaves a clear view over the table.
        self.box((10, 64, 196, 198), (10, 20), ("#b9c5b5", "#adbcb0", "#a1b2a9"), outline="none")
        for x in (9, 26, 45, 63):
            self.box((x, x + 1.5, 195, 199), (9, 21), GRAPHITE, outline="none")
        self.box((9, 65, 195, 199), (20, 21), GRAPHITE, outline="none")

    def table(self, bounds, palette, height):
        x0, x1, y0, y1 = bounds
        for x in (x0 + 2, x1 - 4):
            for y in (y0 + 2, y1 - 4):
                self.box((x, x + 2, y, y + 2), (0, height - 2), GRAPHITE)
        self.box(bounds, (height - 2, height), palette, solid=True)

    def armchair(self, x, y, palette, *, front=False):
        self.box((x, x + 14, y, y + 13), (1, 7), OAK)
        self.box((x, x + 14, y, y + 13), (7, 9), palette, solid=True)
        back = y + 10 if front else y
        self.box((x, x + 14, back, back + 3), (8, 16), palette)

    def meeting(self):
        self.table((28, 80, 229, 254), OAK, 15)
        for x in (32, 60):
            self.armchair(x, 211, TERRACOTTA)
            self.armchair(x, 260, TERRACOTTA, front=True)
        self.box((37, 69, 240, 244), (15, 15.5), ("#938e77", None, None), outline="none")
        self.box((48, 54, 232, 240), (15, 16), ("#e3d8bb", "#b8ab93", "#a59b86"), outline="none")
        mug(self.scene, 62, 246, 15, "#d9ddc3")
        self.box((6, 15, 215, 245), (0, 15), JADE, solid=True)
        self.box((6, 9, 214, 246), (23, 40), OAK)
        self.box((8, 10, 216, 244), (25, 38), (None, None, "#ece2c8"), outline="none")
        for y, size, color in ((219, 4, "#8aa194"), (227, 8, "#ba8b73"), (238, 4, "#b5a48c")):
            self.box((9.8, 10.2, y, y + size), (30, 33), (None, None, color), outline="none")
        self.potted(19, 281)

    def kitchen(self):
        self.box((115, 136, 216, 282), (0, 15), JADE, solid=True)
        self.box((115, 137, 216, 282), (15, 18), STONE)
        for y in range(218, 278, 12):
            self.box((135.8, 136.4, y, y + 10), (2, 13), (None, None, "#858e7e"), outline="none")
            self.box((136, 137, y + 2, y + 7), (10, 11), (None, None, "#c3c4b0"), outline="none")
        self.box((119, 133, 222, 237), (18, 18.5), ("#7a8981", "#56625f", "#65706e"))
        self.box((121, 131, 225, 235), (18.5, 19), ("#a8b4ac", None, None), outline="none")
        self.box((120, 122, 227, 229), (18, 24), GRAPHITE, outline="none")
        self.box((120, 126, 227, 229), (23, 24), GRAPHITE, outline="none")
        self.box((118, 133, 240, 253), (18, 20), GRAPHITE)
        self.box((118, 123, 241, 252), (20, 32), GRAPHITE)
        self.box((123, 132, 241, 252), (29, 32), GRAPHITE)
        self.box((125, 130, 245, 250), (20, 27), OAK)
        self.box((131, 132.5, 247, 249), (29.5, 30.5), ("#e5cf83", None, "#d2a56c"))
        mug(self.scene, 127, 257, 18, "#d5ccb4")
        mug(self.scene, 120, 263, 18, "#aa7461")
        self.box((115, 137, 282, 297), (0, 34), STONE, solid=True)
        self.box((137, 138, 284, 296), (0, 34), JADE)
        self.box((138, 139, 285, 296), (12, 13), (None, None, "#576959"), outline="none")
        self.box((138, 140, 285, 287), (16, 25), GRAPHITE, outline="none")
        self.table((171, 194, 261, 278), OAK, 13)
        self.armchair(176, 280, JADE, front=True)

    def lounge(self):
        self.box((209, 228, 231, 271), (1, 7), OAK, solid=True)
        self.box((209, 213, 231, 271), (7, 22), JADE)
        for y in (233, 251):
            self.box((213, 228, y, y + 17), (7, 11), JADE)
        for y in (231, 269):
            self.box((210, 229, y, y + 3), (7, 16), JADE)
        self.box((216, 222, 234, 242), (11, 16), TERRACOTTA)
        self.box((215, 222, 259, 267), (11, 15), STONE)
        self.table((241, 256, 249, 270), OAK, 10)
        self.box((244, 251, 254, 261), (10, 11), INDIGO, outline="none")
        mug(self.scene, 245, 263, 10, "#e0c6a5")
        self.armchair(265, 273, JADE, front=True)
        self.potted(216, 287)
        self.potted(276, 211)

    def founder_nook(self):
        self.box((337, 353, 272, 294), (0, 12), OAK, solid=True)
        self.box((338, 352, 273, 293), (12, 13), INDIGO)
        for y in (276, 284):
            self.box((341, 348, y, y + 6), (13, 15), STONE, outline="none")
        self.potted(300, 286)

    def draw(self):
        self.architecture()
        self.meeting()
        self.kitchen()
        self.lounge()
        self.founder_nook()
        for x, y in ((12, 73), (173, 169), (345, 172), (190, 16)):
            self.potted(x, y)
        for seat, position in enumerate(DESKS):
            founder = position == FOUNDER
            look = {**LOOK, "wood": "b68e6a 967154 765d4e"} if founder else LOOK
            desktop(self.scene, look, "day", 0 if founder else seat, None, position=position, with_chair=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    output = parser.parse_args().output
    output.mkdir(parents=True, exist_ok=True)
    office = OfficePlan()
    office.draw()
    data = {
        "width": WIDTH, "height": HEIGHT, "origin": ORIGIN, "room": ROOM,
        "desks": DESKS, "deskSize": (DESK_WIDTH, DESK_DEPTH),
        "seatOffset": SEAT_OFFSET, "monitor": MONITOR,
        "fixedObstacles": office.blockers,
        "chair": save_atlas(output, "small-office-art", office.scene),
        "spawn": {"x": 314, "y": 181},
        "coffee": COFFEE, "rest": REST,
        "breakPoints": [{"x": x, "y": y} for x, y in (
            (232, 217), (206, 170), (65, 173), (113, 176), (151, 173), (90, 215),
            (221, 220), (253, 220), (273, 233), (276, 172), (250, 172), (310, 171),
        )],
    }
    (output / "small-office-art.json").write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    main()
