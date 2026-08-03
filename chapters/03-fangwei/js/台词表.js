import { 生活对地图, 地图对生活 } from '/shared/js/罗盘.js';
import { 问答台词表 } from '/shared/js/问答.js';
import { 当前语言 } from '/shared/js/语言.js';
import { 方位说, 方位牌 } from './方位词.js';

/**
 * 台词表 —— 第3讲里说给孩子听的每一句话，两门课各一份。
 *
 * 为什么要有这张表：孩子不认字，屏幕上一个句子都没有（要学的那几个字除外），
 * 那把嘴就是全部的说明书。而每一句话第一次说出来都要现合成（DashScope TTS 一趟网络），
 * 孩子听见的是几秒安静。这张表存在的**主要目的**是让开场之后的补预热
 * （`说话.js` 的 `备话(供话)`）把它们灌进后端的磁盘缓存（`var/cache/tts/`），
 * 之后每一句都是从盘上直接读出来的。
 *
 * 四条规矩（前三条和第2讲 `chapters/02-cube-fold/src/data/台词表.js` 同一套）：
 *
 * 1. **句子写在这儿，界面那边只挑不写。** 14 个环节模块和 `主.js` 都从这儿 import，
 *    没有第二处字面量。改一句话只改这个文件。连题库里的题面（蔬菜格子的六道题、
 *    衣柜的八条指令）也是那些数组从这张表里挑，不是自己写一份。
 * 2. **带变量的句子收模板，不收成品。** 「把香蕉放在第1行、第1列！」这种，
 *    变量要到孩子玩到那一步（或那一题抽到谁）才知道，它们以函数的形式住在 `模板` 里。
 * 3. **预热是后台的事。** 分小批、隔一会儿发一批，绝不在开场那一下把上百个 fetch
 *    一起摔出去 —— 浏览器对同一个域名只开六条连接，一次全发，开场那一句就得排在
 *    几十个预热请求后面，本末倒置。分批那套账现在归 `说话.js` 的 `备话(供话)`
 *    （它还多做一件这儿做不到的事：换语言时用新语言再备一遍），
 *    这张表只负责「给出某一门课要说的全部句子」。
 * 4. **两张表键完全同构。** 中文课和英文课是同一门课的两张皮：同一套键、两张表。
 *    漏译不是「孩子听见一句中文」，而是测试直接红（`test/台词表.test.js` 逐键比对）。
 *    `台词` / `模板` 这两个导出是**按当前语言取值的合并视图** —— 界面照旧写
 *    `话.开场`、`模.问(名)`，一个调用点都不用管现在上的是哪门课。
 *
 * 模板参数的规矩（两张表的函数签名必须一样，所以这条也是接口的一部分）：
 *   · **方位一律收中文规范名**（`上面` / `东北` / `右上`），模板自己按语言念出来。
 *     规范名是判对.js 与罗盘.js 的通用货币，界面手上本来就是它，不必先翻译再递进来。
 *   · **本讲的数据名**（动物、食物、地点、水果、小朋友、地标）**收已经挑好语言的词**。
 *     它们长在各环节模块的题库里，这张表不认识它们。英文一律写成**光杆名词**
 *     （bird / bakery / palm tree），冠词由英文句子自己加 —— 中文句子不需要冠词，
 *     把 "the" 塞进数据里两边就对不齐了。
 *
 * **这一讲的模板句几乎都不展开成成品**，只有魔法罗盘那一摊例外。第2讲能把闯关三的
 * 题面展开备上，是因为它的题库和台词表住在同一个 `src/data/` 里；这一讲的题库
 * （班底、链B、题们、要摆……）长在 14 个环节模块内部，而环节是**孩子点进去才 dynamic
 * import 的**（`主.js` 的 `打开()`）—— 为了展开题面把 14 个模块（拍照那个还拖着
 * three.js）在开场全拉进来，代价远超省下的那一两秒。魔法罗盘是例外：它念的
 * 「上 / 右上 / 北 / 东北……」全部来自共享的 `罗盘.js`（纯逻辑、本来就在内存里），
 * 而且孩子一轮要听十几遍，值得备。
 *
 * 不在这张表里的（说明书归说明书，这儿只管那把嘴）：
 *   - 14 个环节的名字（`环节表.js` 是它们的出处，鼠标划过地图节点念的就是它，
 *     双语也补在那儿）；由 `全部台词()` 的入参接进来。
 *   - 共享问答流程自己的三摊（表扬 / 鼓励 / 没听清）：出处是 `/shared/js/问答.js`，
 *     这儿只把它们捎进预热单子，不抄一份。
 *   - 递给判对模型的 `上下文`（「八大方位：北、东北……」那种）：那不是说给孩子的话。
 */

// 「往北走」念给五岁小孩听，得先翻成他手上的方向。
// 直接查罗盘的那张表，别在这儿重排一遍：自己写三元级联的话，四个斜方位
// （东北/东南/西北/西南）会一路掉进最后那个 else，全被念成「右边」。
const 中生活说法 = (方) => 地图对生活[方];
const 英生活说法 = (方) => 方位说[地图对生活[方]].en;

/** 这个方位在英文课里怎么念（north / upper right / up …） */
const 英说 = (方) => 方位说[方]?.en ?? 方;
/** 这个方位在英文课里印在屏幕上的样子（NORTH / UP …）—— 提到「那个字」时用它 */
const 英牌 = (方) => 方位牌[方]?.en ?? 方;

/**
 * 六方位当介词短语用的说法：「在盒子的上面」是 above the box，不是 up the box。
 * 单说那个词（跟我念一遍）时仍旧用 `英说()` 给的光杆单词 —— 要学的是 up，不是 above。
 */
