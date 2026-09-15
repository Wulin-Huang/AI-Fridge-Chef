/**
 * 流式部分 JSON 渐进解析器。
 *
 * SSE 推送的是 DeepSeek 逐步生成的 JSON 文本片段，本模块在 JSON 尚未闭合时
 * 提前提取已完成的字段与数组元素，让 UI 呈现"AI 正在书写"的打字机效果：
 * 菜名先出现 → 描述逐字增长 → 用料/步骤逐条填入。
 */
import type { Recipe, RecipeIngredient } from '../types'

export const CURSOR = ' ▌'

function tryFullParse(raw: string): Recipe[] | null {
  try {
    const data = JSON.parse(raw)
    if (Array.isArray(data?.recipes)) return data.recipes
  } catch {
    /* 流式未完成，走部分解析 */
  }
  return null
}

interface SplitResult {
  complete: string[]
  tail: string | null
}

/** 在 from 起始的数组中切出完整的顶层 `{...}` 对象与未闭合的尾部。 */
function splitObjects(text: string, from: number): SplitResult {
  const complete: string[] = []
  let depth = 0
  let start = -1
  let inStr = false
  let esc = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '{') {
      if (depth === 0) start = i
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        complete.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }
  return { complete, tail: start !== -1 ? text.slice(start) : null }
}

function findArrayEnd(text: string, from: number): number {
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function completeString(text: string, key: string): string {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
  return m ? m[1] : ''
}

function completeNumber(text: string, key: string): number {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`, 'm'))
  return m ? Number(m[1]) : 0
}

/** 提取字符串数组中已完成的元素；若数组未闭合，追加正在输入的最后一个元素（带光标）。 */
function stringArray(text: string, key: string): string[] {
  const keyIdx = text.indexOf(`"${key}"`)
  if (keyIdx === -1) return []
  const arrStart = text.indexOf('[', keyIdx)
  if (arrStart === -1) return []
  const arrEnd = findArrayEnd(text, arrStart)
  const slice = text.slice(arrStart + 1, arrEnd === -1 ? undefined : arrEnd)

  const items: string[] = []
  const re = /"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  let lastEnd = 0
  while ((m = re.exec(slice)) !== null) {
    items.push(m[1])
    lastEnd = re.lastIndex
  }

  // exec 失败会把 lastIndex 重置为 0，必须用循环内记录的位置
  const rest = slice.slice(lastEnd)
  const typing = rest.match(/^(?:\s*,\s*)?"([^"\\]*)$/)
  if (typing && typing[1]) items.push(typing[1] + CURSOR)
  return items
}

function ingredientArray(text: string): RecipeIngredient[] {
  const keyIdx = text.indexOf('"ingredients"')
  if (keyIdx === -1) return []
  const arrStart = text.indexOf('[', keyIdx)
  if (arrStart === -1) return []
  const { complete, tail } = splitObjects(text, arrStart)

  const items: RecipeIngredient[] = []
  for (const obj of complete) {
    try {
      items.push(JSON.parse(obj))
    } catch {
      const name = completeString(obj, 'name')
      if (name) {
        items.push({ name, amount: completeString(obj, 'amount'), is_in_fridge: false })
      }
    }
  }
  if (tail) {
    const name = completeString(tail, 'name')
    if (name) {
      items.push({
        name,
        amount: completeString(tail, 'amount') || '…',
        is_in_fridge: /"is_in_fridge"\s*:\s*true/.test(tail),
      })
    }
  }
  return items
}

/** 识别当前正在逐字生成的最后一个未闭合字符串字段。 */
function lastStreamingString(text: string): { key: string; value: string } | null {
  const m = text.match(/"([a-z_]+)"\s*:\s*"([^"\\]*)$/)
  return m ? { key: m[1], value: m[2] } : null
}

function parsePartialRecipe(text: string): Recipe | null {
  if (!/"name"/.test(text)) return null

  const name = completeString(text, 'name')
  const description = completeString(text, 'description')
  const streaming = lastStreamingString(text)
  if (!name && !description && !streaming) return null

  const recipe: Recipe = {
    name,
    emoji: completeString(text, 'emoji') || '🍽️',
    cuisine: completeString(text, 'cuisine'),
    difficulty: completeString(text, 'difficulty'),
    time_minutes: completeNumber(text, 'time_minutes'),
    calories: completeNumber(text, 'calories'),
    description,
    reason: completeString(text, 'reason'),
    ingredients: ingredientArray(text),
    steps: stringArray(text, 'steps'),
    tips: stringArray(text, 'tips'),
  }

  if (streaming) {
    if (streaming.key === 'name') recipe.name = streaming.value + CURSOR
    if (streaming.key === 'description') recipe.description = streaming.value + CURSOR
    if (streaming.key === 'reason') recipe.reason = streaming.value + CURSOR
  }
  return recipe
}

/** 主入口：把流式累计文本解析为尽可能完整的菜谱数组。 */
export function parsePartialRecipes(raw: string): Recipe[] {
  const full = tryFullParse(raw)
  if (full) return full

  const recipesIdx = raw.indexOf('"recipes"')
  if (recipesIdx === -1) return []
  const arrStart = raw.indexOf('[', recipesIdx)
  if (arrStart === -1) return []

  const { complete, tail } = splitObjects(raw, arrStart)
  const recipes: Recipe[] = []
  for (const obj of complete) {
    try {
      recipes.push(JSON.parse(obj))
    } catch {
      /* 跳过异常片段 */
    }
  }
  if (tail) {
    const partial = parsePartialRecipe(tail)
    if (partial) recipes.push(partial)
  }
  return recipes
}
