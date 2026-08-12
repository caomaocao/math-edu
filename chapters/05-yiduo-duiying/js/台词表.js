// 台词表 —— 第5讲说给孩子听的每一句话，两门课各一份，键完全同构。
//
// 规矩与第 3/4 讲同一套（详见 chapters/04-shuzi-tuili/js/台词表.js 头）：句子写在这儿、
// 界面只挑不写；带变量的收模板不收成品；两张表键同构（漏译是红测试，不是孩子耳朵里的
// 一句中文）；读从合并视图 台词/模板 取，取哪门课由当前语言在读的那一刻决定。
//
// ==== 并行热点（票 02 的约定，预制补充）====
// 后票（04~08）只往 中台词/英台词 里**加自己那一摊**（摊名 = 站号），两张表一起加——
// 每站在四张表里都留了「摊位」注释行当锚点，**只替换自己的那几行**，别碰别站的；
// 全部台词() 会按站点表顺序自动收进预热单子，**不用回头改函数体**。
// 跨站共用的摊（报数 / 摆放）与带数模板（报数.教 / 摆放.教数）已开好（04 同款口径：
// 中文用 中文数()，英文用 英文数()，别手写「六」）；后票复用，别重复加。

import { 问答台词表 } from '/shared/js/问答.js';
import { 当前语言 } from '/shared/js/语言.js';
import { 中文数, 英文数 } from '/shared/js/数词.js';
import { 站点表 } from './站点表.js';

// ---------------------------------------------------------------------------
// 台词 —— 没有变量的整句
// ---------------------------------------------------------------------------

