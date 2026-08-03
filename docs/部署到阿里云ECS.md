# 部署到阿里云 ECS

2026-07-30 首次部署。线上地址 **https://math.chongliangmango.com**。守门的是账号体系的
登录墙（2026-08-03 起；此前的 HTTP Basic 已摘，见文末「账号体系上线」）。

本站的第一身份仍然是「家长本机跑的离线站」——`uv run uvicorn math_edu.app:app --port 8300`
那条路一个字没变。这份文档只讲第二份副本：同一个仓库 clone 到 ECS，systemd 常驻，nginx 收
HTTPS。没有构建步骤，没有部署脚本，没有容器；「部署」在这里等于 `git pull` + 重启服务。

## 为什么必须是子域，不能是 `www.chongliangmango.com/math`

先记这一条，因为它是唯一一个**改不动**的约束，别人第二次问起时不必重新推导。

前端把三个**根**路径写死了：`/shared/`、`/ch/`、`/api/`。约 60 个文件里写着
`import { 说 } from '/shared/js/说话.js'` 这样的根绝对路径，而这份绝对性是仓库刻意的设计——
`tools/共享路径.mjs` 正是靠它把 `/shared/...` 映射到 `web/shared/...`，`node --test` 才能不打包
直接加载各讲的模块（见 CLAUDE.md「Common commands」）。

于是挂到子路径下只有两条路，都不可接受：

- 改遍那 60 个文件的路径约定，顺带废掉测试钩子；
- 或者让 nginx 在共享域名上把 `/shared/`、`/ch/`、`/api/` 三个根路径也转给本站——等于在
  `www` 的地盘上圈三块地，与同机的 `deposit-monitor` 埋下随时可能撞车的雷。

子域是唯一零改动又不留雷的解。**以后再有「挂到某个路径下」的需求，答案是再开一个子域。**

## 机器上的拓扑

一台 ECS（`<ECS_IP>`）上跑着两个互不相干的站：

| | deposit-monitor | math_edu |
|---|---|---|
| 域名 | `chongliangmango.com` / `www` | `math.chongliangmango.com` |
| 端口 | 8000（gunicorn） | 8300（uvicorn） |
| service | `wechat-web.service` | `math-edu.service` |
| nginx 配置 | 写在 `nginx.conf` 里 | 独立文件 `conf.d/math-edu.conf` |

本站的配置**全部**收在自己那个文件里，`nginx.conf` 一行没动——两个站的故障域因此是分开的。

## 部署步骤

### 1. 拉代码、装依赖

```bash
git clone <repo> /home/admin/Projects/math_edu
```

装依赖前先解决 Python 版本（见「坑一」）：

```bash
cd /home/admin/Projects/math_edu && uv sync --python ~/.pyenv/versions/3.12.2/bin/python3.12
```

### 2. 写 `.env`

`.env` 是 gitignored 的，clone 不会带过来，必须手工建：

```bash
cp .env.example .env
```

只有 `DASHSCOPE_API_KEY` 是必填的，其余每一项 `settings.py` 都有与 `.env.example` 一致的默认
值，整段删掉也能跑。填完用 `/api/health` 的 `key_set` 字段验（见「坑二」）。

### 3. systemd

```bash
sudo tee /etc/systemd/system/math-edu.service >/dev/null <<'EOF'
[Unit]
Description=Math Edu Site
After=network.target

[Service]
Type=simple
User=admin
Group=admin
WorkingDirectory=/home/admin/Projects/math_edu
ExecStart=/home/admin/Projects/math_edu/.venv/bin/uvicorn math_edu.app:app --host 127.0.0.1 --port 8300
Restart=always
RestartSec=5

# 密钥走仓库根的 .env（settings.py import 时读），不用 Environment= 注入
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/admin/Projects/math_edu/var
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
```

`--host 127.0.0.1`：只给 nginx 用，不直接对公网。

