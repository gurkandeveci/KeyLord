#!/usr/bin/env python3
"""Eklenti simgelerini üretir (yalnızca standart kütüphane). Kullanım: python3 tools/make_icons.py"""
import os
import struct
import zlib

BLUE = (11, 98, 214)
WHITE = (255, 255, 255)
SS = 4  # kenar yumuşatma için alt örnekleme


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return ((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2) ** 0.5


def sample(x, y):
    """(x, y) 0..1 aralığında; (renk, alfa) döndürür. Şekil: mavi yuvarlak kare üzerinde beyaz '>_'."""
    r = 0.22
    cx = min(max(x, r), 1 - r)
    cy = min(max(y, r), 1 - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return BLUE, 0
    w = 0.055
    chevron = min(seg_dist(x, y, 0.24, 0.30, 0.48, 0.50), seg_dist(x, y, 0.48, 0.50, 0.24, 0.70))
    underscore = seg_dist(x, y, 0.56, 0.72, 0.78, 0.72)
    if chevron <= w or underscore <= w:
        return WHITE, 1
    return BLUE, 1


def render(size):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(SS):
                for sx in range(SS):
                    color, alpha = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)
                    for i in range(3):
                        acc[i] += color[i] * alpha
                    acc[3] += alpha
            n = SS * SS
            if acc[3] == 0:
                row += bytes([0, 0, 0, 0])
            else:
                row += bytes([round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(255 * acc[3] / n)])
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, size):
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(render(size), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for s in (16, 32, 48, 128):
        write_png(os.path.join(out, "icon%d.png" % s), s)
        print("icons/icon%d.png" % s)
