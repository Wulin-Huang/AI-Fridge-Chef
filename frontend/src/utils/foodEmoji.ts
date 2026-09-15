/** 常见食材 → emoji 映射（纯 UI 装饰用图标库，业务数据仍全部由 AI 生成）。 */

const MAP: Record<string, string> = {
  鸡蛋: '🥚', 鸭蛋: '🥚', 皮蛋: '🥚',
  西红柿: '🍅', 番茄: '🍅', 圣女果: '🍅',
  牛肉: '🥩', 牛腩: '🥩', 牛排: '🥩', 五花肉: '🥓', 猪肉: '🥓', 排骨: '🍖',
  火腿: '🍖', 培根: '🥓', 香肠: '🌭', 鸡肉: '🍗', 鸡翅: '🍗', 鸡腿: '🍗',
  鸭肉: '🦆', 鱼肉: '🐟', 三文鱼: '🐟', 虾: '🦐', 基围虾: '🦐',
  螃蟹: '🦀', 贝壳: '🐚', 鱿鱼: '🦑',
  西兰花: '🥦', 花菜: '🥦', 白菜: '🥬', 生菜: '🥬', 菠菜: '🥬', 油麦菜: '🥬',
  青菜: '🥬', 上海青: '🥬', 韭菜: '🥬', 空心菜: '🥬',
  土豆: '🥔', 马铃薯: '🥔', 红薯: '🍠', 山药: '🍠', 芋头: '🍠',
  胡萝卜: '🥕', 白萝卜: '🥕', 洋葱: '🧅', 大蒜: '🧄', 蒜: '🧄', 蒜苗: '🧄',
  姜: '🫚', 生姜: '🫚', 小葱: '🌿', 葱: '🌿', 大葱: '🌿', 香菜: '🌿', 芹菜: '🥬',
  青椒: '🫑', 辣椒: '🌶️', 彩椒: '🫑', 甜椒: '🫑', 茄子: '🍆', 黄瓜: '🥒',
  南瓜: '🎃', 冬瓜: '🥒', 丝瓜: '🥒', 苦瓜: '🥒',
  蘑菇: '🍄', 香菇: '🍄', 金针菇: '🍄', 杏鲍菇: '🍄', 平菇: '🍄', 木耳: '🍄',
  豆腐: '🧈', 豆干: '🧈', 豆腐皮: '🧈', 豆芽: '🌱', 黄豆: '🫘', 绿豆: '🫘',
  玉米: '🌽', 花生: '🥜', 毛豆: '🫛',
  米饭: '🍚', 大米: '🍚', 面条: '🍜', 面粉: '🌾', 面包: '🍞', 馒头: '🍞',
  饺子皮: '🥟', 米粉: '🍜', 粉丝: '🍜', 燕麦: '🌾',
  苹果: '🍎', 香蕉: '🍌', 橙子: '🍊', 橘子: '🍊', 柠檬: '🍋',
  葡萄: '🍇', 草莓: '🍓', 蓝莓: '🫐', 西瓜: '🍉', 芒果: '🥭', 菠萝: '🍍',
  桃子: '🍑', 梨: '🍐', 樱桃: '🍒', 猕猴桃: '🥝', 柚子: '🍊',
  牛奶: '🥛', 酸奶: '🥛', 奶酪: '🧀', 黄油: '🧈',
  食用油: '🫗', 酱油: '🍶', 醋: '🍶', 盐: '🧂', 糖: '🍬', 蜂蜜: '🍯',
  蚝油: '🍶', 料酒: '🍶', 番茄酱: '🍅', 豆瓣酱: '🌶️', 芝麻: '🫘', 芝麻酱: '🫘',
  芝士: '🧀', 咖喱: '🍛', 黑胡椒: '🧂',
}

export function foodEmoji(name: string): string {
  const n = name.trim()
  if (MAP[n]) return MAP[n]
  for (const key of Object.keys(MAP)) {
    if (n.includes(key) || key.includes(n)) return MAP[key]
  }
  return '🥘'
}

