// 台词表 —— 第4讲说给孩子听的每一句话，两门课各一份，键完全同构。
//
// 规矩与第3讲同一套（详见 chapters/03-fangwei/js/台词表.js 头）：句子写在这儿、界面只挑不写；
// 带变量的收模板不收成品；两张表键同构（漏译是红测试，不是孩子耳朵里的一句中文）；
// 读从合并视图 台词/模板 取，取哪门课由当前语言在读的那一刻决定。
//
// 这一讲多一条：**数字的念法从 数词.js 来**，别在台词里手写「六」「sixteen」——
// 数字规范名是数字串本身，中/英怎么念是 数词 的事，模板只管把它嵌进句子。

import { 问答台词表 } from '/shared/js/问答.js';
import { 当前语言 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';

// ---------------------------------------------------------------------------
// 台词 —— 没有变量的整句
// ---------------------------------------------------------------------------

const 中台词 = {
  全站: {
    开场白: '欢迎坐上数字小火车！点一个车站，我们出发啦！',
    欢迎回来: '欢迎回来！小火车等你好久啦，继续开吧！',
    得星: '太棒了，你得到一颗星星！',
    大庆祝: '哇！全部星星都集齐啦！你是数字小火车的通关小英雄！',
    还在施工: '这一站还在施工，先去别的车站玩吧！',
    重来问: '要把星星全部清空，重新坐一趟吗？',
    重来了: '好啦，我们从头再出发！',
  },

  发车站: {
    开场: '小小工程师，欢迎登车！今天我们要学一个大本领，叫做——数字推理！',
    学什么: '数字里藏着好多小秘密：有的一个一个多起来，有的跳着走，有的两条线换着来。我们一路找规律！',
    去玩: '回到地图，点亮每一个车站，把星星全部收齐吧！',
  },

  花圃: {
    开场: '花坛一块一块排过去，花儿越种越多！我们一起数一数。',
    问: '空着的那块花坛，应该种几朵花呀？',
    收尾: '花坛全种满啦！点小房子回地图吧！',
  },

  果盘: {
    开场: '果盘一盘一盘排好队，数目在悄悄地变！空盘子里该放几个呢？点一下放一个，再点就拿走，摆好了拉一下汽笛！',
    草莓轮: '先看草莓盘！',
    苹果轮: '再看苹果盘！',
    收尾: '每个盘子都摆对啦！点小房子回地图吧！',
  },

  山洞: {
    开场: '山洞里的蔬菜排成一队，橙萝卜和紫茄子换着来！',
    橙问: '下一撮橙萝卜，应该有几根呀？',
    蓝问: '那紫茄子呢，又是几个？',
    提示: '别急，隔一个看一个：橙的看橙的，紫的看紫的！',
    收尾: '山洞的规律被你找到啦！点小房子回地图吧！',
  },

  接龙: {
    开场: '数字排成一条长龙，藏着神奇的跳跃规律，你能接下去吗？',
    换一条: '厉害！再来一条更难的！',
    提示: '把它拆成两条线看：一条站着不动，一条一步一步往上走！',
    收尾: '三条长龙都被你接上啦！点小房子回地图吧！',
  },

  蘑菇: {
    开场: '森林里冒出好多蘑菇，篮子里已经摘了几个！',
    点摘开场: '按照规律，下一个该摘哪一个蘑菇呢？点一点它！',
    报数开场: '再来看这一排蘑菇，接下来是几呀？',
    摘错: '这个不对哦，再看看篮子里的规律！',
    提示: '看篮子里：一个、两个、四个、七个……每次多的越来越多！',
    收尾: '蘑菇的双重规律都难不倒你！点小房子回地图吧！',
  },

  长龙: {
    开场: '一到五十排成一条大长龙！有几节车厢空着，我们一行一行把它补上。',
    一行完: '这一行补齐啦！',
    收尾: '一到五十全都排好队，你数得又快又准！点小房子回地图吧！',
  },

  糖葫芦: {
    开场: '糖葫芦一串比一串短，空着的那串要串几个呢？点一下串一个，再点拿掉，串好拉汽笛！',
    山楂轮: '先串山楂串！',
    橘瓣轮: '再串橘子瓣串！',
    收尾: '糖葫芦串得整整齐齐，真棒！点小房子回地图吧！',
  },

  装货: {
    开场: '火车要装货啦！每节车厢的货越堆越高，空车厢该装几个呢？点一下装一个，再点卸掉，装好拉汽笛！',
    草莓轮: '先装草莓！',
    钻石轮: '再装亮晶晶的钻石！',
    蘑菇轮: '最后装蘑菇！',
    收尾: '每节车厢都装得刚刚好！点小房子回地图吧！',
  },

  火车: {
    开场: '数字火车开过来啦！有的车厢牌子空着，你来报出它是几！',
    换一列: '这一列开走咯，下一列来啦！',
    收尾: '每一列火车的号码都被你补齐啦！点小房子回地图吧！',
  },

  出题官: {
    开场: '换你当出题官啦！给车厢装上货，编一道数字规律题，看看能不能难倒爸爸！',
    装车: '想一个规律，一节一节给车厢装货吧！装好了拉汽笛！',
    考爸爸: '出好题啦！盖住一节车厢，喊爸爸来猜猜看！',
    你当裁判: '爸爸答完了吗？你来当小裁判：答对点绿勾勾，答错点红叉叉！',
    夸好题: '哇，这是一道真正的好题！有规律，出得妙！',
    认不出: '好有创意的一道题！爸爸肯定要动动脑筋啦！',
    收尾: '你出的题真棒！点小房子回地图吧！',
  },

  找错: {
    开场: '这几列小火车都按规律装了货，可有一节调皮的车厢装错啦！',
    找一找: '哪一节车厢不对呢？点一点它！',
    点对了: '就是它！找到啦！',
    点错了: '这一节没错哦，再仔细看看规律！',
    收尾: '每一节装错的车厢都被你揪出来啦！点小房子回地图吧！',
  },

  Boss: {
    开场: '终点总站到啦！大城堡出八道题，把学过的规律全混在一起。答对一道，就往前开一节。准备好了吗？冲！',
    通关: '八道题全部答对！小火车顺利到达终点站！你就是数字推理小冠军！',
    收尾: '大冒险完成！点小房子回地图，看看你的星星吧！',
  },

  // 报数题共用（花圃 / 山洞 / 接龙 / 蘑菇报数 / 长龙 / 火车 / Boss 都在说）
  报数: {
    接下来: '接下来该是几呢？点一下麦克风，说给我听！',
  },

  // 摆放题共用的反馈（果盘 / 糖葫芦 / 装货 / 出题官 的动手引擎在说）
  摆放: {
    对: '摆对啦，小火车开动咯！',
    错1: '差一点点，再数一数看！',
    提示头: '我们把前面的一组一组数过去：',
    演示头: '看好啦，应该是这么多：',
  },
};

const 英台词 = {
  全站: {
    开场白: 'All aboard the number train! Click a station and let us go!',
    欢迎回来: 'Welcome back! The train has been waiting. Let us keep going!',
    得星: 'Wonderful, you got a star!',
    大庆祝: 'Wow! You collected every star! You are the champion of the number train!',
    还在施工: 'This station is still being built. Let us go and play another one!',
    重来问: 'Do you want to clear all the stars and ride again from the start?',
    重来了: 'All right, we set off again from the very beginning!',
  },

  发车站: {
    开场: 'Little engineer, welcome aboard! Today we learn a big new skill. It is called number patterns!',
    学什么: 'Numbers hide little secrets: some grow one by one, some jump along, some take turns in two lines. We will hunt for patterns all the way!',
    去玩: 'Go back to the map and light up every station. Collect all the stars!',
  },

  花圃: {
    开场: 'The flower beds line up one after another, with more and more flowers! Let us count them.',
    问: 'How many flowers should the empty bed have?',
    收尾: 'Every bed is planted! Click the little house to go back to the map!',
  },

  果盘: {
    开场: 'The fruit plates line up in a row, and the numbers are quietly changing! How many go on the empty plate? Tap to add one, tap again to take it away, then pull the whistle!',
    草莓轮: 'Look at the strawberry plates first!',
    苹果轮: 'Now the apple plates!',
    收尾: 'Every plate is right! Click the little house to go back to the map!',
  },

  山洞: {
    开场: 'In the cave, the vegetables line up, orange carrots and purple eggplants taking turns!',
    橙问: 'How many carrots should the next orange bunch have?',
    蓝问: 'And the purple ones, how many?',
    提示: 'Take it slow, look at every other one: orange with orange, purple with purple!',
    收尾: 'You found the cave pattern! Click the little house to go back to the map!',
  },

  接龙: {
    开场: 'The numbers line up in a long chain with a magic jumping pattern. Can you carry it on?',
    换一条: 'Great! Here is a trickier one!',
    提示: 'Split it into two lines: one stays still, the other steps up one at a time!',
    收尾: 'You carried on all three chains! Click the little house to go back to the map!',
  },

  蘑菇: {
    开场: 'Lots of mushrooms popped up in the forest, and a few are already in the basket!',
    点摘开场: 'Which mushroom should we pick next, following the pattern? Tap it!',
    报数开场: 'Now look at this row of mushrooms. What comes next?',
    摘错: 'Not that one. Look again at the pattern in the basket!',
    提示: 'Look in the basket: one, two, four, seven... each time it grows a little more!',
    收尾: 'The double pattern of the mushrooms cannot fool you! Click the little house to go back to the map!',
  },

  长龙: {
    开场: 'One to fifty line up in a great long dragon! A few wagons are empty. We will fill them in row by row.',
    一行完: 'This row is complete!',
    收尾: 'One to fifty are all in line, and you counted fast and true! Click the little house to go back to the map!',
  },

  糖葫芦: {
    开场: 'Each candied-haw skewer is shorter than the last. How many go on the empty one? Tap to thread one on, tap again to take it off, then pull the whistle!',
    山楂轮: 'Thread the haw skewers first!',
    橘瓣轮: 'Now the orange-segment skewers!',
    收尾: 'The skewers are threaded neatly. Great job! Click the little house to go back to the map!',
  },

  装货: {
    开场: 'The train is loading up! Each wagon is stacked higher than the last. How many go in the empty wagon? Tap to load one, tap again to unload, then pull the whistle!',
    草莓轮: 'Load the strawberries first!',
    钻石轮: 'Now the sparkling diamonds!',
    蘑菇轮: 'And last, the mushrooms!',
    收尾: 'Every wagon is loaded just right! Click the little house to go back to the map!',
  },

  火车: {
    开场: 'Here comes the number train! Some wagon signs are blank. You call out the number!',
    换一列: 'This train pulls away, and the next one arrives!',
    收尾: 'You filled in the numbers on every train! Click the little house to go back to the map!',
  },

  出题官: {
    开场: 'Now it is your turn to be the quiz-maker! Load the wagons, make a number-pattern puzzle, and see if you can stump Dad!',
    装车: 'Think of a pattern and load the wagons one by one! Pull the whistle when you are done!',
    考爸爸: 'Puzzle ready! Cover one wagon and call Dad over to guess!',
    你当裁判: 'Has Dad answered? You be the judge: tap the green tick if he is right, the red cross if he is wrong!',
    夸好题: 'Wow, this is a real good puzzle! It has a pattern, cleverly made!',
    认不出: 'What a creative puzzle! Dad will really have to think hard!',
    收尾: 'What a great puzzle you made! Click the little house to go back to the map!',
  },

  找错: {
    开场: 'These little trains are all loaded by a pattern, but one naughty wagon is loaded wrong!',
    找一找: 'Which wagon is wrong? Tap it!',
    点对了: 'That is the one! You found it!',
    点错了: 'This one is fine. Look at the pattern more carefully!',
    收尾: 'You caught every wagon that was loaded wrong! Click the little house to go back to the map!',
  },

  Boss: {
    开场: 'We have reached the final station! The big castle asks eight questions, mixing up every pattern you learned. Every right answer moves us one wagon ahead. Ready? Go!',
    通关: 'All eight questions right! The little train reaches the final station! You are the champion of number patterns!',
    收尾: 'The big adventure is done! Click the little house to go back to the map and look at your stars!',
  },

  报数: {
    接下来: 'What comes next? Tap the microphone and tell me!',
  },

  摆放: {
    对: 'That is right, off goes the train!',
    错1: 'So close, count them again!',
    提示头: 'Let us count the groups before it, one by one:',
    演示头: 'Watch, it should be this many:',
  },
};

// ---------------------------------------------------------------------------
// 模板 —— 句子里有变量（多半是一个数），到玩到那一步才知道
//
// 数字的念法一律走 数词.js：中文模板用 中文数()，英文模板用 英文数()。
// 两张表的每个键、每个签名必须一一对上 —— 测试逐键比对，漏一个就红。
// ---------------------------------------------------------------------------

const 中模板 = {
  报数: {
    教: (n) => `是${中文数(n)}。跟我数一遍：${中文数(n)}！`,
  },
  花圃: {
    教: (n) => `下一块种${中文数(n)}朵。跟我数一遍！`,
  },
  山洞: {
    教橙: (n) => `橙萝卜一根一根多起来，下一撮是${中文数(n)}根！`,
    教蓝: (n) => `紫茄子一直都是${中文数(n)}个，没有变哦！`,
  },
  长龙: {
    行开始: (行) => `第${中文数(行)}行，我们接着往下数！`,
    教: (n) => `这里应该是${中文数(n)}。跟我说：${中文数(n)}！`,
  },
  摆放: {
    教数: (n) => `应该放${中文数(n)}个哦！`,
  },
  找错: {
    教: (对值, 位) => `装错的是第${中文数(位)}节，它本来应该是${中文数(对值)}！`,
  },
  Boss: {
    亮车厢: (块) => `答对啦，往前开到第${中文数(块)}节！`,
  },
};

const 英模板 = {
  报数: {
    教: (n) => `It is ${英文数(n)}. Count it with me: ${英文数(n)}!`,
  },
  花圃: {
    教: (n) => `The next bed has ${英文数(n)} flowers. Count it with me!`,
  },
  山洞: {
    教橙: (n) => `The orange carrots grow one by one, so the next bunch is ${英文数(n)}!`,
    教蓝: (n) => `The purple ones are always ${英文数(n)}, they never change!`,
  },
  长龙: {
    行开始: (行) => `Row ${英文数(行)}. Let us keep counting on!`,
    教: (n) => `This one should be ${英文数(n)}. Say it with me: ${英文数(n)}!`,
  },
  摆放: {
    教数: (n) => `It should be ${英文数(n)}!`,
  },
  找错: {
    教: (对值, 位) => `Wagon ${英文数(位)} is the wrong one. It should really be ${英文数(对值)}!`,
  },
  Boss: {
    亮车厢: (块) => `That is right, on to wagon ${英文数(块)}!`,
  },
};

// ---------------------------------------------------------------------------
// 两张表合成一份「按当前语言取值」的视图（做法同第3讲）
// ---------------------------------------------------------------------------

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
      get: () => (当前语言() === 'en' && 英值 != null ? 英值 : 中值),
    });
  }
  return Object.freeze(出);
}