const 中台词 = {
  全站: {
    开场白: '欢迎来到森林营地野餐会！点一个营地站点，我们出发啦！',
    欢迎回来: '欢迎回来！营地的小伙伴们都在等你，接着玩吧！',
    得星: '太棒了，你得到一颗星星！',
    大庆祝: '哇！十颗星星全部集齐啦！篝火为你点亮，你是森林营地的大英雄！',
    还在施工: '这一站还在搭帐篷，先去别的地方玩吧！',
    重来问: '要把星星全部清空，重新开营吗？',
    重来了: '好啦，营地重新开张，我们从头玩！',
  },

  开营站: {
    开场: '小营员，欢迎来到森林营地！今天我们要学一个大本领：谁和谁是一对，一个又能配上几个！',
    学什么: '营地里呀，小动物要住进和自己颜色一样的帐篷；一只熊猫要吃两根竹子；八碗饭每人两碗，能分给几个人？果盘上横着数、竖着数，答案都一样。我们一站一站去发现！',
    去玩: '回到营地地图，点亮每一个站点，集齐十颗星星，篝火晚会见！',
  },

  // 摊位：帐篷站（票04）—— 判定不开口，词只有开场/转场/收尾；梯子话术在共用的 配对 摊
  帐篷站: {
    开场帐篷: '天快黑了，小动物们要回家睡觉啦！先点一只小动物，再点和它颜色一样的帐篷，送它回家！',
    帐篷好了: '四只小动物都住进了自己颜色的帐篷，晚安！',
    下雨啦: '听，哗啦啦，下雨啦！',
    开场雨伞: '小动物们要出门玩啦，得打伞才不会淋湿！点一只小动物，再点和它颜色一样的雨伞！',
    全都好了: '四把小伞都撑起来啦，谁也淋不着！帐篷站过关！',
    都好过了: '小动物们住得好好的，雨伞也挑好啦，去别的站玩吧！',
  },
  熊猫竹林: {
    开场: '熊猫竹林到啦！三只熊猫肚子饿得咕咕叫，一只熊猫要吃两根竹子。你看，第一只熊猫已经拿到两根啦！',
    动手: '请你给另外两只熊猫也摆上竹子，每只两根。点一下熊猫就放一根，放多了再点竹子拿回来。摆好了，摇一摇开饭铃！',
    问几根: '三只熊猫都开饭啦！它们一共吃了几根竹子？点一下麦克风，说给我听！',
    带数头: '我们两根两根地数过去，跟着亮光数！',
    换位头: '告诉你一个数数的小秘密，换个方向再数一遍——',
    收尾: '熊猫们吃得饱饱的，谢谢你！我们去下一站吧！',
  },
  兔子草地: {
    开场: '兔子草地到啦！十只小兔子排成两排晒太阳，每只小兔子头上都有两只长耳朵。',
    问耳朵: '你数一数，十只小兔子一共有几只耳朵？点一下麦克风，说给我听！',
    带数头: '我们按只带着数：一只兔子两只耳朵，两只兔子四只耳朵……跟着亮光数下去！',
    换位头: '耳朵还有另一种数法哦，看好啦——',
    收尾: '小兔子们朝你摆耳朵啦，谢谢你！我们去下一站吧！',
  },
  分饭站: {
    开场: '开饭啦！锅里有八碗香喷喷的米饭，小朋友们排好队，都等着吃饭呢！',
    A轮: '每个小朋友要吃两碗饭。点一个小朋友，就把两碗饭发给他；发错了再点他一下，饭就收回锅里。把锅里的饭发完吧！',
    B轮: '这一次大家胃口大啦，每个小朋友要吃四碗饭！再把八碗饭发一发，看看这回够几个人吃。',
    锅空: '锅发空啦！',
    问几人: '数一数，饭分给了几个小朋友？点一下麦克风，说给我听！',
    提示: '我们把吃上饭的小朋友一个一个数过去：',
    收尾: '分饭真公平，每个小朋友都吃得饱饱的，去下一站吧！',
  },
  喂食站: {
    开场: '喂食站到啦！小狗们分成三群排队等开饭，一只小狗要吃一根骨头。你看，第一群的两只小狗已经有两根骨头啦！',
    狗动手: '请你给另外两群小狗的食盘也摆上骨头，一只小狗一根骨头。点一下食盘放一根，放多了再点骨头拿回来。摆好了摇开饭铃！',
    企鹅开场: '企鹅们也饿啦！一只企鹅要吃两条小鱼，第一只企鹅已经有两条啦。请你喂喂另外三只企鹅，每只两条，喂好摇开饭铃！',
    问几条: '企鹅们吃得真香！它们一共吃了几条小鱼？点一下麦克风，说给我听！',
    带数头: '我们两条两条地数过去，跟着亮光数！',
    收尾: '小狗和企鹅都吃饱啦！你真是营地里能干的小小饲养员！',
  },
  松果虫虫站: {
    开场: '这一站有三道分一分的题目，松鼠、小狗和大公鸡都来啦！',
    松鼠轮: '一只松鼠要吃三颗松果。看看每个格子里有几只松鼠，点亮框的空格子，给它们摆上正好够吃的松果，摆好摇开饭铃！',
    骨头轮: '现在反过来啦！四根骨头正好喂一只小狗。看看每个格子里有几根骨头，摆上正好能把骨头吃完的小狗，摆好摇开饭铃！',
    毛毛虫轮: '大公鸡来吃虫子啦！三条毛毛虫正好喂一只大公鸡。看看每个格子里有几条毛毛虫，摆上正好能把虫子吃完的大公鸡！',
    分堆提示: '看，食物一份一份分成了小堆！数数有几堆，就摆几只！',
    收尾: '正着分、反着分你都会啦，真了不起！',
  },
  // 摊位：果盘数数（票07）—— 「几个几」这句只由网站说破，孩子只报单数字
  果盘数数: {
    开场: '欢迎来到果盘数数！果子摆得整整齐齐，我们来学两种数法：横着数，竖着数！',
    盘开场们: ['第一盘是苹果！', '第二盘来啦，是橘子！', '最后一盘是樱桃，果子更多咯！'],
    带练头: '我先演一遍横着数，你仔细看哦！',
    演示数排里: '横着数，先数一排有几个。',
    演示数几排: '再数一数，一共有几排。',
    该你啦: '看明白了吗？现在换你来数啦！',
    问排里: '横着数，一排有几个呀？',
    问几排: '那一共有几排呢？',
    换竖: '横着数完啦！我们换个方向，竖着数试试！',
    问列里: '竖着数，一列有几个呀？',
    问几列: '那一共有几列呢？',
    提示头: '别急，我们一个一个数！',
    盘收尾: '你看！横着数、竖着数，数出来一样多！',
    收尾: '果盘数数全部过关！两种数法你都会啦！',
  },
  // 摊位：腿腿站（票07）—— 问句带只数进模板摊，这儿只收整句
  腿腿站: {
    开场: '欢迎来到腿腿站！小动物的腿呀，藏着数数的小秘密！',
    提示头: '别急，我们一只一只数过去！',
    换下一位: '下一位朋友来咯，仔细看！',
    收尾: '腿腿站过关！小动物有几条腿，都数不倒你啦！',
  },
  蛋糕派对: {
    开场: '哇，营地里开蛋糕派对啦！大盘子上有二十块蛋糕，小朋友们都想吃！',
    发法: '每个小朋友分四块蛋糕。点一个小朋友，就把四块蛋糕发给他；发错了再点他一下，蛋糕就收回盘子里。把蛋糕全部发完吧！',
    盘空: '蛋糕发完啦！',
    问几人: '数一数，蛋糕分给了几个小朋友？点一下麦克风，说给我听！',
    提示: '我们把吃到蛋糕的小朋友一个一个数过去：',
    收尾: '派对真热闹，每个小朋友都吃到了蛋糕，你分得真棒！',
  },
  // 摊位：Boss（票08）—— 篝火晚会五族混合连闯 + 青蛙合唱团彩蛋。混合关的判定/梯子话术
  // 各走共用摊（配对 / 摆放 / 报数 / 问答三摊），这儿只落 Boss 自己的开场、关头、转场、
  // 通关与彩蛋几句；彩蛋里 4…40 走数词直念，>99 的念法在下面的 Boss 模板摊。
  Boss: {
    开场: '最后一关到啦——篝火晚会大闯关！把学过的本领都用上，闯过五关，就能点亮最后一颗星星！',
    配对头: '天黑啦，小动物们要回帐篷睡觉！先点一只小动物，再点和它颜色一样的帐篷，送它回家。',
    喂食头: '企鹅们又饿啦！给每只企鹅摆上两条小鱼，摆好摇一摇开饭铃！',
    发饭头: '锅里有米饭，每个小朋友吃两碗。点一个小朋友就把饭发给他，把锅里的饭发完吧！',
    几个几问: '看这一盘苹果！横着数，一排有几个呀？点一下麦克风，说给我听！',
    腿数问: '三只小猪排好队，一共有几条腿呀？点一下麦克风，说给我听！',
    过关: '闯过一关！下一关！',
    通关: '五关全部闯过啦，你太厉害了！',
    蛙问: '嘘——看，一只小青蛙跳出来啦！一只青蛙有几条腿呀？点一下麦克风，说给我听！',
    蛙一排头: '答对啦！看，好多青蛙排成一排蹦出来，我们一起数它们的腿！',
    满屏头: '哇，青蛙越来越多，铺满了整个营地！听我数——',
    满屏说破: '四百！四百条青蛙腿！你看，一个一个数，也能数到好大好大的数！',
    收尾: '篝火升上天空，青蛙们为你唱起歌——你是森林营地最棒的小英雄！',
  },
  // 摊位：配对（共用摊，票04；现在只有帐篷站在用——判定纯本地按颜色，词儿全在这儿）
  配对: {
    错1: '哦哦，颜色不一样哦。再看看它是什么颜色的？',
    提示头: '别急，我们把颜色一个一个看过去：',
    色绿: '绿色的',
    色红: '红色的',
    色蓝: '蓝色的',
    色棕: '棕色的',
    演示头: '看好啦，我来帮剩下的小伙伴找到家：',
    说破: '瞧，颜色一样的才是一对——绿色配绿色，红色配红色！',
  },

  // 报数题共用（熊猫竹林 / 兔子草地 / 分饭 / 喂食 / 果盘 / 腿腿 / 蛋糕 / Boss 都在说）
  报数: {
    接下来: '一共是几呢？点一下麦克风，说给我听！',
  },

  // 摆放 / 发饭共用的反馈（熊猫竹林 / 喂食 / 松果虫虫 / 分饭 / 蛋糕派对 的动手引擎在说）
  摆放: {
    对: '摆对啦，开饭咯！',
    错1: '差一点点，再数一数看！',
    提示头: '我们一组一组数过去：',
    演示头: '看好啦，应该是这么多：',
  },
};