/** 计算距过期天数；无日期返回 null。 */
export function daysLeft(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null
  const exp = new Date(expiresAt + 'T00:00:00')
  if (Number.isNaN(exp.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - today.getTime()) / 86400000)
}

/** 食材分类（与后端保质期常识表同源的本地展示分类）。 */
const CATEGORY_RULES: Array<[string[], string]> = [
  [
    ['鸡蛋', '鸭蛋', '蛋', '牛肉', '牛腩', '牛排', '猪肉', '五花肉', '排骨', '鸡肉', '鸡翅', '鸡腿', '鸭肉', '火腿', '培根', '香肠', '肉'],
    '肉蛋',
  ],
  [
    ['鱼', '虾', '蟹', '贝', '鱿', '三文鱼', '带鱼'],
    '水产',
  ],
  [
    ['西红柿', '番茄', '西兰花', '花菜', '白菜', '生菜', '菠菜', '油麦菜', '青菜', '韭菜', '空心菜', '芹菜', '香菜', '葱', '蒜', '姜', '萝卜', '土豆', '红薯', '山药', '芋头', '洋葱', '青椒', '辣椒', '彩椒', '甜椒', '茄子', '黄瓜', '南瓜', '冬瓜', '丝瓜', '苦瓜', '菇', '蘑菇', '木耳', '豆芽', '玉米', '毛豆', '菜'],
    '蔬菜',
  ],
  [
    ['豆腐', '豆干', '豆皮', '牛奶', '酸奶', '奶酪', '芝士', '黄油', '豆'],
    '豆乳',
  ],
  [
    ['苹果', '香蕉', '橙', '橘', '柠檬', '葡萄', '莓', '西瓜', '芒', '菠萝', '桃', '梨', '樱桃', '猕猴桃', '柚', '车厘子', '榴莲', '椰子', '哈密瓜', '果'],
    '水果',
  ],
  [
    ['米饭', '大米', '面', '面粉', '面包', '馒头', '饺', '米粉', '粉丝', '燕麦', '花生', '芝麻'],
    '主食',
  ],
  [
    ['油', '酱', '醋', '盐', '糖', '蜂蜜', '料酒', '咖喱', '胡椒'],
    '调味',
  ],
]

const CATEGORY_EMOJI: Record<string, string> = {
  肉蛋: '🥩',
  水产: '🦐',
  蔬菜: '🥬',
  豆乳: '🥛',
  水果: '🍎',
  主食: '🍚',
  调味: '🧂',
}

export function foodCategory(name: string): string {
  for (const [keywords, category] of CATEGORY_RULES) {
    if (keywords.some((k) => name.includes(k) || k.includes(name))) return category
  }
  return '其他'
}

/** 预设分类（编辑弹层快捷选择用）。 */
export const PRESET_CATEGORIES = ['肉蛋', '水产', '蔬菜', '豆乳', '水果', '主食', '调味', '其他']

/**
 * 解析快速添加输入：支持逗号/空格分隔批量，名称后可跟 *数量。
 * 例："鸡蛋*6个 牛肉500g, 香菜" → [{name:"鸡蛋",quantity:"6个"},{name:"牛肉",quantity:"500g"},{name:"香菜"}]
 */
export function parseIngredientInput(raw: string): Array<{ name: string; quantity?: string }> {
  return raw
    .split(/[,，;；]+|\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const m = token.match(/^(.+?)[*×xX](.+)$/)
      if (m) {
        const name = m[1].trim()
        const quantity = m[2].trim()
        if (name && quantity) return { name, quantity }
      }
      // 支持紧贴写法：名称以数字开头结尾（如 牛肉500g、鸡蛋6个）
      const m2 = token.match(/^(.+?)(\d+(?:\.\d+)?(?:g|kg|克|斤|个|只|块|片|根|颗|粒|条|盒|瓶|袋|包|罐|把|张|杯|勺|瓣|段|份))$/)
      if (m2) {
        const name = m2[1].trim()
        if (name && !/^\d/.test(name)) return { name, quantity: m2[2] }
      }
      return { name: token }
    })
    .filter((d) => d.name)
}

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '🥘'
}
