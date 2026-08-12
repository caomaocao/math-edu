# -*- coding: utf-8 -*-
"""把生成的「篮子」白底图裁成第4讲蘑菇站要的那种**宽扁前沿托篮**，落进 assets/实体图/。

为什么篮子不走 tools/抠白底.py 那条标准线（正方 256、整只抠出来）：
  · 文生图**总给篮子画一根高高的提手**（提示词求了「不要提手」也拦不住这个先验），
    整只抠出来是个近正方、带拱形提手的篮子。蘑菇站要把「已摘的小蘑菇」排成**一行**
    卧在篮口（数列 1 2 4 7 → 11 16 得从左往右读得出差递增），一行 6 只 ≈ 300px 宽，
    可正方篮子的篮口太窄、又太高，塞不下一行、还顶爆本站的高度预算。
  · 所以只取篮子**前沿那一圈**（前缘绳箍 + 前壁），裁成又宽又浅的一条，小蘑菇卧在绳箍上。
    去了后沿和提手，抠得干净、没有直角裁边的接缝。

所以这一张的落盘尺寸是**非正方**（约 680×285），是本仓库里唯一一张宽扁素材；
渲染在 styles.css 的 .篮框/.篮图 里按这个宽高比给尺寸，不要用 画实体 的方形 尺寸。

用法（仓库根，先 `生成实体图.py 第4讲美化` 出好 篮子.png）：
    uv run python tools/裁篮子.py
"""

from pathlib import Path

from PIL import Image

from 抠白底 import 洪泛白底

仓库根 = Path(__file__).resolve().parent.parent
源 = 仓库根 / ".scratch" / "entity-art" / "第4讲美化" / "篮子.png"
目标 = 仓库根 / "web" / "shared" / "assets" / "实体图" / "篮子.webp"

上切 = 1185   # 2048 高的原图里，从这一行往下才是前沿托篮；以上是后沿+提手，全不要。
              # 左右和底不用切：洪泛把白底抠透明后 getbbox 自会贴住内容。
出宽 = 680


def main() -> None:
    if not 源.exists():
        raise SystemExit(f"没找到 {源}——先跑 uv run python tools/生成实体图.py 第4讲美化")
    图 = Image.open(源).convert("RGBA")
    图 = 图.crop((0, 上切, 图.width, 图.height))
    洪泛白底(图)
    图 = 图.crop(图.getbbox())
    宽, 高 = 图.size
    图 = 图.resize((出宽, round(高 * 出宽 / 宽)), Image.LANCZOS)
    图.save(目标, "WEBP", quality=90)
    print(f"{源.name} → {目标.relative_to(仓库根)} {图.size} ({目标.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