启动前**必须先手工建出缓存目录**（见「坑三」）：

```bash
mkdir -p /home/admin/Projects/math_edu/var/cache/tts && sudo systemctl daemon-reload && sudo systemctl enable --now math-edu
```

```bash
curl -s localhost:8300/api/health
```

### 4. DNS

阿里云 DNS 控制台 → `chongliangmango.com` → 解析设置 → 添加记录：A 记录，主机记录 `math`，
记录值填 ECS 公网 IP（与现有 `www`/`@` 同值），TTL 默认 10 分钟。

在 **ECS 上**验，不要在本机验（见「坑四」）：

```bash
getent hosts math.chongliangmango.com
```

### 5. 证书

先放一个只有 80 的临时 server 块，给 ACME 校验留门：

```bash
sudo mkdir -p /var/www/acme && sudo tee /etc/nginx/conf.d/math-edu.conf >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name math.chongliangmango.com;
    location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://$host$request_uri; }
}
EOF
sudo nginx -t && sudo systemctl reload nginx
```

确认安全组放行了 **80**（HTTP-01 只走 80），然后装 acme.sh 并签。注意 acme.sh 拒绝在 `sudo`
下运行（见「坑五」），要给它干净的 root 环境：

```bash
curl https://get.acme.sh | sudo sh -s email=<你的邮箱>
```

```bash
sudo su - -c '/root/.acme.sh/acme.sh --issue -d math.chongliangmango.com --webroot /var/www/acme --server letsencrypt && /root/.acme.sh/acme.sh --install-cert -d math.chongliangmango.com --key-file /etc/ssl/certs/math.chongliangmango.com.key --fullchain-file /etc/ssl/certs/math.chongliangmango.com.pem --reloadcmd "systemctl reload nginx"'
```

`--install-cert` 会把续期钩子一并挂上：到期前自动重签、自动 `systemctl reload nginx`，无人值守。
签出来的是 **ECDSA (ECC)** 证书，这一点影响下一步的 `ssl_ciphers`（见「坑六」）。

### 6. Basic 口令（历史步骤——2026-08-03 已摘，见文末；重装新机时本节跳过）

首次部署时线上站没有账号体系，`/api/tts` 谁都能调，被扫到就是真金白银的百炼账单。整个 vhost 用 HTTP
Basic 挡住：

```bash
sudo dnf install -y httpd-tools && sudo htpasswd -c /etc/nginx/.htpasswd-math fangfang
```

（交互式输入密码，不进 shell 历史。家长在浏览器上输一次记住，孩子端无感——语音、录音、图片
这些子请求浏览器会自动带凭据，不会二次弹窗。）

### 7. 完整 nginx 配置

```bash
sudo tee /etc/nginx/conf.d/math-edu.conf >/dev/null <<'EOF'
# math.chongliangmango.com —— 大班数学配套网站，反代 127.0.0.1:8300
server {
    listen 80;
    listen [::]:80;
    server_name math.chongliangmango.com;

    # acme.sh 自动续期走这里，别删（删了 60 天后静默失效）
    location ^~ /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen       443 ssl http2;
    listen       [::]:443 ssl http2;
    server_name  math.chongliangmango.com;

    ssl_certificate     /etc/ssl/certs/math.chongliangmango.com.pem;
    ssl_certificate_key /etc/ssl/certs/math.chongliangmango.com.key;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000" always;

    # 站点无账号体系，靠这道门挡住白嫖 /api/tts 烧百炼 Key 的
    auth_basic           "math";
    auth_basic_user_file /etc/nginx/.htpasswd-math;

    # 孩子的录音走 multipart 传到 /api/asr
    client_max_body_size 25M;

    # 文本资源压缩。gzip_proxied 必须给——本站一切都走下面的 proxy_pass，
    # nginx 默认「不压缩代理来的响应」，不写这行 gzip 配了也不生效。
    # PNG/WebP/mp3 本就是压缩格式，不列进 gzip_types（text/html 隐式已在）。
    gzip            on;
    gzip_proxied    any;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_vary       on;
    gzip_types      text/css application/javascript text/javascript application/json image/svg+xml;

    location / {
        proxy_pass         http://127.0.0.1:8300;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # TTS 合成和判对是同步调百炼，慢的时候几秒起步
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
sudo nginx -t && sudo systemctl reload nginx
```