export const 台词 = 合(中台词, 英台词);
export const 模板 = 合(中模板, 英模板);

export const 两语台词 = Object.freeze({ cn: 中台词, en: 英台词 });
export const 两语模板 = Object.freeze({ cn: 中模板, en: 英模板 });

// ---------------------------------------------------------------------------
// 预热单子
// ---------------------------------------------------------------------------

function 摊平(值, 收) {
  if (typeof 值 === 'string') { if (值.trim()) 收.push(值); return; }
  if (Array.isArray(值)) { for (const 一个 of 值) 摊平(一个, 收); return; }
  if (值 && typeof 值 === 'object') { for (const 一个 of Object.values(值)) 摊平(一个, 收); }
}

/**
 * 某一门课要备进磁盘缓存的每一句，去重后按「孩子多半先听见谁」排：
 * 开场白 → 各站名字（划过地图节点念的）→ 共享问答三摊 → 各站台词 →
 * 高频的报数「教」（0~50 都可能念到，展开备上）。
 */
export function 全部台词({ 环节名们 = [], 语 = 当前语言() } = {}) {
  const 表 = 语 === 'en' ? 英台词 : 中台词;
  const 模 = 语 === 'en' ? 英模板 : 中模板;
  const 收 = [];

  收.push(表.全站.开场白, 表.全站.欢迎回来);
  摊平(环节名们, 收);
  摊平(问答台词表(语), 收); // 报数题走共享问答，捎上它那三摊

  摊平(表.发车站, 收);
  摊平(表.花圃, 收);
  摊平(表.果盘, 收);
  摊平(表.山洞, 收);
  摊平(表.接龙, 收);
  摊平(表.蘑菇, 收);
  摊平(表.长龙, 收);
  摊平(表.糖葫芦, 收);
  摊平(表.装货, 收);
  摊平(表.火车, 收);
  摊平(表.出题官, 收);
  摊平(表.找错, 收);
  摊平(表.Boss, 收);
  摊平(表.报数, 收);
  摊平(表.摆放, 收);

  // 报数的「教」句每关都可能说，且各数念法不一样，值得整档备上（书里最大到 70）
  for (let n = 0; n <= 70; n += 1) 收.push(模.报数.教(n));

  收.push(表.全站.得星, 表.全站.大庆祝, 表.全站.还在施工);
  收.push(表.全站.重来问, 表.全站.重来了);

  return [...new Set(收.filter((一句) => typeof 一句 === 'string' && 一句.trim()))];
}
