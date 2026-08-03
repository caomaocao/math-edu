// 让 `node --test` 像网站一样认识 `/shared/...`。
//
// 浏览器里 FastAPI 把 web/shared/ 挂在 /shared/ 上，所以章节代码一律写
// `import ... from '/shared/js/说话.js'`。node 不知道这回事，会拿这个绝对路径
// 去文件系统根目录找。这个钩子补上那一层映射，一句话的事：
//
//     /shared/<任何东西>  →  <仓库根>/web/shared/<任何东西>
//
// 这样同一份源码在浏览器和 node --test 里走的是同一个路径，
// 章节不用为了测试而把 import 写成测试才懂的样子。
//
// 用法在根 package.json 的 test 脚本里：node --import ./tools/共享路径.mjs --test ...

import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const 仓库根 = dirname(dirname(fileURLToPath(import.meta.url)));
const 前缀 = '/shared/';

registerHooks({
  resolve(说明符, 上下文, 下一个) {
    if (说明符.startsWith(前缀)) {
      const 真身 = join(仓库根, 'web', 说明符.slice(1));
      return 下一个(pathToFileURL(真身).href, 上下文);
    }
    return 下一个(说明符, 上下文);
  },
});