const 英贴 = {
  上面: 'above', 下面: 'below', 前面: 'in front of', 后面: 'behind',
  左边: 'to the left of', 右边: 'to the right of',
};

const 格数 = (数) => (数 === 1 ? '1 square' : `${数} squares`);

/**
 * 三样宝贝各自怎么念。键是**具名键**（`环节/宝藏.js` 的 `宝物们` 用同一套键，
 * 那儿有一条测试两边对账），不是 💰💎👑 那三个字形 —— 从前这两句是
 * `宝 === '💰' ? … : 宝 === '💎' ? …` 一路串下来的，换一张图就会静默念错，
 * 而且最后那个 else 兜住一切，连红测试都不会有。
 */
const 中宝物名 = Object.freeze({ 金币: '金币', 钻石: '大钻石', 皇冠: '国王的皇冠' });
const 英宝物名 = Object.freeze({ 金币: 'gold coins', 钻石: 'a big diamond', 皇冠: "the king's crown" });

// ---------------------------------------------------------------------------
// 台词 —— 没有变量的整句
// ---------------------------------------------------------------------------

const 中台词 = {
  /** 不属于哪一个环节的：地图、星星、重来 */
  全站: {
    /** 点过 ▶ 之后听见的第一句（第一次来） */
    开场白: '欢迎来到空间方位大冒险！点一个圆圈，我们开始玩吧！',
    /** 攒过星星再回来 */
    欢迎回来: '欢迎回来！继续我们的冒险吧！',
    得星: '太棒了，你得到一颗星星！',
    大庆祝: '哇！十四颗星星全部集齐！你是空间方位大冒险的冠军！',
    /** 某个环节模块加载失败时的兜底 —— 孩子不该点进去一片空白 */
    还在施工: '这一关还在施工，先玩别的吧！',
    // 左下角「重来」的两击确认
    重来问: '要把星星全部清空，重新开始吗？',
    重来了: '好啦，我们从头开始！',
  },

  导读: {
    开场: '小探险家，欢迎出发！今天我们要学一个大本领，叫做——空间方位！',
    六个方向: '什么是方位呢？就是东西在哪儿：上面、下面、前面、后面、左边、右边！',
    四个大方向: '地图上还有四个大方向：东、南、西、北！跟我念口诀：上北下南，左西右东！',
    学了有什么用: '学会了方位，你就能看地图、挖宝藏、还能当小司机！',
    去下一关: '回到地图，点礼物盒，我们去见第一群小伙伴吧！',
  },

  玩偶方位: {
    开场: '看！小伙伴们围着一个大礼物盒。听我问，你来说！',
    /** 答不上来时，把那一位在盒子边的样子描一遍 —— 键是六个方位 */
    提示话: {
      上面: '看，它坐在盒子的头顶上呢！',
      下面: '它蹲在盒子的底下呢！',
      前面: '它站在盒子前面，把盒子挡住了一点点！',
      后面: '它躲在盒子后面，只露出小脑袋！',
      左边: '在盒子的左边，靠近你的左手这边！',
      右边: '在盒子的右边，靠近你的右手那边！',
    },
    换你摆: '太棒了！现在换你来摆！小伙伴们，先下来休息！',
    收尾: '这一关你全学会啦！点小房子回地图吧！',
  },

  蔬菜格子: {
    开场: '冰箱里放满了好吃的！先看一看：谁在谁的上面，谁在谁的旁边？',
    /** 玩法A 的六道题面（照搬书第 28 页），模块的题库数组从这儿挑 */
    题面: {
      鸡蛋在西红柿的哪一面: '鸡蛋在西红柿的哪一面？',
      西红柿在洋葱的哪一边: '西红柿在洋葱的哪一边？',
      牛奶的下面是什么: '牛奶的下面是什么？',
      豆角的上面是什么: '豆角的上面是什么？',
      鸡蛋的右边是什么: '鸡蛋的右边是什么？',
      胡萝卜在白菜的哪一面: '胡萝卜在白菜的哪一面？',
    },
    提示方位: '顺着亮亮的两样东西看一看，一个在另一个的哪边？',
    提示食物: '看看亮亮的旁边那一格是什么！',
    换玩法: '全部答完啦！现在冰箱空了，你来当管理员，把好吃的放回去！',
    鸡蛋先放好: '鸡蛋已经放好了，在第一层的左边。听好指令哦！',
    格子占着了: '那一格已经有东西啦！',
    放对了: '放对啦！',
    收尾: '冰箱整整齐齐，你是最棒的管理员！点小房子回地图吧！',
  },

  树桩行列: {
    行小课: '森林里的小动物坐得整整齐齐！横着的一条叫一行，从上往下数：',
    列小课: '竖着的一条叫一列，从左往右数：',
    我问你答: '现在我问你答！先说第几行，再说第几列！',
    点名开场: '换个玩法！我喊号，你来点那只小动物！',
    收尾: '行和列你都会数啦！点小房子回地图吧！',
  },

  八大罗盘: {
    开场: '这是一个魔法罗盘！先玩生活罗盘：把八个箭头摆到对的位置！',
    口诀: '真棒！地图上藏着一个口诀：上北下南，左西右东！跟我念：上北、下南、左西、右东！',
    急转弯: '最好玩的来了！指针转到哪儿，你就大声说那是什么方位！',
    问: '指针指到哪个方位啦？',
    /** 单字方位（北南西东）的提示；斜的两字方位另有一句，见 模板 */
    提示单字: '看看它旁边圈圈里的字，念出来！',
    收尾: '八个方位全被你收服啦！点小房子回地图吧！',
  },

  学校地图: {
    // 不点名鼠标：孩子可能拿着手机，屏幕上没有鼠标这样东西。「摸一摸」鼠标和手指都成立。
    开场: '这是学校旁边的小地图！上边是北，下边是南，左边是西，右边是东。先一个一个摸一摸，听听都有什么！',
    /** 摸到正中间那一格（鼠标划过 / 手指按上，走同一个 pointerenter） */
    这是学校: '这是我们的学校！',
    提示方向: '看看它靠近哪个字：上北、下南、左西、右东。斜斜的角要说两个字哦！',
    收尾: '你已经会看地图啦！点小房子回地图吧！',
  },

  衣柜: {
    开场: '妈妈说：衣柜乱糟糟啦！我们一件一件放好。听清楚每一条指令哦！',
    /** 书第 32 页闯关一的八条指令，键是要放的那件东西；模块的任务数组从这儿挑 */
    令们: {
      外套: '把外套挂在挂衣杆的第一个位置！',
      衬衫: '把衬衫挂在外套的右边！',
      毛衣: '把毛衣挂在挂衣杆最后一个位置！',
      礼物盒: '把礼物盒放在柜子的右下角！',
      书包: '把书包放在柜子最上边的格子里！',
      马甲: '把马甲放在帽子的下边！',
      拖鞋: '把拖鞋放在黑皮鞋的左边！',
      靴子: '把靴子放在最下层，从左往右数第三个格子！',
    },
    /** 放错两次之后的提示，键同上 */
    提示们: {
      外套: '挂衣杆最左边的那个钩子就是第一个位置！',
      衬衫: '先找到外套，它右边的空钩子！',
      毛衣: '最后一个位置就是最右边的钩子！',
      礼物盒: '右边那一列最下面的格子，就是右下角！',
      书包: '右边那一列最上面的格子！',
      马甲: '先找到帽子，它下面那一格！',
      拖鞋: '先找到黑皮鞋，它左边那一格！',
      靴子: '在最下面一层，从左边开始数：一、二、三！',
    },
    槽里占着了: '那里已经放了东西啦！',
    放好啦: '放好啦！',
    收尾: '衣柜整整齐齐，妈妈要夸你啦！点小房子回地图吧！',
  },

  货架: {
    开场: '水果店开张啦！帮店长把水果摆上货架。行是横着数的，列是竖着数的！',
    摆好啦: '摆好啦！',
    考考你: '货架满满的！店长还要考考你！',
    收尾: '你是超市里最厉害的小店员！点小房子回地图吧！',
  },

  动物地图: {
    开场: '小动物们住在一个村子里！记住：上边是北，下边是南，左边是西，右边是东。我们去串门吧！',
    收尾: '十家都串完啦，你认路认得真好！点小房子回地图吧！',
  },

  开车: {
    开场: '滴滴！我是小车车，你是我的小司机！大声告诉我往哪儿开：往北、往南、往西、还是往东！',
    /** 一直没出声（多半在发呆），提醒他还有按钮可以点 */
    也能点按钮: '也可以点旁边的方向按钮哦！',
    没听懂: '我没听懂，说「往东走」这样的话，或者点方向按钮！',
    到路口: '到路口啦，接下来往哪边开？',
    收尾: '三趟客人全都送到啦！你是全镇最棒的小司机！点小房子回地图吧！',
  },

  拍照: {
    开场: '小鸭子戴着厨师帽站在桌子中间，四个小朋友围着它拍照！先点一点小朋友，坐到他的位置看看小鸭长什么样！',
    洗出来了: '好啦！照片洗出来了！你来猜猜每张照片是谁拍的！',
    问谁拍的: '这张照片是谁拍的？点一点那个小朋友！',
    错一次: '再看看：照片里小鸭的嘴巴朝哪边？帽子呢？',
    坐过去比一比: '我们坐过去比一比！',
    一样吗: '跟照片一样吗？再选一次！',
    错三次: '是亮亮的那个小朋友拍的！点他！',
    收尾: '每个人看到的小鸭都不一样，你全都分清楚啦！点小房子回地图吧！',
  },

  宝藏: {
    开场: '欢迎来到宝藏岛！我念藏宝图的线索，你顺着走，找到那一格点下去挖！',
    看脚印: '看我的脚印！',
    脚印停在哪儿: '脚印停在哪儿，宝藏就在哪儿！',
    亮亮那一格: '宝藏就在亮亮的那一格！挖吧！',
    收尾: '三件宝贝全部到手！你是最会看藏宝图的小海盗！点小房子回地图吧！',
  },

  记忆: {
    开场: '这是记忆大挑战！小动物们只出来一小会儿，用你的火眼金睛记住谁在大树的哪边！',
    看仔细: '看仔细咯！五、四、三、二、一！',
    新一轮: '新一轮！五、四、三、二、一！',
    收尾: '你的小脑袋瓜记得又快又牢！点小房子回地图吧！',
  },

  Boss: {
    开场: '小龙守住了独木桥！它出六道题，答对一道，桥就亮一块。准备好了吗？冲！',
    题一问: '小鸟在礼物盒的哪一边？',
    题二问: '星星在第几行、第几列？',
    题二提示: '先横着数它在第几行，再竖着数第几列！',
    题三问: '大箭头指着哪个方位？',
    题三提示: '先看它靠近哪个字：上北、下南、左西、右东！斜的要说两个字！',
    题四问: '冰激凌店在城堡的哪个方向？',
    题四提示: '上北下南、左西右东，斜斜的角要说两个字！',
    题六开场: '最后一道！气球只飞三秒，记住它在山的哪边！三、二、一！',
    题六问: '气球刚才在大山的哪一边？',
    通关: '六块桥板全亮啦！小龙心服口服，飞走咯！你就是空间方位小冠军！',
    收尾: '大冒险完成！点小房子回地图，看看你的星星吧！',
  },
};