`auth_basic` 放在 server 层，`/`、`/ch/`、`/shared/`、`/api/*` 全在门内；80 那块没加，不影响续期。
没抄父域配置里的 `Upgrade`/`Connection "upgrade"` 两行——本站不用 WebSocket 也不用 SSE，音频
是普通 GET mp3，加了只会给 keepalive 添乱。

### 8. 验收

```bash
curl -i https://math.chongliangmango.com/api/health --resolve math.chongliangmango.com:443:127.0.0.1
```

`--resolve` 把域名指到回环，证书、`server_name` 匹配、`proxy_pass` 全都真跑一遍，只是不过安全组。
加了 Basic 之后这条应当回 **401**；想看 200 就带上 `-u fangfang`。

最后用浏览器开 `https://math.chongliangmango.com/`，进第 3 讲点麦克风。**权限框弹出来才算验完**
——`getUserMedia` 只在 secure context 下工作，这是当初非上 HTTPS 不可的唯一原因。

## 踩过的坑

按第一次部署时实际撞上的顺序记。每一条都花了时间，别人不该再花第二遍。

### 一、`uv sync` 无视 pyenv，自己下了个 Python 3.14

**症状**：`uv sync` 开始下载 `cpython-3.14.4-linux-x86_64-gnu`，而机器上 pyenv 明明装着 3.12.2。

**原因**：uv 只认 PATH 上**能真正跑起来**的解释器。pyenv 当时 `global` 是 `system`，
`~/.pyenv/shims/python3.12` 这个垫片被 uv 试运行时会报 "command not found for this version"
而被跳过；系统自带的 python 又不满足 `requires-python = ">=3.11"`。找不到合规解释器，uv 就按
默认行为下载一个自管的最新版。仓库里没有 `.python-version`，没人替它做过选择。

**解**：指到 pyenv 的真实二进制，绕开垫片：`uv sync --python ~/.pyenv/versions/3.12.2/bin/python3.12`。
想彻底禁掉「找不到就偷偷下载」，`export UV_PYTHON_DOWNLOADS=never`，它会改成直接报错。
（3.12 也比刚发布的 3.14 稳妥：新版本上 dashscope 这类库偶尔缺预编译 wheel，会退化成本地编译。）

### 二、`.env` 里混进中文，Key 被静默当成没配

`settings.py` 用 `API_KEY.isascii()` 判断「还是占位符」——只要 Key 那行残留任何非 ASCII 字符
（比如 `sk-你的key填这里` 没删干净），就静默视为未配置，`/api/tts` 返 503，前端悄悄退回 Web
Speech API。不报错，只是童声没了。

**解**：`curl -s localhost:8300/api/health` 看 `key_set` 字段，`true` 才算数。

### 三、`ProtectSystem=strict` 撞上 import 时的 mkdir

`settings.py` 在 **import 时**就 `CACHE_DIR.mkdir(parents=True)`。而 `ProtectSystem=strict` 之下
整个文件系统只读，只有 `ReadWritePaths` 例外。`var/` 若不存在，mkdir 得先在**仓库根目录**这一层
创建它——那层不在白名单里，进程启动即崩。

**解**：首次启动前 `mkdir -p <repo>/var/cache/tts`。（另一条路是把仓库根加进 `ReadWritePaths`，
但那等于把整个仓库开成可写，不划算。）

### 四、Mac 上 `dig` 返回 `198.18.x.x`，那不是你的服务器

**症状**：`dig +short math.chongliangmango.com` 回一个 `198.18.1.231` 之类的地址。

