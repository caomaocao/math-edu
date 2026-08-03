#!/usr/bin/env bash
# 发布快照到公开仓（GitHub caomaocao/math-edu）。
#
# 做什么：git archive 私仓当前 HEAD → 剔除 .scratch/ → 全量镜像进公开仓工作区
# →（有改动才）落一个提交（信息带私仓短 hash 便于对账）→ 有 origin 就推。
# 首跑会初始化公开仓（独立 .git，与私仓互不为 remote——「无历史」由此保证）。
#
# 不做什么：任何内容替换。去品牌与脱敏在私仓一次性完成并有红线测试压着
# （见 .scratch/open-source/issues/00-spec.md），本脚本只剔目录；
# 未提交的工作区改动天然不进快照（archive 只看 HEAD）。
#
# 用法（私仓任意位置）:  bash tools/发布快照.sh
# 公开仓目录缺省为私仓旁的 ../math-edu-public，环境变量 PUB_DIR 可覆盖。

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
PUB_DIR=${PUB_DIR:-$(dirname "$REPO_ROOT")/math-edu-public}

# 护栏：公开仓里也躺着本脚本的一份导出副本，从那儿跑会把公开仓当私仓自己同步
# 自己（静默 no-op）。认私仓的办法：只有私仓有 .scratch/。
if [ "$REPO_ROOT" = "$PUB_DIR" ] || [ ! -d "$REPO_ROOT/.scratch" ]; then
  echo "中止：请从私仓跑本脚本（当前 $REPO_ROOT 不是私仓）" >&2
  exit 1
fi

TIP=$(git -C "$REPO_ROOT" rev-parse --short HEAD)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 1. 导出 HEAD（只含入库文件），剔除 .scratch/
git -C "$REPO_ROOT" archive HEAD | tar -x -C "$TMP"
rm -rf "$TMP/.scratch"

# 2. 安全网：这些名字出现在导出树里即中止（gitignore 本就该挡住，双保险）
for banned in .env data var .scratch; do
  if [ -e "$TMP/$banned" ]; then
    echo "中止：导出树里出现 $banned，先查 .gitignore 再发布" >&2
    exit 1
  fi
done

# 3. 首跑初始化公开仓；之后每跑全量镜像（保留 .git，其余以导出树为准）
if [ ! -d "$PUB_DIR/.git" ]; then
  mkdir -p "$PUB_DIR"
  git -C "$PUB_DIR" init -b main
  git -C "$PUB_DIR" config user.name "二毛"
  git -C "$PUB_DIR" config user.email "caomaocao111@gmail.com"
  echo "已初始化公开仓：$PUB_DIR"
fi
rsync -a --delete --exclude '.git' "$TMP"/ "$PUB_DIR"/

# 4. 有改动才落提交（幂等：私仓没动，重跑不产生空提交）
git -C "$PUB_DIR" add -A
if git -C "$PUB_DIR" diff --cached --quiet; then
  echo "无改动：公开仓已与私仓 tip $TIP 一致"
else
  git -C "$PUB_DIR" commit -m "同步自私仓 $TIP"
  echo "已落提交：同步自私仓 $TIP"
fi

# 5. 有 origin 就推；没有就提示（首发建仓用 gh repo create，见票 03）
if git -C "$PUB_DIR" remote get-url origin >/dev/null 2>&1; then
  git -C "$PUB_DIR" push origin main
else
  echo "提示：公开仓尚无 origin。建好 GitHub 仓后："
  echo "  git -C \"$PUB_DIR\" remote add origin git@github.com:caomaocao/math-edu.git"
  echo "  git -C \"$PUB_DIR\" push -u origin main"
fi
