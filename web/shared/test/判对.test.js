import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 判对, 建词表, 抽行列, 抽数字, 判行列, 热词, 说法 } from '../js/判对.js';

test('标准说法直接判对', () => {
  assert.equal(判对('上面', ['上面']), '对');
  assert.equal(判对('前面', ['前面']), '对');
  assert.equal(判对('东', ['东']), '对');
});

test('童声变体都算对：上边/上头/在上面呀', () => {
  assert.equal(判对('上边', ['上面']), '对');
  assert.equal(判对('上头', ['上面']), '对');
  assert.equal(判对('在上面呀', ['上面']), '对');
  assert.equal(判对('嗯……我觉得是左边', ['左边']), '对');
  assert.equal(判对('底下', ['下面']), '对');
});

test('自我纠正按最后一次说的判：「上面…不对，下面！」', () => {
  assert.equal(判对('上面不对下面', ['下面']), '对');
  assert.equal(判对('左边，等等，是右边', ['右边']), '对');
  assert.equal(判对('下面不对上面', ['下面']), '错');
});

test('答错了要判错，不能蒙混', () => {
  assert.equal(判对('下面', ['上面']), '错');
  assert.equal(判对('西边', ['东']), '错');
});

test('斜方位不被正方位抢先吃掉：「东南」≠「南」', () => {
  assert.equal(判对('东南', ['南']), '错');
  assert.equal(判对('东南', ['东南']), '对');
  assert.equal(判对('是西北边', ['西北']), '对');
});

test('名词「东西」不误伤方位判定', () => {
  assert.equal(判对('什么东西呀', ['西']), '不确定');
  assert.equal(判对('我不知道', ['上面']), '不确定');
  assert.equal(判对('', ['上面']), '不确定');
});

test('生活方位别名：右上=东北', () => {
  assert.equal(判对('右上', ['东北']), '对');
});

// ------------------------------------------------------------------ 英文说法

test('英文标准说法直接判对', () => {
  assert.equal(判对('up', ['上面']), '对');
  assert.equal(判对('down', ['下面']), '对');
  assert.equal(判对('left', ['左边']), '对');
  assert.equal(判对('right', ['右边']), '对');
  assert.equal(判对('east', ['东']), '对');
  assert.equal(判对('north', ['北']), '对');
});

test('英文斜方位不被正方位抢先吃掉：northeast ≠ north', () => {
  assert.equal(判对('northeast', ['东北']), '对');
  assert.equal(判对('northeast', ['北']), '错');
  assert.equal(判对('north east', ['东北']), '对'); // 分开念的也是东北
  assert.equal(判对('southwest', ['西南']), '对');
  assert.equal(判对('southwest', ['西']), '错');
});

test('英文生活方位说法：upper right / bottom left / on top', () => {
  assert.equal(判对('upper right', ['东北']), '对');
  assert.equal(判对('top right', ['东北']), '对');
  assert.equal(判对('bottom left', ['西南']), '对');
  assert.equal(判对('on top', ['上面']), '对');
  assert.equal(判对('at the bottom', ['下面']), '对');
  assert.equal(判对('in front', ['前面']), '对');
});

test('英文口头语不影响判定：um / uh / like / I think / maybe', () => {
  assert.equal(判对("um, I think it's the left one", ['左边']), '对');
  assert.equal(判对('uh... maybe north?', ['北']), '对');
  assert.equal(判对('like, on the east side', ['东']), '对');
  assert.equal(判对('well, um, hmm', ['东']), '不确定');
});

test('英文自我纠正也按最后一次说的判', () => {
  assert.equal(判对('up... no wait, down!', ['下面']), '对');
  assert.equal(判对('up, no, down', ['上面']), '错');
  assert.equal(判对('east, sorry, west', ['西']), '对');
});