const 英台词 = {
  全站: {
    开场白: 'Welcome to the forest camp picnic! Pick a camp spot and off we go!',
    欢迎回来: 'Welcome back! Your camp friends have been waiting. Let us keep playing!',
    得星: 'Wonderful, you got a star!',
    大庆祝: 'Wow! All ten stars are yours! The campfire is lit just for you. You are the hero of the forest camp!',
    还在施工: 'This spot is still putting up its tent. Let us play somewhere else first!',
    重来问: 'Do you want to clear all the stars and open the camp all over again?',
    重来了: 'All right, the camp opens fresh, and we start from the very beginning!',
  },

  开营站: {
    开场: 'Little camper, welcome to the forest camp! Today we learn a big new skill: what goes with what, and how many one friend needs!',
    学什么: 'Around the camp, each animal moves into the tent of its own colour; one panda eats two bamboo shoots; eight bowls of rice, two bowls each — how many friends can eat? And on the fruit plates, counting across or counting down gives the same answer. We will find out, station by station!',
    去玩: 'Go back to the camp map, light up every spot, collect all ten stars, and see you at the campfire party!',
  },

  // 摊位：帐篷站（票04 英）
  帐篷站: {
    开场帐篷: 'It is getting dark, and the little animals want to go to bed! Tap an animal, then tap the tent of the same colour to walk it home!',
    帐篷好了: 'All four animals are snug in tents of their own colour. Good night!',
    下雨啦: 'Listen! Pitter-patter — it is raining!',
    开场雨伞: 'The animals want to go out and play, so they need umbrellas! Tap an animal, then tap the umbrella of the same colour!',
    全都好了: 'All four umbrellas are up, and nobody gets wet! The tent camp is done!',
    都好过了: 'The animals are all cozy and their umbrellas are ready. Let us play somewhere else!',
  },
  熊猫竹林: {
    开场: 'Welcome to the panda bamboo grove! Three pandas are rumbling with hunger, and each panda eats two bamboo shoots. Look, the first panda already has two!',
    动手: 'Now set out bamboo for the other two pandas, two shoots each. Tap a panda to give one shoot, and tap a shoot to take it back. When everyone is ready, ring the dinner bell!',
    问几根: 'All three pandas are eating! How many bamboo shoots did they eat in all? Tap the microphone and tell me!',
    带数头: 'Let us count them two by two. Follow the glow!',
    换位头: 'Here is a little counting secret. Let us count the other way!',
    收尾: 'The pandas are full and happy. Thank you! On to the next spot!',
  },
  兔子草地: {
    开场: 'Welcome to the bunny meadow! Ten bunnies sit in two rows in the sunshine, and every bunny has two long ears.',
    问耳朵: 'Now count: how many ears do ten bunnies have in all? Tap the microphone and tell me!',
    带数头: 'Let us count bunny by bunny: one bunny has two ears, two bunnies have four. Follow the glow!',
    换位头: 'There is another way to count the ears. Watch closely!',
    收尾: 'The bunnies wiggle their ears to thank you! On to the next spot!',
  },
  分饭站: {
    开场: 'Dinner time! There are eight bowls of steaming rice in the pot, and the children are lining up, ready to eat!',
    A轮: 'Each child eats two bowls of rice. Tap a child to hand them two bowls; tap them again to put the rice back in the pot. Hand out every bowl in the pot!',
    B轮: 'This time everyone is extra hungry: each child eats four bowls! Hand out the eight bowls again and see how many children get dinner now.',
    锅空: 'The pot is empty!',
    问几人: 'Count with me: how many children got rice? Tap the microphone and tell me!',
    提示: 'Let us count the children who got rice, one by one:',
    收尾: 'What fair sharing! Every child has a full tummy. Off to the next spot!',
  },
  喂食站: {
    开场: 'Welcome to the feeding spot! The puppies wait in three groups, and each puppy eats one bone. Look, the two puppies in the first group already have two bones!',
    狗动手: 'Now fill the bowls for the other two groups, one bone for each puppy. Tap a bowl to add a bone, and tap a bone to take it back. When every puppy has one, ring the dinner bell!',
    企鹅开场: 'The penguins are hungry too! Each penguin eats two little fish, and the first penguin already has two. Please feed the other three penguins, two fish each, then ring the dinner bell!',
    问几条: 'The penguins love their fish! How many fish did they eat in all? Tap the microphone and tell me!',
    带数头: 'Let us count them two by two. Follow the glow!',
    收尾: 'The puppies and penguins are all full! What a wonderful little feeder you are!',
  },
  松果虫虫站: {
    开场: 'This spot has three sharing puzzles. The squirrels, the puppies and the big rooster are all here!',
    松鼠轮: 'One squirrel eats three pinecones. See how many squirrels are in each box, tap the boxes with the glowing frame to give them just enough pinecones, then ring the dinner bell!',
    骨头轮: 'Now we flip it around! Four bones feed exactly one puppy. See how many bones are in each box, place just enough puppies to eat them all up, then ring the dinner bell!',
    毛毛虫轮: 'Here comes the big rooster! Three wigglers feed exactly one rooster. See how many wigglers are in each box, and place just enough roosters to eat them all up!',
    分堆提示: 'Look, the food is split into little piles, one share each! Count the piles — that is how many friends to place!',
    收尾: 'Sharing forwards and sharing backwards — you can do both now. Amazing!',
  },
  // 摊位：果盘数数（票07 英）
  果盘数数: {
    开场: 'Welcome to the fruit plates! The fruit sits in neat rows. Let us learn two ways to count: across, and down!',
    盘开场们: ['The first plate is apples!', 'Here comes the second plate: oranges!', 'The last plate is cherries, even more fruit!'],
    带练头: 'Watch me count across first. Look carefully!',
    演示数排里: 'Counting across, first count how many are in one row.',
    演示数几排: 'Now count how many rows there are.',
    该你啦: 'Did you see that? Now it is your turn to count!',
    问排里: 'Counting across, how many are in one row?',
    问几排: 'And how many rows are there?',
    换竖: 'We counted across! Now let us try the other way: counting down!',
    问列里: 'Counting down, how many are in one column?',
    问几列: 'And how many columns are there?',
    提示头: 'No rush, let us count them one by one!',
    盘收尾: 'Look! Counting across or counting down, you get the same amount!',
    收尾: 'You finished all the fruit plates! Now you know both ways to count!',
  },
  // 摊位：腿腿站（票07 英）
  腿腿站: {
    开场: 'Welcome to the little legs quiz! Animal legs are hiding a counting secret!',
    提示头: 'No rush, let us count them one by one!',
    换下一位: 'Here comes the next friend. Watch closely!',
    收尾: 'You beat the little legs quiz! No animal legs can trick you now!',
  },
  蛋糕派对: {
    开场: 'Wow, the camp is having a cake party! There are twenty pieces of cake on the big plate, and everyone wants some!',
    发法: 'Each child gets four pieces of cake. Tap a child to hand them four pieces; tap them again to put the cake back on the plate. Hand out all the cake!',
    盘空: 'All the cake is handed out!',
    问几人: 'Count with me: how many children got cake? Tap the microphone and tell me!',
    提示: 'Let us count the children who got cake, one by one:',
    收尾: 'What a fun party! Every child got some cake, and you shared it out perfectly!',
  },
  // 摊位：Boss（票08 英）
  Boss: {
    开场: 'The last challenge is here — the campfire showdown! Use everything you have learned. Beat five rounds and light the very last star!',
    配对头: 'It is dark now, and the animals want to go to bed! Tap an animal, then tap the tent of the same colour to walk it home.',
    喂食头: 'The penguins are hungry again! Give each penguin two little fish, then ring the dinner bell!',
    发饭头: 'There is rice in the pot, two bowls for each child. Tap a child to hand out the rice, and empty the pot!',
    几个几问: 'Look at this plate of apples! Counting across, how many are in one row? Tap the microphone and tell me!',
    腿数问: 'Three little piglets line up. How many legs in all? Tap the microphone and tell me!',
    过关: 'One round done! Next round!',
    通关: 'You beat all five rounds. You are amazing!',
    蛙问: 'Shh — look, a little frog hopped out! How many legs does one frog have? Tap the microphone and tell me!',
    蛙一排头: 'That is right! Look, a whole row of frogs hops out. Let us count their legs together!',
    满屏头: 'Wow, more and more frogs, filling the whole camp! Listen to me count —',
    满屏说破: 'Four hundred! Four hundred frog legs! See, counting one by one, you can reach a really big number!',
    收尾: 'The campfire soars into the sky and the frogs sing for you — you are the greatest little hero of the forest camp!',
  },
  // 摊位：配对（票04 英）
  配对: {
    错1: 'Oops, the colours do not match. Look again — what colour is it?',
    提示头: 'No hurry. Let us look at the colours one by one:',
    色绿: 'Green!',
    色红: 'Red!',
    色蓝: 'Blue!',
    色棕: 'Brown!',
    演示头: 'Watch me — I will help the rest find their homes:',
    说破: 'See? Same colour makes a pair — green goes with green, and red goes with red!',
  },

  报数: {
    接下来: 'How many in all? Tap the microphone and tell me!',
  },

  摆放: {
    对: 'That is right, time to eat!',
    错1: 'So close, count them again!',
    提示头: 'Let us count them group by group:',
    演示头: 'Watch, it should be this many:',
  },
};