const 英台词 = {
  全站: {
    开场白: 'Welcome to the big direction adventure! Click a circle and let us start!',
    欢迎回来: 'Welcome back! Let us go on with our adventure!',
    得星: 'Wonderful, you got a star!',
    大庆祝: 'Wow! All fourteen stars! You are the champion of the big direction adventure!',
    还在施工: 'This one is still being built. Let us go and play something else!',
    重来问: 'Do you want to clear all the stars and start over?',
    重来了: 'All right, we start again from the very beginning!',
  },

  导读: {
    开场: 'Little explorer, welcome aboard! Today we learn a big new skill. It is called directions!',
    六个方向: 'What are directions? They tell us where things are: up, down, front, back, left, and right!',
    四个大方向: 'A map has four big directions too: east, south, west, and north! Say the rhyme with me: up is north, down is south, left is west, right is east!',
    学了有什么用: 'Once you know your directions, you can read a map, dig for treasure, and even be a driver!',
    去下一关: 'Go back to the map and click the gift box. Let us meet our first friends!',
  },

  玩偶方位: {
    开场: 'Look! Our friends are standing all around a big gift box. I ask, you answer!',
    提示话: {
      上面: 'Look, it is sitting right on top of the box!',
      下面: 'It is squatting underneath the box!',
      前面: 'It is standing in front of the box, covering a little bit of it!',
      后面: 'It is hiding behind the box. Only its little head is showing!',
      左边: 'On the left of the box, over by your left hand!',
      右边: 'On the right of the box, over by your right hand!',
    },
    换你摆: 'Wonderful! Now it is your turn to put them in place! Friends, come down and have a rest!',
    收尾: 'You learned this one all the way through! Click the little house to go back to the map!',
  },

  蔬菜格子: {
    开场: 'The fridge is full of yummy food! Take a look: who is above who, and who is beside who?',
    题面: {
      鸡蛋在西红柿的哪一面: 'Which side of the tomato is the egg on?',
      西红柿在洋葱的哪一边: 'Which side of the onion is the tomato on?',
      牛奶的下面是什么: 'What is below the milk?',
      豆角的上面是什么: 'What is above the green beans?',
      鸡蛋的右边是什么: 'What is on the right of the egg?',
      胡萝卜在白菜的哪一面: 'Which side of the cabbage is the carrot on?',
    },
    提示方位: 'Follow the two shiny things. Which side of one is the other one on?',
    提示食物: 'Look at the box right next to the shiny one!',
    换玩法: 'All answered! Now the fridge is empty. You be the keeper and put the food back in!',
    鸡蛋先放好: 'The egg is already in place, on the left of the top shelf. Listen carefully to each order!',
    格子占着了: 'There is already something in that box!',
    放对了: 'That is the right box!',
    收尾: 'The fridge is neat and tidy. You are the very best keeper! Click the little house to go back to the map!',
  },

  树桩行列: {
    行小课: 'The little animals in the forest are sitting in neat lines! A line going across is a row. Count them from the top down:',
    列小课: 'A line going down is a column. Count them from the left:',
    我问你答: 'Now I ask and you answer! Say the row first, then the column!',
    点名开场: 'A new game! I call out a seat, and you click that animal!',
    收尾: 'You can count rows and columns now! Click the little house to go back to the map!',
  },

  八大罗盘: {
    开场: 'This is a magic compass! First the everyday compass: put all eight arrows in the right places!',
    口诀: 'Well done! The map hides a little rhyme: up is north, down is south, left is west, right is east! Say it with me: up north, down south, left west, right east!',
    急转弯: 'Here comes the best part! Wherever the needle stops, shout out that direction!',
    问: 'Which direction is the needle pointing to?',
    提示单字: 'Look at the word in the little circle beside it, and read it out loud!',
    收尾: 'You caught all eight directions! Click the little house to go back to the map!',
  },

  学校地图: {
    开场: 'This is the little map beside our school! North is at the top, south at the bottom, west on the left, east on the right. Touch the buildings one by one first, and listen to what is there!',
    这是学校: 'This is our school!',
    提示方向: 'Look at the word it is closest to: north up, south down, west left, east right. A slanted corner needs two words!',
    收尾: 'You can read a map now! Click the little house to go back to the map!',
  },

  衣柜: {
    开场: 'Mum says the closet is a big mess! Let us put things away one by one. Listen carefully to every order!',
    令们: {
      外套: 'Hang the coat on the first hook of the rail!',
      衬衫: 'Hang the shirt on the right of the coat!',
      毛衣: 'Hang the sweater on the last hook of the rail!',
      礼物盒: 'Put the gift box in the bottom right corner of the closet!',
      书包: 'Put the backpack in the very top box of the closet!',
      马甲: 'Put the vest below the hat!',
      拖鞋: 'Put the slippers on the left of the black shoes!',
      靴子: 'Put the boots on the bottom shelf, in the third box counting from the left!',
    },
    提示们: {
      外套: 'The hook at the far left of the rail is the first one!',
      衬衫: 'Find the coat first. Then the empty hook on its right!',
      毛衣: 'The last one is the hook at the far right!',
      礼物盒: 'The lowest box in the right column is the bottom right corner!',
      书包: 'The highest box in the right column!',
      马甲: 'Find the hat first. Then the box right below it!',
      拖鞋: 'Find the black shoes first. Then the box on their left!',
      靴子: 'On the bottom shelf, count from the left: one, two, three!',
    },
    槽里占着了: 'There is already something there!',
    放好啦: 'Nicely done!',
    收尾: 'The closet is neat and tidy. Mum is going to be so proud of you! Click the little house to go back to the map!',
  },

  货架: {
    开场: 'The fruit shop is open! Help the shopkeeper put the fruit on the shelves. Rows go across, columns go down!',
    摆好啦: 'All set!',
    考考你: 'The shelves are full! The shopkeeper has some questions for you!',
    收尾: 'You are the best little shopkeeper in town! Click the little house to go back to the map!',
  },

  动物地图: {
    开场: 'The little animals live in a village! Remember: north is at the top, south at the bottom, west on the left, east on the right. Let us go visiting!',
    收尾: 'You visited all ten houses. You know your way around so well! Click the little house to go back to the map!',
  },

  开车: {
    开场: 'Beep beep! I am the little car, and you are my driver! Tell me out loud where to go: north, south, west, or east!',
    也能点按钮: 'You can also click the direction buttons beside me!',
    没听懂: 'I did not catch that. Say something like go east, or click a direction button!',
    到路口: 'We are at a crossing. Which way do we go now?',
    收尾: 'All three passengers are home! You are the best driver in the whole town! Click the little house to go back to the map!',
  },

  拍照: {
    开场: 'The duckling is wearing a chef hat in the middle of the table, and four children are taking photos of it! Click a child first, and sit in their seat to see what the duckling looks like!',
    洗出来了: 'All right! The photos are ready! Now guess who took each one!',
    问谁拍的: 'Who took this photo? Click that child!',
    错一次: 'Look again: which way is the duckling beak pointing? And the hat?',
    坐过去比一比: 'Let us go and sit over there to compare!',
    一样吗: 'Is it the same as the photo? Have another go!',
    错三次: 'The shiny child took it! Click that one!',
    收尾: 'Everybody sees a different duckling, and you sorted them all out! Click the little house to go back to the map!',
  },

  宝藏: {
    开场: 'Welcome to Treasure Island! I read out the clue from the treasure map, you follow it, and click that square to dig!',
    看脚印: 'Look at my footprints!',
    脚印停在哪儿: 'Where the footprints stop, that is where the treasure is!',
    亮亮那一格: 'The treasure is in the shiny square! Dig it up!',
    收尾: 'All three treasures are yours! You are the best little pirate with a map! Click the little house to go back to the map!',
  },

  记忆: {
    开场: 'This is the memory challenge! The animals only come out for a little while. Use your sharp eyes to remember which side of the big tree each one is on!',
    看仔细: 'Look carefully! Five, four, three, two, one!',
    新一轮: 'A new round! Five, four, three, two, one!',
    收尾: 'Your little head remembers fast and remembers well! Click the little house to go back to the map!',
  },

  Boss: {
    开场: 'The dragon is guarding the log bridge! It has six questions. Every right answer lights up one plank. Are you ready? Go!',
    题一问: 'Which side of the gift box is the bird on?',
    题二问: 'Which row and which column is the star in?',
    题二提示: 'Count across first for the row, then count down for the column!',
    题三问: 'Which direction is the big arrow pointing to?',
    题三提示: 'Look at the word it is closest to: north up, south down, west left, east right! A slanted one needs two words!',
    题四问: 'Which direction is the ice cream shop from the castle?',
    题四提示: 'Up is north, down is south, left is west, right is east. A slanted corner needs two words!',
    题六开场: 'The last one! The balloon only flies for three seconds. Remember which side of the mountain it is on! Three, two, one!',
    题六问: 'Which side of the mountain was the balloon on?',
    通关: 'All six planks are lit! The dragon gives up and flies away! You are the little direction champion!',
    收尾: 'The big adventure is done! Click the little house to go back to the map and look at your stars!',
  },
};

