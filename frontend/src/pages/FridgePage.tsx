import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlarmClock,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { useFridge } from '../stores/fridge'
import type { FridgeHealth, Ingredient, SuggestionCategory } from '../types'
import { categoryEmoji, daysLeft, foodCategory, foodEmoji, parseIngredientInput } from '../utils/foodEmoji'
import { ingredientImage } from '../utils/ingredientImages'
import AILoading from '../components/AILoading'
import PhotoRecognizer from '../components/PhotoRecognizer'
import IngredientEditSheet from '../components/IngredientEditSheet'

const FREQUENT_KEY = 'fridge-chef-frequent-names'

function expiryBadge(ing: Ingredient): { text: string; cls: string } | null {
  const d = daysLeft(ing.expires_at)
  if (d === null) return null
  if (d < 0) return { text: '已过期', cls: 'bg-red-500 text-white' }
  if (d === 0) return { text: '今天到期', cls: 'bg-red-500 text-white' }
  if (d <= 2) return { text: `${d} 天后过期`, cls: 'bg-orange-500 text-white' }
  if (d <= 5) return { text: `${d} 天`, cls: 'bg-amber-100 text-amber-600' }
  return null
}

const GRADE_STYLE: Record<string, string> = {
  A: 'from-emerald-400 to-green-500',
  B: 'from-lime-400 to-emerald-500',
  C: 'from-amber-400 to-orange-500',
  D: 'from-orange-400 to-red-500',
}

