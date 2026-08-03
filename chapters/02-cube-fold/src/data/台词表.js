import { 当前语言 } from '/shared/js/语言.js';
import { 数点点台词 } from '../domain/collectionCount.js';
import { 数字题库, 水果名, 水果们 } from './fruitQuestions.js';
import { 保底夸奖表, 倒数词 } from '/shared/js/看见.js';

/**
 * 台词表 —— 方方在这一讲里说的每一句话，全站一份，**两语一张同构的表**。
 *
 * 为什么要有这张表：孩子不认字，屏幕上一个句子都没有，方方的嘴就是全部的说明书。
 * 而每一句话第一次说出来都要现合成（DashScope TTS 一趟网络），孩子听见的是几秒安静。
 * 这张表存在的**首要目的**是让预热在开场那几秒把它们全灌进后端的磁盘缓存
 * （`var/cache/tts/`，键是 `model|voice|text`），之后每一句都是从盘上直接读出来的。
 * 分批灌的那套账归 `说话.js` 的 `备话(供话)`（它还多做一件这儿做不到的事：
 * 换语言时用新语言再灌一遍），这张表只负责「给出某一门课要说的全部句子」。
 *
 * 四条规矩：
 *
 * 1. **句子写在这儿，界面那边只挑不写。** 五个玩法的模块都从这儿 import，
 *    没有第二处字面量。改一句话只改这个文件。
 * 2. **两张表键完全一样。** 中文一句、英文一句，键对键。漏译在测试里直接红
 *    （`test/lines.test.js` 比两边的键集合，还拦英文表里混进汉字）——
 *    不能等孩子在英文课上听见半句中文才发现。
 * 3. **带变量的句子收模板，不收成品。** 「你已经找到 N 件衣服」「答案是 X」这种，
 *    N 和 X 是孩子玩出来的，把所有可能的成品都塞进缓存既灌不完，也没意义 ——
 *    所以它们以函数的形式住在 `模板` 里。只有**由题库定死、跟孩子无关**的那几句
 *    （闯关三两道题的题面）例外：它们的变量来自 `data/fruitQuestions.js`，
 *    值是算出来就定死的，`全部台词()` 把它们展开成成品一起备上。
 * 4. **台词要现取，不许在模块顶上摊开。** `台词()` 是个函数不是个对象，就是为了
 *    挡住 `const { 问句 } = 台词.猜一猜` 这种写法 —— 那一行会把中文那句话焊死在
 *    模块加载的那一刻，孩子切成英文之后方方还在念中文。要说话的时候再取。
 *
 * 不在这张表里的（说明书归说明书，这儿只管方方的嘴）：
 *   - 五个玩法的名字（`ui/nav.js` 的 `模式列表` 是它们的出处，鼠标扫过图标念的就是它）
 *   - 图鉴数点点那一摊（`domain/collectionCount.js`：句子跟着「几个点」现算，
 *     那边有 node --test 盯着，搬过来只会多一份抄件）
 *   两样都由 `全部台词()` 的入参接进来，`main.js` 在开场时把出处递进去。
 */

// ---------------------------------------------------------------------------
// 台词 · 中文
// ---------------------------------------------------------------------------

