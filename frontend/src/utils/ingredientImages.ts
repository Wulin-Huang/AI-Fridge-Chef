import okra from '../assets/ingredients/okra.jpg'
import egg from '../assets/ingredients/egg.jpg'
import tomato from '../assets/ingredients/tomato.jpg'
import beefBrisket from '../assets/ingredients/beef-brisket.jpg'
import broccoli from '../assets/ingredients/broccoli.jpg'
import scallion from '../assets/ingredients/scallion.jpg'
import potato from '../assets/ingredients/potato.jpg'
import carrot from '../assets/ingredients/carrot.jpg'
import porkBelly from '../assets/ingredients/pork-belly.jpg'
import tofu from '../assets/ingredients/tofu.jpg'
import shiitake from '../assets/ingredients/shiitake.jpg'
import garlic from '../assets/ingredients/garlic.jpg'
import greenPepper from '../assets/ingredients/green-pepper.jpg'

/** AI 生成的食材形象图（3D 黏土风）。精确匹配常见名，未收录的食材回退 emoji。 */
const IMAGE_MAP: Record<string, string> = {
  秋葵: okra,
  鸡蛋: egg,
  鸭蛋: egg,
  蛋: egg,
  西红柿: tomato,
  番茄: tomato,
  牛腩: beefBrisket,
  牛肉: beefBrisket,
  西兰花: broccoli,
  小葱: scallion,
  葱: scallion,
  土豆: potato,
  胡萝卜: carrot,
  五花肉: porkBelly,
  猪肉: porkBelly,
  豆腐: tofu,
  香菇: shiitake,
  蘑菇: shiitake,
  大蒜: garlic,
  蒜: garlic,
  青椒: greenPepper,
  辣椒: greenPepper,
}

/** 取食材形象图：精确名优先，其次"包含"匹配（如"有机鸡蛋"→鸡蛋图），无则返回 null。 */
export function ingredientImage(name: string): string | null {
  if (IMAGE_MAP[name]) return IMAGE_MAP[name]
  for (const key of Object.keys(IMAGE_MAP)) {
    if (name.includes(key)) return IMAGE_MAP[key]
  }
  return null
}