export default function FridgePage() {
  const { ingredients, loading, fetchIngredients, addIngredients, removeIngredient } = useFridge()
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestionCategory[] | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [cooked, setCooked] = useState<number | null>(null)
  const [streak, setStreak] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('全部')
  const [frequent, setFrequent] = useState<string[]>([])
  const [health, setHealth] = useState<FridgeHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')
  const [healthCollapsed, setHealthCollapsed] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    fetchIngredients()
    api
      .kitchenStats()
      .then((s) => {
        setCooked(s.total_cooked)
        setStreak(s.streak_days)
      })
      .catch(() => {
        setCooked(0)
        setStreak(0)
      })
    try {
      const raw = localStorage.getItem(FREQUENT_KEY)
      if (raw) setFrequent(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [fetchIngredients])

  const expiringSoon = useMemo(
    () =>
      ingredients
        .map((ing) => ({ ing, d: daysLeft(ing.expires_at) }))
        .filter((x) => x.d !== null && x.d <= 2)
        .sort((a, b) => (a.d ?? 0) - (b.d ?? 0)),
    [ingredients],
  )

  const expired = useMemo(() => expiringSoon.filter((x) => (x.d ?? 0) < 0), [expiringSoon])

  /** 食材的真实分类：用户自定义的 category 优先，无则按名称推断。 */
  const categoryOf = (ing: Ingredient) => ing.category || foodCategory(ing.name)

  const categories = useMemo(() => {
    const counter = new Map<string, number>()
    for (const i of ingredients) {
      const c = categoryOf(i)
      counter.set(c, (counter.get(c) ?? 0) + 1)
    }
    const order = ['肉蛋', '水产', '蔬菜', '豆乳', '水果', '主食', '调味', '其他']
    return [...counter.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0])
      const ib = order.indexOf(b[0])
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [ingredients])

  const filtered = useMemo(() => {
    let list = ingredients
    if (filter === '快过期') {
      const ids = new Set(expiringSoon.map((x) => x.ing.id))
      list = list.filter((i) => ids.has(i.id))
    } else if (filter !== '全部') {
      list = list.filter((i) => categoryOf(i) === filter)
    }
    if (search.trim()) {
      const q = search.trim()
      list = list.filter((i) => i.name.includes(q))
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, filter, search, expiringSoon])

  const frequentSuggestions = useMemo(() => {
    const inFridge = new Set(ingredients.map((i) => i.name))
    return frequent.filter((n) => !inFridge.has(n)).slice(0, 8)
  }, [frequent, ingredients])

  const recordFrequent = (names: string[]) => {
    setFrequent((prev) => {
      const next = [...names, ...prev.filter((n) => !names.includes(n))].slice(0, 30)
      try {
        localStorage.setItem(FREQUENT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const loadSuggestions = async () => {
    setSuggestLoading(true)
    try {
      const data = await api.suggestIngredients()
      setSuggestions(data.categories)
    } catch {
      setSuggestions([])
    } finally {
      setSuggestLoading(false)
    }
  }

  /** 统一入库：默认分类按名称推断（用户可随时在编辑弹层改成自定义分类）。 */
  const addDrafts = async (drafts: Array<{ name: string; quantity?: string }>) => {
    const valid = drafts.map((d) => ({ ...d, name: d.name.trim() })).filter((d) => d.name)
    if (valid.length === 0) return
    await addIngredients(valid.map((d) => ({ ...d, category: foodCategory(d.name) })))
    recordFrequent(valid.map((d) => d.name))
    setInput('')
  }

  const handleAdd = () => addDrafts(parseIngredientInput(input))
  const addByName = (names: string[]) => addDrafts(names.map((name) => ({ name })))

  const rescue = () => {
    const names = expiringSoon.map((x) => x.ing.name)
    if (names.length === 0) return
    navigate(`/recipes?rescue=${encodeURIComponent(names.join(','))}`)
  }

  const clearExpired = async () => {
    await Promise.all(expired.map((x) => api.deleteIngredient(x.ing.id)))
    await fetchIngredients()
  }

  const runHealthCheck = async () => {
    setHealthLoading(true)
    setHealthError('')
    setHealthCollapsed(false)
    try {
      setHealth(await api.fridgeHealthCheck())
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : '体检失败，请重试')
    } finally {
      setHealthLoading(false)
    }
  }

  return (
    <div className="pb-6">
      {/* 渐变头部 */}
      <header className="relative overflow-hidden bg-gradient-to-br from-fresh-500 via-emerald-500 to-teal-500 px-5 pb-7 pt-6 text-white">
        <div className="pointer-events-none absolute -right-4 -top-3 select-none text-7xl opacity-20">🥦</div>
        <div className="pointer-events-none absolute -bottom-5 left-24 select-none text-6xl opacity-15">🍅</div>
        <div className="pointer-events-none absolute right-16 top-14 select-none text-4xl opacity-15">🥕</div>

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white/75">你好，干饭人 👋</p>
            <h1 className="mt-0.5 text-2xl font-black tracking-wide">我的冰箱</h1>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-semibold backdrop-blur-sm transition-transform active:scale-95"
            onClick={runHealthCheck}
            disabled={healthLoading}
          >
            <Stethoscope size={14} />
            {health ? `体检 ${health.grade} 级` : 'AI 体检'}
          </button>
        </div>

        <div className="relative mt-4 flex gap-2">
          <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
            <p className="text-xl font-black leading-none">{ingredients.length}</p>
            <p className="mt-1 text-[10px] text-white/75">食材在库</p>
          </div>
          <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
            <p className="text-xl font-black leading-none">{cooked ?? '–'}</p>
            <p className="mt-1 text-[10px] text-white/75">做过菜品</p>
          </div>
          <div className="flex-1 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm">
            <p className="flex items-center justify-center gap-0.5 text-xl font-black leading-none">
              <Flame size={15} className="text-amber-300" />
              {streak ?? '–'}
            </p>
            <p className="mt-1 text-[10px] text-white/75">连续打卡</p>
          </div>
        </div>
      </header>

      <div className="-mt-3.5 rounded-t-3xl bg-[#f7faf7] px-4 pt-4">
        {/* 快速添加：输入 + 拍照 + 常买，统一卡片 */}
        <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-fresh-100">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="食材名，如：鸡蛋*6个、牛肉500g"
              className="h-[46px] min-w-0 flex-1 rounded-xl border border-fresh-200 px-3.5 text-sm outline-none transition-colors placeholder:text-gray-300 focus:border-fresh-500"
            />
            <PhotoRecognizer compact onAdded={addByName} />
            <button
              aria-label="添加食材"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-fresh-500 text-white transition-colors active:bg-fresh-600"
              onClick={handleAdd}
            >
              <Plus size={20} />
            </button>
          </div>
          {frequentSuggestions.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="shrink-0 text-[10px] font-semibold text-gray-400">常买</span>
              {frequentSuggestions.map((name) => (
                <button
                  key={name}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-fresh-50 px-2.5 py-1 text-[11px] text-fresh-700 ring-1 ring-fresh-100 active:bg-fresh-100"
                  onClick={() => addByName([name])}
                >
                  <Plus size={10} />
                  {foodEmoji(name)} {name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* AI 体检报告 */}
        {healthLoading && (
          <div className="mt-3">
            <AILoading title="AI 营养师正在检查你的冰箱" subtitle="分析食材结构，寻找营养缺口…" />
          </div>
        )}
        {healthError && (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-500">
            <span>{healthError}</span>
            <button onClick={runHealthCheck} className="font-bold underline underline-offset-2">
              重试
            </button>
          </div>
        )}
        {health && !healthLoading && (
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-fresh-100">
            <div
              className={`flex cursor-pointer items-center justify-between bg-gradient-to-r ${
                GRADE_STYLE[health.grade] ?? GRADE_STYLE.B
              } px-4 py-3 text-white`}
              onClick={() => setHealthCollapsed((c) => !c)}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-lg font-black backdrop-blur-sm">
                  {health.grade}
                </span>
                <div>
                  <p className="text-[10px] font-medium text-white/75">冰箱健康评级</p>
                  <p className="text-sm font-bold leading-tight">{health.summary || '结构还不错，继续保持'}</p>
                </div>
              </div>
              <ChevronDown size={18} className={`transition-transform ${healthCollapsed ? '' : 'rotate-180'}`} />
            </div>
            {!healthCollapsed && (
              <div className="space-y-2.5 p-4">
                {health.highlights.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 p-3">
                    {health.highlights.map((h, i) => (
                      <p key={i} className="text-xs leading-relaxed text-emerald-700">
                        👍 {h}
                      </p>
                    ))}
                  </div>
                )}
                {health.gaps.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-3">
                    {health.gaps.map((g, i) => (
                      <p key={i} className="text-xs leading-relaxed text-amber-700">
                        ⚠️ {g}
                      </p>
                    ))}
                  </div>
                )}
                {health.advice.length > 0 && (
                  <div className="space-y-1.5">
                    {health.advice.map((a, i) => (
                      <p key={i} className="flex gap-2 text-xs leading-relaxed text-gray-600">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fresh-100 text-[9px] font-bold text-fresh-700">
                          {i + 1}
                        </span>
                        {a}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  className="w-full rounded-xl bg-gray-100 py-2 text-xs font-semibold text-gray-500"
                  onClick={runHealthCheck}
                >
                  再体检一次
                </button>
              </div>
            )}
          </div>
        )}

        {/* 快过期：紧凑横条 */}
        {expiringSoon.length > 0 && (
          <section className="mt-3 rounded-2xl bg-gradient-to-r from-orange-50 to-red-50 p-3 ring-1 ring-orange-100">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-orange-600">
                <AlarmClock size={13} />
                快过期 · {expiringSoon.length} 项
              </h2>
              <div className="flex gap-1.5">
                {expired.length > 0 && (
                  <button
                    className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-red-500 ring-1 ring-red-100 active:bg-red-50"
                    onClick={clearExpired}
                  >
                    <Trash2 size={10} /> 清理 {expired.length}
                  </button>
                )}
                <button
                  className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold text-white active:bg-orange-600"
                  onClick={rescue}
                >
                  AI 拯救 →
                </button>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {expiringSoon.map(({ ing, d }) => (
                <span
                  key={ing.id}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    (d ?? 0) <= 0 ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {foodEmoji(ing.name)} {ing.name}
                  <span className="opacity-75">{(d ?? 0) <= 0 ? '已到期' : `${d}天`}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 食材网格：吸顶搜索 + 分类筛选 */}
        {ingredients.length > 0 && (
          <section className="mt-4">
            <div className="sticky top-0 z-20 -mx-4 bg-[#f7faf7]/95 px-4 py-2 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1.5 rounded-xl bg-white px-3 py-2 ring-1 ring-fresh-100">
                  <Search size={14} className="shrink-0 text-gray-300" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`搜索 ${ingredients.length} 种食材`}
                    className="w-full text-xs outline-none placeholder:text-gray-300"
                  />
                  {search && (
                    <button aria-label="清空搜索" onClick={() => setSearch('')}>
                      <X size={13} className="text-gray-300" />
                    </button>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-gray-400">
                  {filtered.length}/{ingredients.length}
                </span>
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                {[
                  ['全部', ingredients.length],
                  ...(expiringSoon.length > 0 ? ([['快过期', expiringSoon.length]] as [string, number][]) : []),
                  ...categories,
                ].map(([c, n]) => (
                  <button
                    key={c as string}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      filter === c ? 'bg-fresh-500 text-white' : 'bg-white text-gray-500 ring-1 ring-fresh-100'
                    }`}
                    onClick={() => setFilter(c as string)}
                  >
                    {c !== '全部' && c !== '快过期' && <span>{categoryEmoji(c as string)}</span>}
                    {c}
                    <span className={`text-[9px] ${filter === c ? 'text-white/75' : 'text-gray-300'}`}>{n}</span>
                  </button>
                ))}
              </div>
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {filtered.map((ing) => {
                  const badge = expiryBadge(ing)
                  const img = ingredientImage(ing.name)
                  return (
                    <button
                      key={ing.id}
                      onClick={() => setEditing(ing)}
                      className="relative flex flex-col items-center rounded-2xl bg-white p-3 pb-2.5 shadow-sm ring-1 ring-fresh-100 transition-all active:scale-95 active:ring-fresh-300"
                    >
                      {badge && (
                        <span
                          className={`absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm ${badge.cls}`}
                        >
                          {badge.text}
                        </span>
                      )}
                      {img ? (
                        <img
                          src={img}
                          alt={ing.name}
                          loading="lazy"
                          className="mt-1 h-11 w-11 rounded-full object-cover ring-2 ring-fresh-50"
                        />
                      ) : (
                        <span className="mt-1 text-[28px] leading-none">{foodEmoji(ing.name)}</span>
                      )}
                      <span className="mt-2 line-clamp-1 w-full text-center text-xs font-semibold text-gray-700">
                        {ing.name}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-[10px] text-gray-400">
                        {ing.quantity || categoryOf(ing)}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mt-2 flex flex-col items-center rounded-2xl bg-white py-8 text-center shadow-sm ring-1 ring-fresh-100">
                <span className="text-4xl">🔍</span>
                <p className="mt-3 text-sm font-semibold text-gray-500">没有匹配的食材</p>
                <p className="mt-1 text-xs text-gray-400">换个关键词或分类试试</p>
              </div>
            )}
          </section>
        )}

        {loading && ingredients.length === 0 && (
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {ingredients.length > 0 && (
          <button
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fresh-500 to-emerald-600 py-4 text-base font-bold text-white shadow-lg shadow-fresh-500/25 transition-transform active:scale-[0.98]"
            onClick={() => navigate('/recipes')}
          >
            <ChefHat size={22} />
            让 AI 大厨看看能做什么
          </button>
        )}

        {/* AI 采购灵感 */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
              <Sparkles size={15} className="text-fresh-500" />
              AI 采购灵感
            </h2>
            {suggestions && suggestions.length > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                点一下即可加入 <ChevronRight size={11} />
              </span>
            )}
          </div>

          {!suggestions && !suggestLoading && (
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-fresh-100 active:bg-fresh-50"
              onClick={loadSuggestions}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-fresh-50 text-fresh-500">
                  <Sparkles size={15} />
                </span>
                生成采购建议
              </span>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          )}

          {suggestLoading && (
            <AILoading title="AI 正在为你构思采购清单" subtitle="结合你现有的食材联想搭配…" />
          )}

          {suggestions && suggestions.length === 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-500">
              <span>生成失败</span>
              <button onClick={loadSuggestions} className="font-bold underline underline-offset-2">
                重试
              </button>
            </div>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  className="flex items-center gap-1 text-xs text-fresh-600 active:text-fresh-700"
                  onClick={loadSuggestions}
                  disabled={suggestLoading}
                >
                  <RefreshCw size={13} className={suggestLoading ? 'animate-spin' : ''} />
                  {suggestLoading ? '生成中…' : '换一批'}
                </button>
              </div>
              {suggestions.map((cat) => (
                <div key={cat.name} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
                  <h3 className="mb-2.5 text-xs font-bold text-gray-500">{cat.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map((item) => (
                      <button
                        key={item}
                        className="flex items-center gap-0.5 rounded-full bg-fresh-50 px-3 py-1.5 text-xs text-fresh-700 transition-colors active:bg-fresh-200"
                        onClick={() => addByName([item])}
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <IngredientEditSheet
          ingredient={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
          onDeleted={() => {
            removeIngredient(editing.id)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