/** 说给孩子听的每一句。都短 —— 长了他听到一半就去点别的了 */
const 中文台词 = Object.freeze({
  /** 不属于哪一个玩法的 */
  全站: Object.freeze({
    /** 打开网站、点过 ▶ 之后听见的第一句 */
    开场白: '在格子纸上涂六个格子，给正方体做件衣服吧！',
    // 左下角「重来」的两击确认
    重来问: '要把攒到的都清掉，重新来吗？点绿色的勾。',
    重来了: '好啦，全部重新开始！',
    不清了: '那就不清啦。',
    /** 点了 🇬🇧 之后，方方用新语言说的第一句 —— 换语言的确认本身也得听得见 */
    换语言了: '我们说中文啦！',
  }),

  /**
   * 「穿不上」长什么样，全站只教一次：沙盒里折坏了、猜一猜里试穿失败，
   * 方方说的是同两句话。红黄两处也是同一套（见 CONTEXT.md）。
   */
  共用: Object.freeze({
    痒: '哎呀，这里叠了两层，硌得我痒痒！',
    漏风: '那边还漏了个洞，呼呼地漏风——阿嚏！这件穿不上呀。',
  }),

  穿衣服: Object.freeze({
    涂满了: '六个格子就够啦，正方体只有六个面。',
    能折了: '好啦，点一个格子，帮我把衣服折起来！',
    断开了: '格子要一条边挨着一条边才行哦。',
    /** 合上了，而且不是新种类（是新的就由图鉴说「发现新衣服！」+ 接着看对面） */
    穿上了: '太棒了，我穿上新衣服啦！点一个面看看。',
    /** 接在图鉴那句「发现新衣服！」后面，合成一句说 —— 说() 是后一句掐前一句的 */
    接着看对面: '点一个面看看。',
    这是对面: '这两个是对面！',
    滑块出来: '拖着这根条，衣服会慢慢合起来。',
    滑块收起: '收起来啦。',
    // 对着麦克风喊口令
    先画一件: '先在格子纸上涂六个格子，画一件衣服给我呀！',
    没听清口令: '我没听清，你可以说「穿衣服」，或者「脱衣服」。',
  }),

  猜一猜: Object.freeze({
    问句: '这件衣服，我能穿得上吗？',
    表扬们: Object.freeze([
      '答对啦，你真棒！我来试穿给你看！',
      '猜对了，好厉害！我这就穿上试试！',
      '就是这样，真聪明！看我试穿！',
    ]),
    /**
     * 猜错过一次之后又猜对了，说这一句，不说「你真棒」。
     * 这一关只有两个答案，猜错一次再换一个必然是对的 —— 那会儿再夸「你真棒」，
     * 就是在夸他会换一个按。
     */
    改口了: '这次对啦！我来试穿给你看！',
    鼓励们: Object.freeze(['再想一想，你再猜一次！', '差一点点，我们再猜一次好不好？', '没关系，再猜一次！']),
    没听清们: Object.freeze(['我没听清，再说一遍好不好？', '声音再大一点点，我们再来一次！']),
    /** 听不清两回之后加这一句 —— 两个大按钮一直摆在那儿，只是得有人告诉他可以点 */
    用手也行: '要不点一点旁边那两个大按钮吧！',
    /** 错两次的「提示」是把衣服折到一半：半折观察态本身就是线索，比一句话强 */
    提示语: '我先折一半给你看看，你再猜一次！',
    教答案: Object.freeze({
      能: '我告诉你吧，这件我能穿上哦！我们试试看！',
      不能: '我告诉你吧，这件我穿不上呀。我们试试看！',
    }),
    穿上了: '你看，我穿上新衣服啦！',
    重猜: '好，我们从头再猜一遍！',
  }),

  贴水果: Object.freeze({
    开场: '先挑一个水果，再点一个格子，把它贴到对面去！',
    我先贴的: '这个是我先贴好的，你来贴它的对面！',
    先挑水果: '先挑一个水果，再点格子。',
    贴齐了: '都贴好啦！点那件小衣服，我穿给你看！',
    我穿给你看: '我穿给你看！',
    见不着面: '哎呀，它们见不着面呀，再试一次！',
    露一个: '再看仔细一点，我给你露一个。',
    这才是一对: '你看，这两个才是一对对面。再试试看！',
    告诉你在这儿: '没关系，我告诉你：它们在这儿。下次就会啦！',
    没听清水果: '我没听清，你可以说苹果，或者香蕉。',
    // 闯关三那两道数字题
    答对了: '答对啦，你真棒！',
    差一点: '差一点点，再想一想！',
    没听清: '我没听清，再说一遍好不好？',
    没听清点数字: '我没听清，点下面的数字也行！',
    碰头看: '我穿上给你看看，它俩碰头了。',
    全答对: '全答对啦，你太厉害了！',
    看下一张: '这一题就到这儿，我们看下一张！',
    重贴: '好，我们从头再贴一遍！',
  }),

  衣服图鉴: Object.freeze({
    数点点吧: '点一下，我们一起数点点！',
    找到了: '这件找到啦，点一下拿去折。',
    还没找到: '这件还没找到哦。',
    集齐了: '十一件衣服全都找到啦！你太厉害了！',
    一件都没有: '这里是衣服图鉴。去自己折那边画一件，就点亮一格！',
    全在这儿了: '十一件衣服全都在这儿啦！',
  }),

  做一件真的: Object.freeze({
    纸样在这儿: '这就是你那件衣服的纸样，按打印机印出来！',
    先去画一件: '先去画一件能穿上的衣服，再回来印。',
    先折得上: '这件衣服还穿不上呢，先折一件能穿上的，再回来印。',
    印不了: '这件衣服还穿不上呢，印不了。',
    印出来: '印出来',
    剪下来: '剪下来，沿虚线折，把小耳朵抹上胶水粘住！',
    // 打印前的二次确认（跟左下角「重来」同一套问-确认；问句走语音、不上屏，孩子不认字）。
    // 一巴掌拍上打印机就弹系统打印框、课堂冻住、不识字的他不会取消 —— 先问一句再印。
    打印问: '要把这件衣服印出来吗？点绿色的勾。',
    先不印: '好，那先不印啦。',
    // 相机
    举给我看: '举给我看看你做的盒子！',
    举起来吧: '把你做的盒子举起来，让我看看！',
    // 相机被别的程序占着、这会儿开不了 —— 不是没摄像头，等一下能再试，按钮留着可重试
    相机开不了: '相机现在用不了，可能别的地方正用着，等一下再试试！',
    /**
     * 拍照倒数的那三个字、和视觉接口挂了时的保底夸奖。
     *
     * 这两样的正主在共享的 `/shared/js/看见.js` 里，写死的是中文，而那个文件不归本讲改。
     * 所以中文这一栏**直接引它的导出**（不抄一份，抄了就有第二个真理来源），
     * 英文那一栏是本讲自己的说法；`ui/printSheet.js` 拿这两栏配成一张译台，
     * 英文模式下把看见模块递出来的中文句子换成英文再进方方的嘴。
     */
    倒数们: Object.freeze([...倒数词(3)]),
    保底夸奖们: Object.freeze([...保底夸奖表]),
    /** 说给视觉模型听的场景，不是说给孩子听的 —— 不进预热清单 */
    场景: '一个五岁小朋友和爸爸妈妈一起用纸做出来的正方体小盒子，可能有点歪、有点毛边',
  }),
});