**原因**：`198.18.0.0/15` 是 RFC 2544 保留的测试网段，Clash / Surge 这类代理的 **fake-IP 模式**
专门拿它伪造 DNS 响应。本机的 dig 根本没出网，查什么域名都得到这个段里的地址，哪怕域名不存在。

**解**：真正要用这条记录的是 Let's Encrypt 和那台 ECS，所以**在 ECS 上验**。ECS 上通常没装
`dig`（`sudo dnf install -y bind-utils` 可补），`getent hosts <域名>` 零依赖、走系统解析器，够用。

### 五、acme.sh 拒绝在 `sudo` 下运行

**症状**：`sudo acme.sh --issue ...` 只吐一句「It seems that you are using sudo, please read this
page first」就退出。

**原因**：它靠 `SUDO_UID`/`SUDO_GID` 判断，怕把证书文件属主搞成普通用户，导致将来自动续期时
写不进去——是保护，不是刁难。

**解**：给它干净的 root 环境。`sudo su - -c '...'`（`su -` 是登录 shell，会重建环境、丢掉
`SUDO_*`），或者 `sudo -i` 进 root shell 后不带 sudo 地跑。

### 六、签出来的是 ECC 证书，父域那串 `ssl_ciphers` 不该照抄

父域配置里那串以 `ECDHE-RSA-AES128-GCM-SHA256` 打头的 cipher list 是 **RSA 专用**套件；acme.sh
默认签的是 ECDSA 证书，对不上。后面的 `ECDHE`/`ECDH` 泛项其实能兜住，所以「能跑」，但留着是
误导。nginx 默认套件本来就正确处理 ECDSA，TLS 1.3 更是完全忽略这行——**删掉比留着干净**。

### 七、最坑的一个：临时配置没换成完整配置，然后污染了浏览器

**症状**：`curl -s https://...` 返回**空**（`-s` 把错误一起吞了）。去掉 `-s` 才看到是 TLS 失败。

**原因**：第 5 步那个只有 80 的临时配置还没换成第 7 步的完整版，443 上就没有 `math` 的 server
块，请求落到 `nginx.conf` 里父域那个默认块，握手时递出的是 `chongliangmango.com` 的证书，域名
对不上。

**真正的坑在后面**：这段时间里如果你用浏览器访问过、并且点了「高级 → 继续前往」，Chrome 会按
origin 记住这个决定。此后哪怕证书早已修好，站点仍被判为 **broken HTTPS**，Security 面板写着
`active content with certificate errors — You have recently **allowed** content loaded with
certificate errors`。证书那栏是绿的，连接那栏也是绿的，只有这一栏红着，非常迷惑。

**解**：清掉那条本地例外——关掉该站所有标签页，`Cmd+Q` 彻底退出 Chrome（关窗口不算）再打开；
仍在的话去 `chrome://settings/content/all` 搜域名、删除数据（会连麦克风授权一起清掉，重新授权
即可）。诊断技巧：**开无痕窗口**。全新配置没有那条记录，如果无痕里是干净的，就证明服务器没问题。

**教训**：`nginx -T | grep -c "server_name  *math.chongliangmango.com"` 应当回 `2`（80 和 443 各
一个）；回 `1` 就是还停在临时版本。以及诊断 TLS 时别用 `curl -s`。

### 八、加了本站的配置文件之后，443 的 default_server 变了

`nginx.conf` 里 `include /etc/nginx/conf.d/*.conf;` 写在两个 server 块**前面**，而 nginx 把某个
监听端口上第一个定义的 server 块当作 default_server。所以本站的块现在是 443 的默认块：凡是
Host/SNI 对不上任何 `server_name` 的请求（拿 IP 直接访问、乱猜的子域）会落到这里，拿到 math 的
证书并被 Basic 挡住，而不是落到父域。