// ---------------------------------------------------------------------------
// 模板 —— 句子里有变量（多半是一个数），到玩到那一步才知道。
// 共用两摊（报数.教 / 摆放.教数）已备好；站要自己的带数句就在自己的模板摊位落
// （键、签名两语必须一一对上——测试逐键比对，漏一个就红）。
// ---------------------------------------------------------------------------

const 中模板 = {
  报数: {
    教: (n) => `是${中文数(n)}。跟我数一遍：${中文数(n)}！`,
  },
  摆放: {
    教数: (n) => `应该放${中文数(n)}个哦！`,
  },
  // 帐篷站不带数（配对按颜色判），票04 按约不落模板摊。
  // 换位说破：数值从站点表台账递进来（3,3,6 / 10,10,20），不在词里焊死第二份。
  // 喂食站没有带数的句子，不落模板摊（票 05 按约删掉占位）。
  熊猫竹林: {
    换位说破: (甲, 乙, 总) => `左手${中文数(甲)}根，右手${中文数(乙)}根——${中文数(甲)}加${中文数(乙)}也是${中文数(总)}！`,
  },
  兔子草地: {
    换位说破: (甲, 乙, 总) => `左边的耳朵${中文数(甲)}只，右边的耳朵${中文数(乙)}只——${中文数(甲)}加${中文数(乙)}也是${中文数(总)}！`,
  },
  // （票06 三站没有带数模板：带数的句子全走共享的 报数.教 / 摆放.教数，
  //   提示带数用 数词 直念 —— 按锚点口径把摊位行销了。）
  // 模板摊位：果盘数数/腿腿站（票07）。量词前的 2 要念「两」（两个三/两排/两条腿），
  // 不是「二」——所以量词位不直接用 中文数()，句里带个小拐弯；纯数数（一、二、三）仍是 中文数。
  果盘数数: {
    排里破: (n) => `一排有${n === 2 ? '两' : 中文数(n)}个！`,
    几排破: (n) => `一共${n === 2 ? '两' : 中文数(n)}排！`,
    横破: (几个, 几) => `横着数，是${几个 === 2 ? '两' : 中文数(几个)}个${中文数(几)}！`,
    竖破: (几个, 几) => `竖着数，是${几个 === 2 ? '两' : 中文数(几个)}个${中文数(几)}！`,
  },
  腿腿站: {
    小鸡开场: (腿) => `看，小鸡来啦！一只小鸡有${腿 === 2 ? '两' : 中文数(腿)}条腿。`,
    小鸡问: (只数) => `${只数 === 2 ? '两' : 中文数(只数)}只小鸡排排站，一共有几条腿呀？`,
    小猪开场: (腿) => `小猪也来啦！一只小猪有${腿 === 2 ? '两' : 中文数(腿)}条腿。`,
    小猪问: (只数) => `${只数 === 2 ? '两' : 中文数(只数)}只小猪排好队，一共有几条腿呀？`,
  },
  // 模板摊位：Boss（票08）—— 青蛙彩蛋一排一声的念法。40…400 都是台账 彩蛋 顶出来的整数，
  // 共享 数词 只到 99（>99 会回 null），所以 >99 的落这儿；≤99 的顺手也收进来，念法齐整。
  // 屏上出的是阿拉伯数字（数字豁免），这儿只管嘴上怎么念。表覆盖 满屏排数列() 的每个值，
  // 缺了 boss.test.js 立刻红（数改了、这儿没跟上就炸出来）。
  Boss: {
    念大: (n) => ({
      40: '四十', 80: '八十', 120: '一百二十', 160: '一百六十', 200: '两百',
      240: '两百四十', 280: '两百八十', 320: '三百二十', 360: '三百六十', 400: '四百',
    })[n] ?? String(n),
  },
};

