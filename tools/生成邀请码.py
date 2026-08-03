# -*- coding: utf-8 -*-
"""生成一次性邀请码：连 DATABASE_URL，插入 N 个未使用的码并打印出来。

准入的唯一大门是邀请码 —— 新手机号必须携带一枚有效未用码才建号（老号直接短信登录）。
站长一次生成一批存着，随手发给亲友，用一个少一个。

用法（仓库根，DATABASE_URL 已在 .env 里）:
    uv run python tools/生成邀请码.py            # 默认 10 个
    uv run python tools/生成邀请码.py 5          # 指定个数

只写 invite_codes 一张表，used_by/used_at 留空 = 未用。有效性判据见
auth_service.find_valid_invite：code 存在且 used_by IS NULL。
"""
import sys

import secrets

# 去掉了易混字符（0/O、1/I/L、8/B），家长照着念/抄给亲友不会错。
_字母表 = "ACDEFGHJKMNPQRSTUVWXYZ2345679"
_码长 = 8


def 造一个码() -> str:
    return "".join(secrets.choice(_字母表) for _ in range(_码长))


def main(argv: list[str]) -> int:
    数量 = 10
    if len(argv) > 1:
        try:
            数量 = int(argv[1])
        except ValueError:
            print(f"个数要是整数，收到的是 {argv[1]!r}", file=sys.stderr)
            return 2
    if 数量 < 1:
        print("个数至少 1", file=sys.stderr)
        return 2

    from math_edu.db import create_all, get_session
    from math_edu.models import InviteCode
    from math_edu.verify_state import now_utc

    create_all()  # 幂等：表通常已由 on 模式首启建好，这里兜一手

    session = get_session()
    生成的 = []
    try:
        while len(生成的) < 数量:
            码 = 造一个码()
            # 撞库概率极低，真撞了（唯一约束）就换一个重试
            existing = session.query(InviteCode).filter_by(code=码).one_or_none()
            if existing is not None:
                continue
            session.add(InviteCode(code=码, created_at=now_utc()))
            session.flush()
            生成的.append(码)
        session.commit()
    finally:
        session.close()

    print(f"已生成 {len(生成的)} 个一次性邀请码：\n")
    for 码 in 生成的:
        print(f"  {码}")
    print("\n发给亲友，注册时填在登录页的「邀请码」栏。用一个少一个。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