// ---------------------------------------------------------------------------
// 台词 · 英文
//
// 键跟中文那张一模一样（测试盯着），句子是**平行翻译**不是直译：
// 一样短、一样是说给一个五岁孩子听的，用的是他这一课要学的那些词。
// ---------------------------------------------------------------------------

const 英文台词 = Object.freeze({
  全站: Object.freeze({
    开场白: 'Colour six squares on the paper, and make me a coat!',
    重来问: 'Shall we clear everything and start again? Press the green tick.',
    重来了: 'All right, everything starts again!',
    不清了: 'OK, we will keep it.',
    换语言了: 'We are speaking English now!',
  }),

  共用: Object.freeze({
    痒: 'Oh dear, two pieces are stacked up here. It tickles!',
    漏风: 'And there is a hole over there, the wind is coming in. Atchoo! This coat does not fit.',
  }),

  穿衣服: Object.freeze({
    涂满了: 'Six squares is enough. A cube has only six faces.',
    能折了: 'Great! Press a square and help me fold my coat up!',
    断开了: 'The squares have to touch, edge to edge.',
    穿上了: 'Wonderful, I am wearing my new coat! Press a face and look.',
    接着看对面: 'Press a face and look.',
    这是对面: 'These two are opposite faces!',
    滑块出来: 'Drag this bar, and my coat folds up slowly.',
    滑块收起: 'All tidied away.',
    先画一件: 'Colour six squares on the paper first, and draw me a coat!',
    没听清口令: 'I did not catch that. You can say, get dressed, or take it off.',
  }),

  猜一猜: Object.freeze({
    问句: 'Can I wear this coat?',
    表扬们: Object.freeze([
      'That is right, you are brilliant! Let me try it on!',
      'You guessed it, well done! I will put it on now!',
      'Exactly right, so clever! Watch me try it on!',
    ]),
    改口了: 'That is right this time! Let me try it on for you!',
    鼓励们: Object.freeze([
      'Have a think, and guess one more time!',
      'So close. Shall we guess again?',
      'Never mind, have another guess!',
    ]),
    没听清们: Object.freeze([
      'I did not catch that. Can you say it again?',
      'A little bit louder, let us try again!',
    ]),
    用手也行: 'You can press one of those two big buttons instead!',
    提示语: 'I will fold it halfway for you. Now guess again!',
    教答案: Object.freeze({
      能: 'Let me tell you, I can wear this one! Let us try it!',
      不能: 'Let me tell you, this one does not fit me. Let us try it!',
    }),
    穿上了: 'Look, I am wearing my new coat!',
    重猜: 'OK, let us guess them all again!',
  }),

  贴水果: Object.freeze({
    开场: 'Pick a fruit first, then press a square, and stick it on the opposite face!',
    我先贴的: 'This one was stuck on for you. You stick the one opposite it!',
    先挑水果: 'Pick a fruit first, then press a square.',
    贴齐了: 'They are all on! Press the little coat, and I will put it on for you!',
    我穿给你看: 'Watch me put it on!',
    见不着面: 'Oh dear, those two cannot see each other. Try again!',
    露一个: 'Look carefully, I will show you one.',
    这才是一对: 'See, these two are the opposite pair. Have another try!',
    告诉你在这儿: 'Never mind, let me show you. They go here. You will get it next time!',
    没听清水果: 'I did not catch that. You can say apple, or banana.',
    答对了: 'That is right, you are brilliant!',
    差一点: 'So close, have a think!',
    没听清: 'I did not catch that. Can you say it again?',
    没听清点数字: 'I did not catch that. You can press a number below!',
    碰头看: 'I will put it on and show you. Those two meet.',
    全答对: 'All correct! You are amazing!',
    看下一张: 'That is all for this one. Let us look at the next!',
    重贴: 'OK, let us stick them all again!',
  }),

  衣服图鉴: Object.freeze({
    数点点吧: 'Press here, and let us count the dots together!',
    找到了: 'You have found this one. Press it to go and fold it.',
    还没找到: 'You have not found this one yet.',
    集齐了: 'You have found all eleven coats! You are amazing!',
    一件都没有: 'This is the coat book. Go and draw one in the sandbox, and a slot lights up!',
    全在这儿了: 'All eleven coats are here!',
  }),

  做一件真的: Object.freeze({
    纸样在这儿: 'This is the paper pattern for your coat. Print it out!',
    先去画一件: 'Go and draw a coat that fits first, then come back and print it.',
    先折得上: 'This coat does not fit yet. Fold one that fits, then come back and print it.',
    印不了: 'This coat does not fit yet, so I cannot print it.',
    印出来: 'Print it out',
    剪下来: 'Cut it out, fold along the dotted lines, and glue the little tabs down!',
    打印问: 'Shall I print this coat out? Press the green tick.',
    先不印: 'OK, we will not print it right now.',
    举给我看: 'Show me the box you made!',
    举起来吧: 'Hold up the box you made, and let me see!',
    相机开不了: 'The camera is busy right now. Let us try again in a little while!',
    倒数们: Object.freeze(['Three', 'Two', 'One']),
    保底夸奖们: Object.freeze([
      'You did a brilliant job!',
      'Wow, that looks lovely!',
      'I can see it, it is beautiful!',
      'Your hands are so clever!',
      'I really like this one!',
    ]),
    /*
      场景进的是 看见.js 的中文提示词模板（那个文件不归本讲改），所以这一句
      得**自己**把语言要求带进去 —— 不带的话模型照着中文模板回一句中文，
      英文课上方方就当场串了台。
    */
    场景:
      'a little paper cube box that a five-year-old made together with mum and dad,'
      + ' it may be a bit crooked or rough'
      + '。请务必用一句简短的英文来夸他，不要用中文',
  }),
});

