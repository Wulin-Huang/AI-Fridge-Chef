import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Plus, RefreshCw, Sparkles, Users, Wand2 } from 'lucide-react'
import { api } from '../api/client'
import { useFridge } from '../stores/fridge'
import type { Recipe, StyleIdea } from '../types'
import { foodEmoji } from '../utils/foodEmoji'
import { parsePartialRecipes } from '../utils/partialJson'
import AILoading from '../components/AILoading'
import RecipeCard from '../components/RecipeCard'
import RecipeDetailSheet from '../components/RecipeDetailSheet'

const QUICK_PREFS = ['微辣', '清淡', '下饭', '减脂', '快手菜', '一人食', '不辣', '重口']

interface Batch {
  id: number
  recipes: Recipe[]
  style: string
  time: string
}

export default function RecipesPage() {
  const { ingredients, fetchIngredients } = useFridge()
  const [searchParams, setSearchParams] = useSearchParams()
  const [styles, setStyles] = useState<StyleIdea[]>([])
  const [stylesLoading, setStylesLoading] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState('')
  const [servings, setServings] = useState(2)
  const [count, setCount] = useState(3)
  const [preferences, setPreferences] = useState('')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
  const [ingredientOpen, setIngredientOpen] = useState(false)
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [favNames, setFavNames] = useState<Set<string>>(new Set())

  const rescueParam = searchParams.get('rescue')

  useEffect(() => {
    fetchIngredients()
  }, [fetchIngredients])

  // 食材默认全选（新食材加入后自动选中）
  useEffect(() => {
    setSelectedIngredients((prev) => {
      const names = new Set(ingredients.map((i) => i.name))
      const next = new Set(prev)
      for (const n of names) next.add(n)
      return next
    })
  }, [ingredients])

  const chosen = useMemo(
    () => ingredients.filter((i) => selectedIngredients.has(i.name)),
    [ingredients, selectedIngredients],
  )

  const loadFavorites = useCallback(async () => {
    try {
      const list = await api.listFavorites()
      setFavNames(new Set(list.map((f) => f.title)))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const loadStyles = async () => {
    if (ingredients.length === 0) return
    setStylesLoading(true)
    try {
      const data = await api.suggestStyles(ingredients.map((i) => i.name))
      setStyles(data.styles || [])
    } catch {
      setStyles([])
    } finally {
      setStylesLoading(false)
    }
  }

  useEffect(() => {
    if (ingredients.length > 0 && styles.length === 0) loadStyles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients.length])

  const generate = async (styleName?: string) => {
    const picked = ingredients.filter((i) => selectedIngredients.has(i.name))
    if (picked.length === 0) {
      setError('至少选择一种食材参与生成')
      return
    }
    const style = styleName ?? selectedStyle
    setGenerating(true)
    setError('')
    // 当批结果转入历史
    if (recipes.length > 0) {
      setBatches((prev) =>
        [
          {
            id: Date.now(),
            recipes,
            style: selectedStyle || '自由发挥',
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          },
          ...prev,
        ].slice(0, 6),
      )
    }
    setRecipes([])

    let lastPaint = 0
    const paint = (full: string, force = false) => {
      const now = Date.now()
      if (!force && now - lastPaint < 80) return
      lastPaint = now
      setRecipes(parsePartialRecipes(full))
    }

    try {
      const fullText = await api.streamGenerateRecipes(
        {
          ingredients: picked.map((i) => i.name),
          style: style || '由你自由发挥',
          servings,
          preferences,
          excluded,
          count,
        },
        (full) => paint(full),
      )
      paint(fullText, true)
      const final = parsePartialRecipes(fullText)
      if (final.length === 0) throw new Error('AI 未返回菜谱，请重试')
      setRecipes(final)
      setExcluded((prev) => [...prev, ...final.map((r) => r.name)].slice(-30))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  const toggleFavorite = async (recipe: Recipe) => {
    if (favNames.has(recipe.name)) {
      const list = await api.listFavorites()
      const target = list.find((f) => f.title === recipe.name)
      if (target) await api.deleteFavorite(target.id)
      setFavNames((prev) => {
        const next = new Set(prev)
        next.delete(recipe.name)
        return next
      })
    } else {
      await api.addFavorite({ title: recipe.name, emoji: recipe.emoji, payload: recipe })
      setFavNames((prev) => new Set(prev).add(recipe.name))
    }
  }

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // 快过期拯救模式：从冰箱页跳转而来，自动以"优先消耗快过期食材"方向生成
  useEffect(() => {
    if (!rescueParam || generating || recipes.length > 0) return
    const rescueStyle = `拯救快过期食材行动：请务必优先用掉这些快过期的食材（${rescueParam}），让它们成为菜品主角`
    setSelectedStyle(rescueStyle)
    generate(rescueStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescueParam, ingredients.length])

  if (ingredients.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 pt-20 text-center">
        <span className="text-5xl">🧊</span>
        <h2 className="mt-4 text-lg font-bold text-gray-800">你的冰箱还是空的</h2>
        <p className="mt-2 text-sm text-gray-400">先去添加一些食材，AI 大厨才知道能做什么菜</p>
        <Link
          to="/"
          className="mt-6 flex items-center gap-1.5 rounded-xl bg-fresh-500 px-5 py-3 text-sm font-semibold text-white active:bg-fresh-600"
        >
          <Plus size={16} /> 去添加食材
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-black text-gray-900">发现菜谱 👨‍🍳</h1>
        <p className="mt-1 text-xs text-gray-400">
          已选 {chosen.length}/{ingredients.length} 种食材，每一次生成都是全新的灵感
        </p>
      </header>

      {rescueParam && (
        <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-orange-50 to-red-50 px-4 py-3 ring-1 ring-orange-100">
          <p className="text-xs font-semibold text-orange-600">
            🚨 拯救模式：优先消耗 {rescueParam.split(',').join('、')}
          </p>
          <button
            className="shrink-0 text-[11px] font-medium text-orange-400 underline underline-offset-2"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            退出
          </button>
        </div>
      )}

      {/* 食材参与筛选 */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
        <button
          className="flex w-full items-center justify-between"
          onClick={() => setIngredientOpen((o) => !o)}
        >
          <span className="text-sm font-bold text-gray-700">
            🧺 参与食材
            <span className="ml-2 rounded-full bg-fresh-50 px-2 py-0.5 text-[10px] text-fresh-600">
              {chosen.length}/{ingredients.length}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${ingredientOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {ingredientOpen && (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {ingredients.map((ing) => {
                const on = selectedIngredients.has(ing.name)
                return (
                  <button
                    key={ing.id}
                    onClick={() => toggleIngredient(ing.name)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-all active:scale-95 ${
                      on ? 'bg-fresh-500 text-white' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <span>{foodEmoji(ing.name)}</span>
                    {ing.name}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                className="flex-1 rounded-lg bg-fresh-50 py-2 text-[11px] font-semibold text-fresh-700"
                onClick={() => setSelectedIngredients(new Set(ingredients.map((i) => i.name)))}
              >
                全选
              </button>
              <button
                className="flex-1 rounded-lg bg-gray-50 py-2 text-[11px] font-semibold text-gray-500"
                onClick={() => setSelectedIngredients(new Set())}
              >
                清空
              </button>
            </div>
          </>
        )}
      </section>

      {/* 风格灵感 */}
      <section className="mb-5">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
            <Sparkles size={15} className="text-fresh-500" />
            今日风格灵感
          </h2>
          <button
            className="flex items-center gap-1 text-xs text-fresh-600"
            onClick={loadStyles}
            disabled={stylesLoading}
          >
            <RefreshCw size={13} className={stylesLoading ? 'animate-spin' : ''} />
            {stylesLoading ? '构思中…' : '换灵感'}
          </button>
        </div>
        {stylesLoading && <div className="skeleton h-20 rounded-2xl" />}
        {!stylesLoading && styles.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {styles.map((s) => (
              <button
                key={s.name}
                className={`rounded-xl p-3 text-left transition-all active:scale-95 ${
                  selectedStyle === s.name
                    ? 'bg-fresh-500 text-white shadow-md shadow-fresh-500/30'
                    : 'bg-white text-gray-600 ring-1 ring-fresh-100'
                }`}
                onClick={() => setSelectedStyle(s.name)}
              >
                <p className="text-lg leading-none">{s.emoji}</p>
                <p className="mt-1.5 text-xs font-bold leading-tight">{s.name}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 生成配置 */}
      <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
            <Users size={15} className="text-fresh-500" /> 用餐人数
          </span>
          <div className="flex items-center gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-fresh-50 text-fresh-700"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
            >
              −
            </button>
            <span className="w-6 text-center text-base font-bold">{servings}</span>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-fresh-50 text-fresh-700"
              onClick={() => setServings((s) => Math.min(20, s + 1))}
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-700">🍽️ 生成道数</span>
          <div className="flex gap-1.5">
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
                  count === n ? 'bg-fresh-500 text-white' : 'bg-fresh-50 text-fresh-700'
                }`}
                onClick={() => setCount(n)}
              >
                {n} 道
              </button>
            ))}
          </div>
        </div>

        <input
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="口味偏好 / 忌口，如：微辣、不吃香菜（选填）"
          className="mt-3 w-full rounded-xl border border-fresh-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-300 focus:border-fresh-500"
        />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK_PREFS.map((p) => {
            const on = preferences.includes(p)
            return (
              <button
                key={p}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  on ? 'bg-fresh-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
                onClick={() => {
                  if (on) {
                    setPreferences((prev) =>
                      prev
                        .replace(p, '')
                        .replace(/[，,]\s*[，,]/g, '，')
                        .replace(/^[，,]\s*|[，,]\s*$/g, ''),
                    )
                  } else {
                    setPreferences((prev) => (prev.trim() ? `${prev.trim().replace(/[，,]$/, '')}、${p}` : p))
                  }
                }}
              >
                {p}
              </button>
            )
          })}
        </div>
      </section>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fresh-500 to-emerald-600 py-4 text-base font-bold text-white shadow-lg shadow-fresh-500/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        onClick={() => generate()}
        disabled={generating}
      >
        <Wand2 size={20} />
        {generating ? 'AI 大厨正在开火…' : recipes.length ? '再来一批新灵感' : '生成今日菜谱'}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-center text-xs text-red-500">{error}</p>
      )}

      <div className="mt-5 space-y-4">
        {generating && recipes.length === 0 && (
          <AILoading
            title={`AI 大厨正在构思 ${count} 道菜`}
            subtitle={selectedStyle ? `风格方向：${selectedStyle}` : '自由发挥，天马行空…'}
          />
        )}
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.name + recipe.description.slice(0, 8)}
            recipe={recipe}
            onOpen={setActiveRecipe}
            onFavorite={toggleFavorite}
            favorited={favNames.has(recipe.name)}
          />
        ))}
        {generating && recipes.length > 0 && (
          <p className="flex items-center justify-center gap-2 pb-2 text-xs text-fresh-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-fresh-500" />
            AI 正在书写第 {recipes.length} 道菜…
          </p>
        )}
      </div>

      {!generating && recipes.length === 0 && batches.length === 0 && (
        <div className="mt-10 flex flex-col items-center py-10 text-center">
          <span className="text-4xl">🍳</span>
          <p className="mt-3 text-sm text-gray-400">选好风格灵感，点击上方按钮开始生成</p>
        </div>
      )}

      {/* 历史批次 */}
      {batches.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-gray-700">
            🕑 往期灵感 · {batches.length} 批
          </h2>
          <div className="space-y-2.5">
            {batches.map((batch) => {
              const open = expandedBatch === batch.id
              return (
                <div key={batch.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-fresh-100">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3"
                    onClick={() => setExpandedBatch(open ? null : batch.id)}
                  >
                    <div className="text-left">
                      <p className="text-xs font-bold text-gray-700">
                        {batch.recipes.map((r) => r.emoji).join(' ')}
                        <span className="ml-2 text-gray-400">{batch.time} 生成</span>
                      </p>
                      <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-gray-400">
                        {batch.recipes.map((r) => r.name).join('、')}
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {open && (
                    <div className="space-y-3 px-4 pb-4">
                      {batch.recipes.map((recipe) => (
                        <RecipeCard
                          key={recipe.name + recipe.description.slice(0, 8)}
                          recipe={recipe}
                          onOpen={setActiveRecipe}
                          onFavorite={toggleFavorite}
                          favorited={favNames.has(recipe.name)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {activeRecipe && (
        <RecipeDetailSheet
          recipe={activeRecipe}
          servings={servings}
          onClose={() => setActiveRecipe(null)}
        />
      )}
    </div>
  )
}