// ---------------------------------------------------------------------------
// 模板 —— 句子里有变量，值要到孩子玩到那一步（或那一题抽到谁）才知道
//
// 除了魔法罗盘那一摊（见文件头的说明），这些**不**展开成成品进预热清单。
// 孩子听到它们时会有一次现合成的等待（约一秒）。
//
// 两张表的每个键、每个签名必须一一对上 —— 测试逐键比对，漏一个就红。
// ---------------------------------------------------------------------------

const 中模板 = {
  玩偶方位: {
    问: (名) => `${名}在礼物盒的哪一边？`,
    教: (名, 位) => `记住哦，${名}在盒子的${位}。跟我说一遍：${位}！`,
    指令: (名, 位) => `把${名}放到盒子的${位}！`,
    /** 拖到了别的圈里 */
    放错了: (某位, 位) => `那是${某位}哦，我要放在${位}！`,
    放对了: (名, 位) => `对啦，${名}到了${位}！`,
  },

  蔬菜格子: {
    /** 答 = 已经挑好语言的那个词（这一关的答案可能是方位，也可能是食物名） */
    教: (答) => `答案是${答}哦。下次一定行！`,
    指令: (名, 参照, 方) => `把${名}放在${参照}的${方}！`,
    再听一遍: (参照, 方) => `再听一遍：放在${参照}的${方}哦！`,
  },

  树桩行列: {
    数行: (行) => `第${行}行！`,
    数列: (列) => `第${列}列！`,
    问: (名) => `${名}坐在第几行、第几列？`,
    提示: (行) => `先横着数：它在第${行}行。再竖着数一数是第几列？`,
    教: (名, 行, 列) => `${名}在第${行}行、第${列}列。跟我念一遍！`,
    点名: (行, 列) => `请点：第${行}行、第${列}列的小动物！`,
    点错了: (行, 列) => `再数一数，第${行}行、第${列}列！`,
    点错两次: (行, 列) => `先找到第${行}行，再从左往右数${列}个！`,
    找对了: (名) => `找对啦，是${名}！`,
  },

  八大罗盘: {
    /** 第一块由机器摆好做示范。方 = 生活轮的「上」或地图轮的「北」（规范名） */
    示范: (方) => `${方}，在最上面！剩下的交给你！`,
    该放哪: (方) => `把${方}放到罗盘的哪里呢？点一个圈圈！`,
    放对了: (方) => `${方}！`,
    /** 生活轮放错：把「右上」拆成「靠上靠右」讲 */
    摆错生活: (生) => `不对哦，${生}应该在${生.includes('上') ? '靠上' : 生.includes('下') ? '靠下' : ''}${生.includes('左') ? '靠左' : 生.includes('右') ? '靠右' : ''}的圈圈里！`,
    /** 地图轮放错：回到口诀上去 */
    摆错地图: (生) => `想想口诀：上北下南，左西右东。${生活对地图[生]}应该放在${生}边！`,
    提示两字: (方) => `它在两个方向的中间，一个是${方[0]}，一个是${方[1]}，连起来说！`,
    教: (方) => `它指着${方}。跟我说：${方}！`,
  },

  学校地图: {
    /** 自由探索时摸到一栋楼（鼠标划过 / 手指按上） */
    摸到: (名, 方) => `${名}！在学校的${方}边。`,
    问地点: (方) => `学校的${方}边是什么呀？`,
    提示单字: (方) => `看${方}字那一边，最边上亮亮的那个！`,
    提示两字: (方) => `${方}就是斜斜的角上，找找亮亮的！`,
    教地点: (方, 名) => `学校的${方}边是${名}。跟我说：${名}！`,
    问方向: (名) => `${名}在学校的哪个方向？`,
    教方向: (名, 方) => `${名}在学校的${方}边。跟我说：${方}！`,
  },

  衣柜: {
    /** 放错一次：把原指令再说一遍 */
    不是那里: (令) => `不是那里哦。${令}`,
  },

  货架: {
    指令: (名, 行, 列) => `把${名}放在第${行}行、第${列}列！`,
    数一数: (行, 列) => `再数一数：第${行}行、第${列}列！`,
    慢慢数: (行, 列) => `先从上往下找到第${行}行，再从左往右数到第${列}列！`,
    问: (行, 列) => `第${行}行、第${列}列放的是什么水果？`,
    提示: (行, 列) => `顺着蓝框框看：第${行}行、第${列}列，那是什么呀？`,
    教: (答) => `那里放的是${答}。跟我说：${答}！`,
  },

  动物地图: {
    问: (主角, 方) => `${主角}往${方}边走一格，会到谁的家呀？`,
    提示: (方, 主角) => `${方}边就是${中生活说法(方)}边！从${主角}家往那边看一格！`,
    教: (答) => `是${答}的家。跟我说：${答}！`,
  },

  开车: {
    /** 昵 = 念给孩子听的叫法（🐱 那一站念「小猫」，不念「猫猫家」） */
    送客: (名, 昵) => `这一趟我们送客人去${名}！找到${昵}的格子，指挥我过去吧！`,
    没有路: (方) => `往${方}没有路呀！看看路往哪边弯！`,
    到站: (名) => `叮咚！${名}到啦！小司机真厉害！`,
  },

  拍照: {
    对了: (名) => `对啦！这是${名}看到的小鸭！`,
  },

  宝藏: {
    /** 藏宝图的线索：从某个地标出发，走若干段 */
    线索: ({ 起, 步们 }) => {
      const 步话 = 步们.map(([方, 数], i) => `${i === 0 ? '' : '再'}往${方}走${数}格`).join('，');
      return `从${起}出发，${步话}，宝藏就埋在那里！挖！`;
    },
    挖空了: (话) => `这里空空的！再听一遍：${话}`,
    /** 宝 = 具名键（金币 / 钻石 / 皇冠），不是那张图 */
    挖到宝: (宝) => `哇！挖到${中宝物名[宝]}啦！`,
  },

  记忆: {
    问: (名) => `${名}刚才在大树的哪边？`,
    // 收名字，不收那只小动物的图形：从前这儿递的是 emoji，TTS 真的会试着去念它
    提示: (名) => `闭上眼睛想一想：${名}是在树的头顶上，脚底下，还是旁边？`,
    教: (名, 位) => `${名}刚才在${位}。没关系，下一轮再仔细看！`,
  },

  Boss: {
    题五问: (方) => `从中间的小熊往${方}走一格，是谁呀？`,
    题五提示: (方) => `${方}边就是${中生活说法(方)}边！`,
    /** 答 = 已经挑好语言的那个词（六道题的答案可能是方位、行列，也可能是动物名） */
    教: (答) => `答案是${答}。小龙看你这么努力，也让你过这一块！`,
    亮桥板: (块) => `亮了${块}块桥板！继续！`,
  },
};