// 「right」既是方向又是「对不对」的口头确认 —— 后者不能被当成「右边」
test('确认口气的 right 不算方向：「north, right?」还是北', () => {
  assert.equal(判对('north, right?', ['北']), '对');
  assert.equal(判对("that's right, it's the east", ['东']), '对');
  assert.equal(判对('right', ['右边']), '对'); // 真答右边照旧
});

test('「over there」是「在那边」，不是「上面」——没答方向就得判不确定', () => {
  assert.equal(判对('over there', ['上面']), '不确定');
  assert.equal(判对('above the box', ['上面']), '对');
});

// 接受集合恒为两语并集：判对与当前语言模式无关（反馈语言才跟模式走）
test('两语并集：同一道题，中文答案和英文答案都判对', () => {
  assert.equal(判对('东边', ['东']), '对');
  assert.equal(判对('east', ['东']), '对');
  assert.equal(判对('左上', ['西北']), '对');
  assert.equal(判对('upper left', ['西北']), '对');
  // 判错也两语通吃：答的是别的方向，哪种语言都算答错
  assert.equal(判对('west', ['东']), '错');
  assert.equal(判对('西边', ['东']), '错');
});

test('两语并集：竞争集按规范名缩圈，与说答案用哪种语言无关', () => {
  const 圈 = { 竞争: ['上面', '下面'] };
  assert.equal(判对('down', ['上面'], 圈), '错');
  assert.equal(判对('left', ['上面'], 圈), '不确定');
  assert.equal(判对('左边', ['上面'], 圈), '不确定');
});

test('改口答两个方向不会被粘成第三个方向：「north, no, east」', () => {
  assert.equal(判对('north, no, east', ['东']), '对');
  assert.equal(判对('north, no, east', ['东北']), '错');
});

test('自定义词表：动物名与别名', () => {
  const 词表 = 建词表([
    { 答: '松鼠', 别名: ['小松鼠'] },
    { 答: '长颈鹿', 别名: ['小长颈鹿', '鹿'] },
  ]);
  assert.equal(判对('是小松鼠', ['松鼠'], { 词表 }), '对');
  assert.equal(判对('长颈鹿的家', ['松鼠'], { 词表 }), '错');
  assert.equal(判对('大象', ['松鼠'], { 词表 }), '不确定');
});

test('自定义词表也吃英文说法：规范名照旧是中文', () => {
  const 词表 = 建词表([
    { 答: '松鼠', 别名: ['小松鼠'], 英: ['squirrel', 'little squirrel'] },
    { 答: '长颈鹿', 别名: ['鹿'], 英: 'giraffe' },
  ]);
  assert.equal(判对('a squirrel', ['松鼠'], { 词表 }), '对');
  assert.equal(判对('little squirrel', ['松鼠'], { 词表 }), '对');
  assert.equal(判对('是小松鼠', ['松鼠'], { 词表 }), '对');
  assert.equal(判对('giraffe', ['松鼠'], { 词表 }), '错');
  assert.equal(判对('elephant', ['松鼠'], { 词表 }), '不确定');
});

test('竞争集可以缩小误判圈', () => {
  // 本题只有 上面/下面 两个候选，孩子说「左边」不算答错、算没听清
  assert.equal(判对('左边', ['上面'], { 竞争: ['上面', '下面'] }), '不确定');
});

// ASR 热词：转写前喂给识别的候选答案。两语都得喂，不然英文那半永远转不准
test('热词把规范名摊成两语说法', () => {
  const 词 = 热词(['东北', '北']);
  assert.ok(词.includes('东北'), 词);
  assert.ok(词.includes('northeast'), 词);
  assert.ok(词.includes('north'), 词);
  assert.equal(热词([]), '');
});

test('热词也认自定义词表', () => {
  const 词表 = 建词表([{ 答: '松鼠', 别名: ['小松鼠'], 英: ['squirrel'] }]);
  const 词 = 热词(['松鼠'], 词表);
  assert.ok(词.includes('小松鼠'), 词);
  assert.ok(词.includes('squirrel'), 词);
  // 词表里没有的规范名照原样喂进去（自定义答案不一定都进词表）
  assert.ok(热词(['苹果'], 词表).includes('苹果'));
});