const 两张台词 = Object.freeze({ cn: 中文台词, en: 英文台词 });

/**
 * 这一语的整张台词表。
 *
 * **要说话的时候才调它**，别在模块顶上 `const 话 = 台词().贴水果` ——
 * 那样孩子切了语言，这个模块还端着旧那一张。各玩法的写法是 `const 话 = () => 台词().贴水果`。
 *
 * @param {'cn'|'en'} [语] 不给就是当前语言
 */
export function 台词(语 = 当前语言()) {
  return 两张台词[语] ?? 中文台词;
}

// ---------------------------------------------------------------------------
// 模板 —— 句子里有个变量，值是孩子玩出来的
//
// 这些**不**进预热清单：N 和 X 要到孩子玩到那一步才知道，
// 把所有可能的成品都灌进缓存既灌不完，也挤掉了真正常说的那几句。
// 孩子听到它们时会有一次现合成的等待（约一秒），换来的是缓存里没有几十条废句子。
// ---------------------------------------------------------------------------

const 中文模板 = Object.freeze({
  // --- 猜一猜 ---
  /** 17 题全做完 */
  猜一猜收尾: (题数, 猫数) => `${题数}道题全做完啦！你收到了${猫数}只小猫。想再猜一遍就点那个转圈的箭头。`,

  // --- 贴水果 ---
  /** 一对同款水果在方方身上碰了头 */
  碰到头: (水果名) => `你看，两个${水果名}碰到头啦！它们是对面。`,
  已经贴上了: (水果名) => `${水果名}已经贴上去啦，点一下它就能拿下来。`,
  /** 数字题三次没答对，直接告诉他 */
  告诉你答案: (答) => `没关系，我告诉你：是${答}。下次就会啦！`,
  贴水果收尾: (兔数) => `十三张都贴完啦！你收到了${兔数}只小兔子。想再贴一遍就点那个转圈的箭头。`,
  /**
   * 闯关三第一问：这一格上是几，它对面那一格上是几。
   * 变量来自题库（`建数字题` 算出来的），跟孩子怎么玩无关 —— 所以
   * `全部台词()` 把两道题的四句都展开成成品备上。
   */
  问对面数: (题) => `你看这一格，上面是${题.问的数}。它对面那一格上是几呀？`,
  /** 闯关三第二问：两个加起来是多少 */
  问加起来: (题) => `那${题.问的数}和${题.对面数}加起来，一共是多少呢？`,

  // --- 衣服图鉴 ---
  /** 沙盒里折出一件没见过的：这一句由图鉴说，后面接沙盒自己的一句 */
  发现新衣服: (接着说 = '') => `发现新衣服！${接着说}`,
  找到几件: (数) => `你已经找到 ${数} 件衣服啦，还差几件呢！`,
});