const 英模板 = {
  玩偶方位: {
    问: (名) => `Which side of the gift box is the ${名} on?`,
    教: (名, 位) => `Remember, the ${名} is ${英贴[位]} the box. Say it with me: ${英说(位)}!`,
    指令: (名, 位) => `Put the ${名} ${英贴[位]} the box!`,
    放错了: (某位, 位) => `That spot is ${英说(某位)}! I want it ${英贴[位]} the box!`,
    放对了: (名, 位) => `That is right, the ${名} is ${英贴[位]} the box!`,
  },

  蔬菜格子: {
    教: (答) => `The answer is ${答}. You will get it next time!`,
    指令: (名, 参照, 方) => `Put the ${名} ${英贴[方]} the ${参照}!`,
    再听一遍: (参照, 方) => `Listen again: it goes ${英贴[方]} the ${参照}!`,
  },

  树桩行列: {
    数行: (行) => `Row ${行}!`,
    数列: (列) => `Column ${列}!`,
    问: (名) => `Which row and which column is the ${名} sitting in?`,
    提示: (行) => `Count across first: it is in row ${行}. Now count down, which column is it?`,
    教: (名, 行, 列) => `The ${名} is in row ${行}, column ${列}. Say it with me!`,
    点名: (行, 列) => `Please click the animal in row ${行}, column ${列}!`,
    点错了: (行, 列) => `Count again: row ${行}, column ${列}!`,
    点错两次: (行, 列) => `Find row ${行} first, then count ${列} across from the left!`,
    找对了: (名) => `You found it, it is the ${名}!`,
  },

  八大罗盘: {
    示范: (方) => `${英说(方)}, right at the top! The rest are up to you!`,
    该放哪: (方) => `Where does ${英说(方)} go on the compass? Click a circle!`,
    放对了: (方) => `${英说(方)}!`,
    摆错生活: (生) => {
      const 上下 = 生.includes('上') ? 'near the top' : 生.includes('下') ? 'near the bottom' : '';
      const 左右 = 生.includes('左') ? 'on the left' : 生.includes('右') ? 'on the right' : '';
      return `Not quite! ${英说(生)} belongs in the circle ${[上下, 左右].filter(Boolean).join(' and ')}!`;
    },
    摆错地图: (生) => `Think of the rhyme: up is north, down is south, left is west, right is east. ${英说(生活对地图[生])} belongs on the ${英说(生)} side!`,
    提示两字: (方) => `It is right between two directions: one is ${英说(方[0])}, the other is ${英说(方[1])}. Say them joined together!`,
    教: (方) => `It is pointing ${英说(方)}. Say it with me: ${英说(方)}!`,
  },

  学校地图: {
    摸到: (名, 方) => `The ${名}! It is ${英说(方)} of the school.`,
    问地点: (方) => `What is ${英说(方)} of the school?`,
    提示单字: (方) => `Look at the side with the word ${英牌(方)} on it, and find the shiny one right at the edge!`,
    提示两字: (方) => `${英牌(方)} is the slanted corner. Look for the shiny one!`,
    教地点: (方, 名) => `${英说(方)} of the school is the ${名}. Say it with me: ${名}!`,
    问方向: (名) => `Which direction from the school is the ${名}?`,
    教方向: (名, 方) => `The ${名} is ${英说(方)} of the school. Say it with me: ${英说(方)}!`,
  },

  衣柜: {
    不是那里: (令) => `Not there. ${令}`,
  },

  货架: {
    指令: (名, 行, 列) => `Put the ${名} in row ${行}, column ${列}!`,
    数一数: (行, 列) => `Count again: row ${行}, column ${列}!`,
    慢慢数: (行, 列) => `Find row ${行} from the top first, then count across to column ${列}!`,
    问: (行, 列) => `Which fruit is in row ${行}, column ${列}?`,
    提示: (行, 列) => `Follow the blue box: row ${行}, column ${列}. What is in there?`,
    教: (答) => `That one is the ${答}. Say it with me: ${答}!`,
  },

  动物地图: {
    问: (主角, 方) => `The ${主角} walks one square ${英说(方)}. Whose house does it get to?`,
    提示: (方, 主角) => `${英说(方)} is the same as ${英生活说法(方)}! Look one square that way from the ${主角}'s house!`,
    教: (答) => `It is the ${答}'s house. Say it with me: ${答}!`,
  },

  开车: {
    送客: (名, 昵) => `On this trip we take our guest to the ${名}! Find the ${昵} square and steer me over there!`,
    没有路: (方) => `There is no road going ${英说(方)}! Look at which way the road bends!`,
    到站: (名) => `Ding dong! Here is the ${名}! What a great little driver!`,
  },

  拍照: {
    对了: (名) => `That is right! This is the duckling that ${名} sees!`,
  },

  宝藏: {
    线索: ({ 起, 步们 }) => {
      const 步话 = 步们
        .map(([方, 数], i) => `${i === 0 ? 'go' : 'then go'} ${英说(方)} ${格数(数)}`)
        .join(', ');
      return `Start from the ${起}, ${步话}, and that is where the treasure is buried! Dig!`;
    },
    挖空了: (话) => `Nothing here! Listen again: ${话}`,
    挖到宝: (宝) => `Wow! You dug up ${英宝物名[宝]}!`,
  },

  记忆: {
    问: (名) => `Which side of the big tree was the ${名} on?`,
    提示: (名) => `Close your eyes and think: was the ${名} above the tree, below it, or beside it?`,
    教: (名, 位) => `The ${名} was ${英贴[位]} the tree. Never mind, look closely next round!`,
  },

  Boss: {
    题五问: (方) => `Walk one square ${英说(方)} from the bear in the middle. Who is there?`,
    题五提示: (方) => `${英说(方)} is the same as ${英生活说法(方)}!`,
    教: (答) => `The answer is ${答}. The dragon can see how hard you tried, so this plank is yours!`,
    亮桥板: (块) => `${块} ${块 === 1 ? 'plank is' : 'planks are'} lit up! Keep going!`,
  },
};

