# -*- coding: utf-8 -*-
"""把生成的白底实体图抠成透明底、裁到主体、缩到 256px 方图，落进 web/shared/assets/实体图/。

用法（仓库根）: uv run python tools/抠白底.py .scratch/entity-art/货架

只抠「从画面边缘连得进来的近白色」：主体内部的白（狐狸肚皮、高光）被轮廓线拦住，
不会被误伤；贴纸风自带的白色裁切边要么整体保留（有描边隔开时）、要么整体透明
（与背景连通时），都不会烂边。输出 256px 是显示尺寸（≤64px）的 4 倍，留足 retina 余量，
也正好是第 2 讲 cellTexture 贴图画布的尺寸。

输入是 .scratch 里的无损 PNG 底稿（中间态要保真），落盘直出有损 WebP q90 —— 跟 85 张
批转（cwebp -q 90）同一参数，磁盘上永远只有 .webp 一种格式（见 .scratch/speedup/issues/03）。
"""

import sys
from collections import deque
from pathlib import Path

from PIL import Image

仓库根 = Path(__file__).resolve().parent.parent
出目录 = 仓库根 / "web" / "shared" / "assets" / "实体图"

近白 = 235   # r/g/b 全部 ≥ 此值算背景白
边距比 = 0.05
出尺寸 = 256


def 抠一张(源: Path, 目标: Path) -> None:
    图 = Image.open(源).convert("RGBA")
    宽, 高 = 图.size
    px = 图.load()

    # BFS 洪泛：从四边所有近白像素灌进来，凡连通的近白都判为背景
    背景 = bytearray(宽 * 高)
    队 = deque()
    def 试入(x: int, y: int) -> None:
        i = y * 宽 + x
        if 背景[i]:
            return
        r, g, b, _ = px[x, y]
        if r >= 近白 and g >= 近白 and b >= 近白:
            背景[i] = 1
            队.append((x, y))
    for x in range(宽):
        试入(x, 0); 试入(x, 高 - 1)
    for y in range(高):
        试入(0, y); 试入(宽 - 1, y)
    while 队:
        x, y = 队.popleft()
        if x > 0: 试入(x - 1, y)
        if x < 宽 - 1: 试入(x + 1, y)
        if y > 0: 试入(x, y - 1)
        if y < 高 - 1: 试入(x, y + 1)

    for y in range(高):
        行起 = y * 宽
        for x in range(宽):
            if 背景[行起 + x]:
                px[x, y] = (0, 0, 0, 0)

    框 = 图.getbbox()
    if 框 is None:
        raise ValueError("整张都被抠没了——阈值不对或图有问题")
    图 = 图.crop(框)

    # 补成带边距的正方形画布，再缩到出图尺寸
    边 = int(max(图.size) * (1 + 边距比 * 2))
    布 = Image.new("RGBA", (边, 边), (0, 0, 0, 0))
    布.paste(图, ((边 - 图.width) // 2, (边 - 图.height) // 2))
    布 = 布.resize((出尺寸, 出尺寸), Image.LANCZOS)
    布.save(目标, "WEBP", quality=90)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("用法: uv run python tools/抠白底.py <白底图目录>")
    源目录 = (仓库根 / sys.argv[1]).resolve()
    出目录.mkdir(parents=True, exist_ok=True)
    for 源 in sorted(源目录.glob("*.png")):
        目标 = 出目录 / (源.stem + ".webp")
        抠一张(源, 目标)
        print(f"{源.name} → {目标.relative_to(仓库根)} ({目标.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