`www` 和裸域是精确匹配，**不受影响**。这个副作用目前是留着的——陌生 Host 得到 401 比得到主站
更干净。真想恢复原样，就给 `nginx.conf` 那两个块的 `listen` 各加 `default_server`，代价是要动
那个我们一直刻意没碰的文件。

## 日常运维

**发版**（在 Mac 上开发、push 之后）：

```bash
cd /home/admin/Projects/math_edu && git pull && sudo systemctl restart math-edu
```

依赖有变动才需要在中间补一次 `uv sync`。前端改动不需要重启——`StaticFiles` 直接读磁盘。加了
**新的一讲**才必须重启：`_discover_chapters()` 只在启动时扫一次 `chapters/`。

**缓存分流（`CACHE_PROFILE`）**：`app.py` 的中间件（`apply_cache_profile`）按 `.env` 里的
`CACHE_PROFILE` 给静态响应盖 `Cache-Control`。**过去它无条件盖 `no-cache`；现在不是了。**
公网上必须让 `.env` 里有 `CACHE_PROFILE=public`——否则会退回本机开发那套 `no-cache`，暖缓存
打开一讲就又变成几十个 304 空校验（本次提速的原始病根）。分层：

- `public`：实体图（`/shared/assets/实体图/`）与 vendored three（`/shared/vendor/three/`）→
  `max-age=86400, stale-while-revalidate=2592000`（换图最晚隔天到孩子眼前）；其余静态
  JS/CSS/HTML → `max-age=0, stale-while-revalidate=604800`（每次秒开 + 后台校验，发版下次打开
  生效，不用教孩子「强制刷新」）。
- `dev`（缺省，不配置即是）：一切静态 `no-cache`——本机开发「改完刷新就见新」，一字未动。
- 两种 profile 都用 `setdefault` 盖章，`/api/tts` 自设的一年缓存（`max-age=31536000`）继续胜出。

改缓存行为是 `.env` 编辑（`CACHE_PROFILE=public`），不是代码改动，改完 `restart` 即生效。

在 ECS 上直接对 `localhost:8300` 验（绕过 nginx 与 Basic，只看应用自己盖的头），起两次进程各验
一次。**dev**（缺省）——一切静态 `no-cache`，`/api/tts` 仍一年：

```bash
CACHE_PROFILE=dev  .venv/bin/uvicorn math_edu.app:app --port 8399   # 另开一个终端
curl -sI localhost:8399/shared/js/说话.js                    | grep -i '^cache-control'  # no-cache
curl -sI localhost:8399/shared/assets/实体图/白菜.png         | grep -i '^cache-control'  # no-cache
curl -sI localhost:8399/shared/vendor/three/three.module.js  | grep -i '^cache-control'  # no-cache
# /api/tts 是 GET-only（HEAD 会 405），要用 GET 抓头；text 挑一句已缓存的，避免真的去合成花钱
curl -s -G -D - -o /dev/null localhost:8399/api/tts --data-urlencode 'text=看看亮亮的旁边那一格是什么！' \
  | grep -i '^cache-control'   # max-age=31536000（中间件的 setdefault 不夺权）
```

**public**（ECS 上的实际取值）——实体图与 three 一天 + SWR，其余静态 `max-age=0` + SWR，
`/api/tts` 仍一年：

```bash
CACHE_PROFILE=public  .venv/bin/uvicorn math_edu.app:app --port 8399
curl -sI localhost:8399/shared/assets/实体图/白菜.png         | grep -i '^cache-control'  # max-age=86400, stale-while-revalidate=2592000
curl -sI localhost:8399/shared/vendor/three/three.module.js  | grep -i '^cache-control'  # max-age=86400, stale-while-revalidate=2592000
curl -sI localhost:8399/shared/js/说话.js                    | grep -i '^cache-control'  # max-age=0, stale-while-revalidate=604800
curl -s -G -D - -o /dev/null localhost:8399/api/tts --data-urlencode 'text=看看亮亮的旁边那一格是什么！' \
  | grep -i '^cache-control'   # max-age=31536000（一年缓存继续赢）
```