// ---------------------------------------------------------------------------
// 两张表合成一份「按当前语言取值」的视图
// ---------------------------------------------------------------------------

/**
 * 叶子做成 getter 而不是提前挑好的字符串 —— 十四个环节模块开头都写着
 * `const 话 = 台词.玩偶方位`，那一行在 import 的时候就跑完了，孩子后来换语言时
 * 谁也不会回去重新 import。做成 getter，`话.开场` 是**读的那一刻**才决定取哪门课，
 * 于是所有调用点一个字都不用改。
 *
 * 用 getter 而不是 Proxy：`Object.values()` / `Object.entries()`（预热摊平、
 * 测试遍历）在 getter 上老老实实走 [[Get]]，行为和普通对象一模一样；
 * 而 Proxy 包在 `Object.freeze` 过的表上会撞不变量，get 陷阱直接抛 TypeError。
 */
function 合(中, 英) {
  const 出 = {};
  for (const 键 of Object.keys(中)) {
    const 中值 = 中[键];
    const 英值 = 英?.[键];
    if (中值 && typeof 中值 === 'object') {
      出[键] = 合(中值, 英值);
      continue;
    }
    Object.defineProperty(出, 键, {
      enumerable: true,
      // 缺英文回落中文：漏译该在测试里红，不该在孩子面前变成一句 undefined
      get: () => (当前语言() === 'en' && 英值 != null ? 英值 : 中值),
    });
  }
  return Object.freeze(出);
}