const 英模板 = {
  报数: {
    教: (n) => `It is ${英文数(n)}. Count it with me: ${英文数(n)}!`,
  },
  摆放: {
    教数: (n) => `It should be ${英文数(n)}!`,
  },
  熊猫竹林: {
    换位说破: (甲, 乙, 总) => `${英文数(甲)} in the left paws, ${英文数(乙)} in the right paws. ${英文数(甲)} plus ${英文数(乙)} is ${英文数(总)} too!`,
  },
  兔子草地: {
    换位说破: (甲, 乙, 总) => `${英文数(甲)} ears on the left, ${英文数(乙)} ears on the right. ${英文数(甲)} plus ${英文数(乙)} makes ${英文数(总)} too!`,
  },
  // （票06 三站没有带数模板 —— 同中文表，摊位行销了。）
  // 模板摊位：果盘数数/腿腿站（票07 英）。「几个几」的英文口径定稿用 "N groups of M"
  // （不用 "N sixes"——groups of 对任何数都顺口，也是英文课堂的标准说法）。
  果盘数数: {
    排里破: (n) => `There are ${英文数(n)} in one row!`,
    几排破: (n) => `${英文数(n)} rows in all!`,
    横破: (几个, 几) => `Counting across, that is ${英文数(几个)} groups of ${英文数(几)}!`,
    竖破: (几个, 几) => `Counting down, that is ${英文数(几个)} groups of ${英文数(几)}!`,
  },
  腿腿站: {
    小鸡开场: (腿) => `Look, here come the chicks! One chick has ${英文数(腿)} legs.`,
    小鸡问: (只数) => `${英文数(只数)} little chicks stand in a row. How many legs in all?`,
    小猪开场: (腿) => `Here come the piglets! One piglet has ${英文数(腿)} legs.`,
    小猪问: (只数) => `${英文数(只数)} little piglets line up. How many legs in all?`,
  },
  // 模板摊位：Boss（票08 英）—— 同中文摊，覆盖 满屏排数列() 每个值。
  Boss: {
    念大: (n) => ({
      40: 'forty', 80: 'eighty', 120: 'one hundred twenty', 160: 'one hundred sixty', 200: 'two hundred',
      240: 'two hundred forty', 280: 'two hundred eighty', 320: 'three hundred twenty',
      360: 'three hundred sixty', 400: 'four hundred',
    })[n] ?? String(n),
  },
};