test('抽行列：中文数字、阿拉伯数字、带不带「第」都行', () => {
  assert.deepEqual(抽行列('第三行第二列'), { 行: 3, 列: 2 });
  assert.deepEqual(抽行列('第3行第5列'), { 行: 3, 列: 5 });
  assert.deepEqual(抽行列('二行四列'), { 行: 2, 列: 4 });
  assert.deepEqual(抽行列('嗯，3 和 2'), { 行: 3, 列: 2 });
});

test('判行列', () => {
  assert.equal(判行列('第一行第五列', 1, 5), '对');
  assert.equal(判行列('第二行第五列', 1, 5), '错');
  assert.equal(判行列('不知道', 1, 5), '不确定');
});

test('抽数字取最后一个：「不是2，是3」→ 3', () => {
  assert.equal(抽数字('不是二，是三'), 3);
  assert.equal(抽数字('第4列'), 4);
  assert.equal(抽数字('嗯嗯'), null);
});

test('抽行列吃英文：数字词、序数词、row/column 在数字前后都认', () => {
  assert.deepEqual(抽行列('row three, column two'), { 行: 3, 列: 2 });
  assert.deepEqual(抽行列('row 3 column 5'), { 行: 3, 列: 5 });
  assert.deepEqual(抽行列('third row, second column'), { 行: 3, 列: 2 });
  assert.deepEqual(抽行列('um, the 2nd row and the 4th column'), { 行: 2, 列: 4 });
  assert.deepEqual(抽行列('uh... three and two'), { 行: 3, 列: 2 });
});

test('英文行列题：判行列与抽数字', () => {
  assert.equal(判行列('row one column five', 1, 5), '对');
  assert.equal(判行列('row two, column five', 1, 5), '错');
  assert.equal(判行列("i don't know", 1, 5), '不确定');
  assert.equal(抽数字('um, not two... three!'), 3);
  assert.equal(抽数字('the fourth column'), 4);
  assert.equal(抽数字('ten'), 10);
});

/*
  说法() —— 答对之后要用当前这门课把正确的词再念一遍（英文课上答对一次就多听一次
  northeast，词汇是这么记住的）。规范名永远是中文，所以「翻成本门课怎么念」这道工序
  必须自己是对的，错了孩子听见的就是夹生话。
*/
test('说法：中文课就是规范名本身', () => {
  assert.equal(说法('东北', 'cn'), '东北');
  assert.equal(说法('上面', 'cn'), '上面');
  // 词典里没有的临时答案，中文课照样奉还
  assert.equal(说法('松鼠', 'cn'), '松鼠');
});

test('说法：英文课挑出词条里第一个不含汉字的说法', () => {
  assert.equal(说法('东北', 'en'), 'northeast');
  assert.equal(说法('东', 'en'), 'east');
  assert.equal(说法('上面', 'en'), 'up');
  assert.equal(说法('左边', 'en'), 'left');
  // 「右上」是东北的中文别名，不能被当成英文说法挑走
  assert.ok(!/[一-龥]/.test(说法('东北', 'en')));
});

test('说法：自定义词表（动物名这类）也翻得出来', () => {
  const 表 = 建词表([{ 答: '松鼠', 别名: ['小松鼠'], 英: ['squirrel', 'little squirrel'] }]);
  assert.equal(说法('松鼠', 'en', 表), 'squirrel');
  assert.equal(说法('松鼠', 'cn', 表), '松鼠');
});

test('说法：英文课上翻不出来的给 null（调用方好退回原样念）', () => {
  const 表 = 建词表([{ 答: '洋葱', 别名: ['葱头'] }]); // 没给英文
  assert.equal(说法('洋葱', 'en', 表), null);
  assert.equal(说法('没这个词', 'en'), null);
});
