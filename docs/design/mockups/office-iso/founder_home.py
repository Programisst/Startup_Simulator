"""Draw the founder's daylight studio in the same isometric projection as the offices."""

import json
import sys
from pathlib import Path

import numpy as np

from iso import Scene, hx, ihash
from office import DESK_DEPTH, DESK_WIDTH, LOOKS, MONITOR, SEAT_OFFSET, city, desktop, mug, save_atlas
from small_office import GRAPHITE, INDIGO, JADE, OAK, STONE, TERRACOTTA, OfficePlan

WIDTH, HEIGHT = 306, 222
ORIGIN = (135, 54)
ROOM = (158, 124)
DESK = (86, 15)
LOOK = LOOKS["day"]
COFFEE = {"target": {"x": 40, "y": 30}, "surface": {"x": 19, "y": 29}, "height": 29}
BED = {"target": {"x": 55, "y": 84}, "surface": {"x": 31, "y": 85}, "height": 15}
PILLOW = {"x": 29, "y": 66, "height": 15}


def floor(x, y, _):
    row = y // 6
    seam = (y % 6 < .8) | ((x + row % 4 * 13) % 42 < .8)
    grain = (ihash(x // 10, y) - .5) * 10
    result = hx("c6a580") + (grain - seam * 15)[:, None]
    runner = (x >= 57) & (x <= 145) & (y >= 12) & (y <= 61)
    border = (x < 60) | (x > 142) | (y < 15) | (y > 58)
    rug = np.where(border[:, None], hx("8d9d92"), hx("b3b8a4")) + (grain * .65)[:, None]
    result[runner] = rug[runner]
    kitchen = (x > 5) & (x < 49) & (y < 49) & (y > 5)
    tile = (x % 10 < .9) | (y % 10 < .9)
    result[kitchen] = (hx("d7ccb1") + (grain - tile * 22)[:, None])[kitchen]
    slant = x - y * .7
    sun = ((slant > 71) & (slant < 144) & (slant % 34 > 3) & (y > 8) & (y < 66))
    strength = np.maximum(0, .46 - y / 178) * sun
    return result + (hx("fff0c2") - result) * strength[:, None]


class FounderHome(OfficePlan):
    def __init__(self):
        self.scene = Scene(WIDTH, HEIGHT, *ORIGIN, self.backdrop)
        self.blockers = []

    @staticmethod
    def backdrop(scene):
        scene.col[:] = hx("343836")

    def architecture(self):
        w, h = ROOM
        self.box((4, w + 6, 1, h + 6), (-11, -8), ("#2c312e", "#2c312e", "#2c312e"), outline="none")
        self.box((0, w, 0, h), (-8, -2), (None, "#a1886b", "#786856"), outline="bg")
        self.box((0, w, 0, h), (-2, 0), (floor, "#b49a78", "#92816d"))
        self.wall((0, 5, 0, 91), 40)
        self.wall((0, 5, 91, h), 13)
        self.wall((5, w, 0, 5), 46)
        self.wall((7, 49, 47, 51), 8)
        window = city(LOOK, "day", window_start=60, window_end=148)
        self.box((59, 147, 4, 6), (13, 43), OAK)
        for x0, x1 in ((62, 100), (104, 144)):
            self.box((x0, x1, 6, 7), (16, 41), (None, window, None), outline="none")
            self.box((x0, x1, 7, 8), (29, 30), (None, "#c0af97", None), outline="none")
        self.box((58, 148, 4, 10), (12, 15), STONE)
        self.box((62, 84, 7, 8), (37, 42), (None, "#e9dbbf", None), outline="none")
        self.box((119, 144, 7, 8), (39, 42), (None, "#e9dbbf", None), outline="none")
        self.box((5, 46, 5, 7), (0, 39), OAK, outline="none")
        self.box((8, 44, 7, 8), (2, 37), (None, "#a78968", None), outline="none")
        self.box((38, 41, 8, 9), (17, 19), STONE)

    def kitchenette(self):
        self.box((7, 27, 14, 44), (0, 15), JADE, solid=True)
        self.box((7, 28, 14, 44), (15, 18), STONE)
        for y in (16, 30):
            self.box((27, 28, y, y + 11), (2, 14), (None, None, "#829687"), outline="none")
            self.box((28, 29, y + 3, y + 8), (10, 11), (None, None, "#c5c6a8"), outline="none")
        self.box((12, 24, 17, 24), (18, 19), GRAPHITE)
        self.box((13, 24, 25, 35), (18, 20), GRAPHITE)
        self.box((13, 17, 25, 35), (20, 31), GRAPHITE)
        self.box((17, 24, 25, 35), (28, 31), GRAPHITE)
        mug(self.scene, 20, 29, 20, "#c99679")
        mug(self.scene, 15, 38, 18, "#d8c7a3")
        self.box((4, 12, 14, 44), (34, 36), OAK)
        self.box((6, 11, 16, 24), (36, 42), TERRACOTTA, outline="none")
        self.box((6, 11, 29, 36), (36, 41), JADE, outline="none")

    def bedroom(self):
        self.box((13, 45, 55, 108), (1, 8), OAK, solid=True)
        self.box((13, 45, 55, 59), (8, 23), OAK)
        self.box((14, 44, 59, 107), (8, 12), STONE)
        self.box((20, 38, 60, 70), (12, 15), ("#eee4cf", "#d5c5aa", "#c1b49a"))
        self.box((13, 45, 73, 105), (10, 13), INDIGO)
        self.box((13, 45, 73, 78), (13, 14), ("#b7c3be", "#8f9e99", "#788a87"), outline="none")
        for y in (86, 96):
            self.box((15, 43, y, y + 1), (13, 13.4), ("#abbab9", None, None), outline="none")
        self.box((6, 14, 70, 84), (0, 13), OAK, solid=True)
        self.box((7, 11, 73, 77), (13, 20), GRAPHITE, outline="none")
        self.box((5, 13, 71, 80), (20, 25), ("#e5d5ac", "#bd9d79", "#9f8467"))
        self.box((4, 6, 61, 78), (27, 37), OAK)
        self.box((6, 7, 63, 76), (28, 36), (None, None, "#eee4cc"), outline="none")
        self.box((7, 8, 66, 73), (30, 34), (None, None, "#8b9d8f"), outline="none")

    def belongings(self):
        self.potted(145, 20)
        self.potted(11, 113)
        for x, y, w, h in ((128, 95, 19, 14), (129, 96, 15, 9), (132, 112, 13, 7)):
            z = 14 if h == 9 else 0
            self.box((x, x + w, y, y + 12), (z, z + h), OAK, solid=not z)
            self.box((x + w // 2 - 1, x + w // 2 + 2, y, y + 12),
                     (z + h, z + h + .4), (None if z == 0 and h > 9 else "#cdb693", None, None), outline="none")
        self.box((96, 118, 105, 120), (0, .5), ("#98937b", None, None), outline="none")
        for x in (100, 109):
            self.box((x, x + 5, 114, 119), (.5, 2.5), JADE, outline="none")

    def draw(self):
        self.architecture()
        self.kitchenette()
        self.bedroom()
        self.belongings()
        desktop(self.scene, LOOK, "day", 0, None, position=DESK, with_chair=False)


def main(output):
    room = FounderHome()
    room.draw()
    data = {
        "width": WIDTH, "height": HEIGHT, "origin": ORIGIN, "room": ROOM,
        "desks": (DESK,), "deskSize": (DESK_WIDTH, DESK_DEPTH),
        "seatOffset": SEAT_OFFSET, "monitor": MONITOR, "fixedObstacles": room.blockers,
        "chair": save_atlas(output, "founder-home-art", room.scene),
        "spawn": {"x": 82, "y": 86},
        "coffee": COFFEE, "rest": BED, "pillow": PILLOW,
        "extras": {
            "window": {"target": {"x": 70, "y": 18}, "surface": {"x": 75, "y": 7}, "height": 32},
            "lamp": {"target": {"x": 51, "y": 70}, "surface": {"x": 10, "y": 75}, "height": 24},
            "boxes": {"target": {"x": 116, "y": 91}, "surface": {"x": 137, "y": 103}, "height": 17},
        },
    }
    (output / "founder-home-art.json").write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