/** 界面用这两个：照旧写 `话.开场`、`模.问(名)`，取哪门课由当前语言说了算 */
export const 台词 = 合(中台词, 英台词);
export const 模板 = 合(中模板, 英模板);

/** 给测试看的原表 —— 同构性要逐键比对两张分开的表，不是合并视图 */
export const 两语台词 = Object.freeze({ cn: 中台词, en: 英台词 });
export const 两语模板 = Object.freeze({ cn: 中模板, en: 英模板 });

/**
 * 宝物那一小张查词表也露出来给测试：它和别的模板不一样，
 * 是**按键取词**，两门课的键集得一样，也得跟 `环节/宝藏.js` 埋的那几样对得上。
 */
export const 两语宝物名 = Object.freeze({ cn: 中宝物名, en: 英宝物名 });

// ---------------------------------------------------------------------------
// 预热单子
// ---------------------------------------------------------------------------

/** 把嵌套的台词摊成一串句子 */
function 摊平(值, 收) {
  if (typeof 值 === 'string') {
    if (值.trim()) 收.push(值);
    return;
  }
  if (Array.isArray(值)) {
    for (const 一个 of 值) 摊平(一个, 收);
    return;
  }
  if (值 && typeof 值 === 'object') {
    for (const 一个 of Object.values(值)) 摊平(一个, 收);
  }
}