（本机 Mac 上同样能验，把 `.venv/bin/uvicorn` 换成 `uv run uvicorn` 即可。`/api/tts` 想看到
200 需要真实 Key，且 `text` 要挑一句磁盘上已缓存的；占位 Key 会返 503，那时 `Cache-Control`
由中间件盖，验不到那把一年缓存——但 `api/tts.py` 的头只在 200 的 `FileResponse` 上设，代码可
直接核对它未被中间件覆盖。）

**给已上线的服务器开 gzip**（第 7 步的配置块现在已含 gzip；服务器若还是旧版配置，
重跑那段 `tee` 覆盖写回、`nginx -t` 通过再 `reload` 即可，无别的动作）：

```bash
# ① 确认现网配置有没有 gzip；没有就重跑第 7 步的完整 tee 块（它幂等，整段覆盖）
grep -q 'gzip .*on' /etc/nginx/conf.d/math-edu.conf && echo '已有 gzip' || echo '缺 gzip：重跑第 7 步的 tee 块'
sudo nginx -t && sudo systemctl reload nginx

# ② 验证：文本资源应带 content-encoding: gzip，图片/音频不带
curl -s -H 'Accept-Encoding: gzip' -o /dev/null -D - -u <用户名>:<口令> \
  https://math.chongliangmango.com/shared/vendor/three/three.module.js | grep -i '^content-encoding'   # gzip
curl -s -H 'Accept-Encoding: gzip' -o /dev/null -D - -u <用户名>:<口令> \
  https://math.chongliangmango.com/shared/assets/实体图/白菜.webp | grep -i '^content-encoding'          # 无（WebP 本就压缩过）
```

为什么只压文本：JS/CSS/HTML/JSON/SVG 是文本，gzip 能砍掉约 2/3（1.27MB 的 `three.module.js`
压到 ~330KB）；PNG/WebP/mp3 已经是压缩格式，再 gzip 只费 CPU 不省字节，故不列进 `gzip_types`。
`gzip_proxied any` 是命门：本站一切都走 `proxy_pass`，不写这行 nginx 不压缩代理响应，gzip 形同虚设。

**看日志**：

```bash
sudo journalctl -u math-edu -f
```

**证书**：无人值守，不用管。想确认续期计划还在：

```bash
sudo su - -c '/root/.acme.sh/acme.sh --list'
```

首张证书 2026-10-27 到期，acme.sh 按 ARI 把续期排在 2026-09-28。

**改 Basic 口令 / 加人**（`-c` 会**清空重建**文件，加人时千万别带）：

```bash
sudo htpasswd /etc/nginx/.htpasswd-math <用户名>
```

## 安全边界

- 守门的是**账号体系的登录墙**（`AUTH_MODE=on`），不再是 Basic（2026-08 起，Basic 是 07 首部署
  的临时门，正在退场 —— 见文末「账号体系上线」）。不管哪道门，规矩不变：把某条路径放到门外时，
  `/api/*` 必须留在门内——那才是花钱的地方。登录墙的白名单只有 `/login`、`/api/auth/*`、
  `/api/health`、`/favicon.ico`（浏览器自发请求，拦它只会在登录页刷 401 噪音）。
- `.env` 只在服务器本地，永不入库。`data/`（教材扫描件，有版权）同样不入库，也**不需要**同步到
  服务器——站点运行完全用不到它。
- `var/cache/tts/` 是合成好的 mp3 磁盘缓存，同一句话只计费一次。它是纯派生数据，删了会重新
  合成（重新花钱），不必备份。

## 账号体系上线与 Basic Auth 退场（2026-08）