// ---------------------------------------------------------------------------
// 两张表合成一份「按当前语言取值」的视图（做法同第 3/4 讲）
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
 * 开场白 → 各站名字（划过地图节点念的）→ 共享问答三摊 → 各站的摊（按站点表顺序，
 * 自动收——后票加了摊就自动进单子）→ 不挂站号的公共摊（报数/摆放…）→ 收尾几句。
 */
export function 全部台词({ 环节名们 = [], 语 = 当前语言() } = {}) {
  const 表 = 语 === 'en' ? 英台词 : 中台词;
  const 收 = [];

  收.push(表.全站.开场白, 表.全站.欢迎回来);
  摊平(环节名们, 收);
  摊平(问答台词表(语), 收); // 报数题走共享问答，捎上它那三摊

  for (const { 号 } of 站点表) if (表[号]) 摊平(表[号], 收);
  for (const [摊名, 一摊] of Object.entries(表)) {
    if (摊名 === '全站' || 站点表.some((条) => 条.号 === 摊名)) continue;
    摊平(一摊, 收);
  }

  // 带数的模板句按射程整档备上（04 先例）。本讲报数射程 ≤20；
  // 彩蛋的 40~400 只演不考，不进判对也不整档备。
  const 模 = 语 === 'en' ? 英模板 : 中模板;
  for (let n = 0; n <= 20; n += 1) 收.push(模.报数.教(n), 模.摆放.教数(n));

  收.push(表.全站.得星, 表.全站.大庆祝, 表.全站.还在施工);
  收.push(表.全站.重来问, 表.全站.重来了);

  return [...new Set(收.filter((一句) => typeof 一句 === 'string' && 一句.trim()))];
}