/** 魔法罗盘两轮要念的每一个方位：八个生活方位 + 八个地图方位（规范名） */
function 罗盘的方位们() {
  const 生活们 = Object.keys(生活对地图);
  return [...生活们, ...生活们.map((生) => 生活对地图[生])];
}

/**
 * 某一门课要备进磁盘缓存的每一句，去重后按「孩子多半先听见谁」排。
 *
 * 顺序是有讲究的：预热一批一批地发，排在前面的先落盘。孩子进来必定先听见开场白，
 * 再是鼠标划过地图节点念的环节名字，然后顺着小路一关一关往下走 ——
 * 所以就按那个顺序排。
 *
 * @param {object} [出处]
 * @param {string[]} [出处.环节名们] `环节表` 里那 14 个名字，**已经按 `语` 挑好**
 * @param {'cn'|'en'} [出处.语] 备哪一门课。缺省当前语言 —— `说话.js` 的
 *   `备话((语) => 全部台词({语, ...}))` 会在孩子换语言时用新语言再叫一遍。
 * @returns {string[]}
 */
export function 全部台词({ 环节名们 = [], 语 = 当前语言() } = {}) {
  const 表 = 语 === 'en' ? 英台词 : 中台词;
  const 模 = 语 === 'en' ? 英模板 : 中模板;
  const 收 = [];

  收.push(表.全站.开场白, 表.全站.欢迎回来);
  摊平(环节名们, 收);

  // 答对 / 答错 / 没听清是共享问答流程说的，每一关都在说 —— 出处在 问答.js，这儿只捎上。
  // 要按 `语` 取（不是当前语言）：换语言时的补预热备的是**新那一门**课。
  摊平(问答台词表(语), 收);

  摊平(表.导读, 收);
  摊平(表.玩偶方位, 收);
  摊平(表.蔬菜格子, 收);
  摊平(表.树桩行列, 收);
  摊平(表.八大罗盘, 收);
  // 魔法罗盘是模板展开的唯一例外：方位都来自共享的 罗盘.js，一轮要听十几遍
  for (const 方 of 罗盘的方位们()) {
    收.push(模.八大罗盘.该放哪(方), 模.八大罗盘.放对了(方));
  }
  收.push(模.八大罗盘.示范('上'), 模.八大罗盘.示范(生活对地图['上']));
  摊平(表.学校地图, 收);
  摊平(表.衣柜, 收);
  摊平(表.货架, 收);
  摊平(表.动物地图, 收);
  摊平(表.开车, 收);
  摊平(表.拍照, 收);
  摊平(表.宝藏, 收);
  摊平(表.记忆, 收);
  摊平(表.Boss, 收);

  收.push(表.全站.得星, 表.全站.大庆祝, 表.全站.还在施工);
  收.push(表.全站.重来问, 表.全站.重来了);

  return [...new Set(收.filter((一句) => typeof 一句 === 'string' && 一句.trim()))];
}