设计与决策见 `.scratch/accounts/`，行为见 CLAUDE.md「Account system」。核心：`AUTH_MODE=on` 时整站
上锁（未登录 页面302→`/login`、`/api/*`→401，白名单只有 `/login`、`/api/auth/*`、`/api/health`、`/favicon.ico`）。
**顺序是刻意的 —— Basic 最后摘，不是最先摘。** 两道门套着自测通过，才摘 Basic。

### 1. 补 `.env`（服务器本地那份，永不入库）

```bash
# 在 /home/admin/Projects/math_edu/.env 追加（值按本机 .env / 凭据来源填）
AUTH_MODE=on
DATABASE_URL=postgresql+psycopg://用户:密码@主机:5432/math_edu   # 密码含特殊字符要 URL 编码（@→%40）
SESSION_SECRET=<python3 -c "import secrets;print(secrets.token_urlsafe(32))">
ALIYUN_CAPTCHA_APP_ID=...
ALIYUN_CAPTCHA_APP_KEY=...
ALIBABA_CLOUD_ACCESS_KEY_ID=...
ALIBABA_CLOUD_ACCESS_KEY_SECRET=...
SMS_SIGN_NAME=速通互联验证码
SMS_TEMPLATE_CODE=100001
```

`CACHE_PROFILE` 保持 `public`（这样会话 cookie 走 `__Host-`+Secure）。**缺任一凭据 → 进程启动
即报错**（点名缺哪个），这是防呆不是 bug：宁可起不来，也不放一个谁都登不进还不报错的残站。

`uv sync` 装齐新依赖（sqlalchemy / psycopg / alibabacloud_* / itsdangerous / httpx，已在 lock 里）。

### 2. 建表 + 邀请码

首次以 `AUTH_MODE=on` 启动会自动 `create_all` 建五张表。邀请码本机已生成 10 个存进同一个库
（`tools/生成邀请码.py`）；要再加就在服务器上 `uv run python tools/生成邀请码.py N`。

### 3. 重启服务，**Basic 先不动**，两道门套着自测

```bash
sudo systemctl restart math-edu.service
sudo systemctl status math-edu.service   # 起不来就是 .env 缺凭据，看日志点名
```

此刻 nginx 的 Basic 仍在最外层。带 `-u fangfang` 过 Basic 后，验登录墙自己（在 ECS 上直接打
`localhost:8300` 绕过 nginx/Basic，只看应用）：

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:8300/            # 未登录 → 302
curl -s -o /dev/null -w '%{http_code}\n' localhost:8300/api/tts -X POST  # → 401
curl -s localhost:8300/api/auth/me                                  # → {"auth":"on"...}401 形状
curl -s -o /dev/null -w '%{http_code}\n' localhost:8300/login         # → 200
```

然后**用真手机走一遍**（这步只能人肉）：浏览器开 `https://math.chongliangmango.com/login`（先过
Basic）→ 图形验证 → 收短信 → 老号登录 / 新号填一个邀请码注册 → 进站上课 → 双设备各攒星星、
焦点切回看是否互通、一台重来另一台是否跟着清。**这一整套通过，才做下一步。**

### 4. 摘 Basic（验证通过后才做）

编辑 `/etc/nginx/conf.d/math-edu.conf`，删掉 443 server 块里这两行：

```nginx
    auth_basic           "math";
    auth_basic_user_file /etc/nginx/.htpasswd-math;
```

`/.well-known/acme-challenge/`（80 块里那条）**别动** —— 删了 60 天后证书静默续不上。然后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

复验：不带 `-u` 直接访问，未登录整站应 302/401，登录后一切照旧；`/.well-known/acme-challenge/`
路径仍可达（`sudo su - -c '/root/.acme.sh/acme.sh --list'` 确认续期计划还在）。

### 5. 摘门后盯一两天

看 nginx 访问日志确认没有陌生流量打穿 `/api/*`（都应是 401 或 302，除非带着有效会话）。真出问题
可随时把那两行 `auth_basic` 加回去 reload，Basic 的 `.htpasswd-math` 文件还在，一分钟回退。