const 英文模板 = Object.freeze({
  猜一猜收尾: (题数, 猫数) =>
    `You finished all ${题数} questions! You collected ${猫数} kittens.`
    + ' Press the round arrow to guess them all again.',

  碰到头: (水果名) => `Look, both ${水果名} stickers met each other! They are opposite faces.`,
  已经贴上了: (水果名) => `The ${水果名} is already on. Press it and you can take it off.`,
  告诉你答案: (答) => `Never mind, let me tell you. It is ${答}. You will get it next time!`,
  贴水果收尾: (兔数) =>
    `All thirteen are done! You collected ${兔数} bunnies.`
    + ' Press the round arrow to do them all again.',
  问对面数: (题) => `Look at this square, it says ${题.问的数}. What is on the square opposite it?`,
  问加起来: (题) => `So what do ${题.问的数} and ${题.对面数} make altogether?`,

  发现新衣服: (接着说 = '') => `A brand new coat! ${接着说}`,
  找到几件: (数) => `You have found ${数} coats so far. A few more to go!`,
});

const 两张模板 = Object.freeze({ cn: 中文模板, en: 英文模板 });

/**
 * 这一语的模板。`全部台词()` 要按语备题面，所以它得能指名道姓地要一张。
 * @param {'cn'|'en'} [语]
 */
export function 模板表(语 = 当前语言()) {
  return 两张模板[语] ?? 中文模板;
}

/**
 * 模板 —— 调的时候才认语言。
 *
 * 界面上照旧写 `模板.找到几件(3)`，不用管现在是哪一语；每一次调用都现查当前语言，
 * 所以孩子切了语言之后，同一行代码吐出来的就是英文那一句。
 */
export const 模板 = Object.freeze(
  Object.fromEntries(
    Object.keys(中文模板).map((键) => [键, (...参) => 模板表()[键](...参)]),
  ),
);

// ---------------------------------------------------------------------------
// 预热单子（怎么灌归 说话.js，这儿只管灌什么、按什么顺序）
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

/**
 * 要备进磁盘缓存的每一句，去重后按「孩子多半先听见谁」排。
 *
 * 顺序是有讲究的：预热是一批一批发的，排在前面的先落盘。孩子进来必定先听见开场白，
 * 再是鼠标扫过图标的玩法名字，然后多半在沙盒里待一会儿 —— 所以这三样打头。
 *
 * @param {object} [出处]
 * @param {string[]} [出处.玩法名字们] `ui/nav.js` 的 `模式列表` 里那五个名字，
 *   **调用方按 `语` 挑好再递进来**（名字的出处在导航，不在这儿）
 * @param {string[]} [出处.图鉴编码们] 图鉴四排的编码（'141' / '231' / '222' / '33'），
 *   用来现算数点点彩蛋的台词
 * @param {'cn'|'en'} [语] 备哪一语的。切语言时补备新语言的那一份就靠它
 * @returns {string[]}
 */
export function 全部台词({ 玩法名字们 = [], 图鉴编码们 = [] } = {}, 语 = 当前语言()) {
  const 话 = 台词(语);
  const 模 = 模板表(语);
  const 收 = [];

  收.push(话.全站.开场白);
  摊平(玩法名字们, 收);
  摊平(话.穿衣服, 收);
  摊平(话.共用, 收);
  摊平(话.猜一猜, 收);
  摊平(话.贴水果, 收);
  // 闯关三两道题的题面：变量来自题库，值是定死的，展开成成品备上
  for (const 题 of 数字题库) {
    收.push(模.问对面数(题), 模.问加起来(题));
  }
  // 鼠标扫过水果盘念的水果名
  for (const 一个 of 水果们) 收.push(水果名(一个.槽位, 语));
  摊平(话.衣服图鉴, 收);
  摊平(数点点台词(图鉴编码们, 语), 收);
  // 做一件真的：整摊都备，只有「场景」是说给视觉模型听的，不进单子
  for (const [键, 值] of Object.entries(话.做一件真的)) {
    if (键 === '场景') continue;
    摊平(值, 收);
  }

  收.push(话.全站.重来问, 话.全站.重来了, 话.全站.不清了, 话.全站.换语言了);

  return [...new Set(收.filter((一句) => typeof 一句 === 'string' && 一句.trim()))];
}
