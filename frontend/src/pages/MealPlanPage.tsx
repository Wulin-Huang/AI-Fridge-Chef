import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookmarkPlus,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCopy,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { api } from '../api/client'
import { useFridge } from '../stores/fridge'
import type { GroceryItem, MealPlan, SavedPlanItem } from '../types'
import AILoading from '../components/AILoading'

const MEAL_TYPES = ['早餐', '午餐', '晚餐']
const LS_KEY = 'fridge-chef-shopping-checks'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function MealPlanPage() {
  const { ingredients, fetchIngredients } = useFridge()
  const [days, setDays] = useState(3)
  const [meals, setMeals] = useState<string[]>(['午餐', '晚餐'])
  const [servings, setServings] = useState(2)
  const [preferences, setPreferences] = useState('')
  const [plan, setPlan] = useState<MealPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [dishInput, setDishInput] = useState('')
  const [groceries, setGroceries] = useState<GroceryItem[] | null>(null)
  const [groceryLoading, setGroceryLoading] = useState(false)

  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [savedPlans, setSavedPlans] = useState<SavedPlanItem[]>([])
  const [expandedSaved, setExpandedSaved] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

  useEffect(() => {
    fetchIngredients()
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setChecks(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    api.listSavedPlans().then(setSavedPlans).catch(() => setSavedPlans([]))
  }, [fetchIngredients])

  const missingList = useMemo(() => {
    if (!plan?.days) return []
    const counter = new Map<string, number>()
    for (const day of plan.days) {
      for (const meal of day.meals ?? []) {
        for (const dish of meal.dishes ?? []) {
          for (const m of dish.missing_ingredients ?? []) counter.set(m, (counter.get(m) ?? 0) + 1)
        }
      }
    }
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [plan])

  const persistChecks = (next: Record<string, boolean>) => {
    setChecks(next)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const toggleMeal = (m: string) => {
    setMeals((prev) => {
      if (prev.includes(m)) return prev.length > 1 ? prev.filter((x) => x !== m) : prev
      return MEAL_TYPES.filter((t) => prev.includes(t) || t === m).sort(
        (a, b) => MEAL_TYPES.indexOf(a) - MEAL_TYPES.indexOf(b),
      )
    })
  }

  const generatePlan = async () => {
    if (ingredients.length === 0) return
    setLoading(true)
    setError('')
    try {
      const data = await api.generateMealPlan({
        ingredients: ingredients.map((i) => i.name),
        days,
        servings,
        preferences,
        meals,
      })
      setPlan(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const generateGroceries = async (dishes: string[]) => {
    setGroceryLoading(true)
    try {
      const data = await api.generateGroceries({
        target_dishes: dishes,
        current_ingredients: ingredients.map((i) => i.name),
      })
      setGroceries(data.items || [])
    } catch {
      setGroceries([])
    } finally {
      setGroceryLoading(false)
    }
  }

  const planToText = (p: MealPlan): string => {
    const lines: string[] = ['📋 我的 AI 菜单']
    for (const day of p.days ?? []) {
      lines.push(`\n第 ${day.day} 天 · ${day.idea ?? ''}`)
      for (const meal of day.meals ?? []) {
        const dishes = (meal.dishes ?? []).map((d) => `${d.emoji ?? ''}${d.name}`).join('、')
        lines.push(`  ${meal.type}：${dishes}`)
      }
    }
    if (p.grocery_summary?.length) {
      lines.push('\n🛒 采购建议：')
      p.grocery_summary.forEach((s) => lines.push(`  · ${s}`))
    }
    return lines.join('\n')
  }

  const copyPlan = async () => {
    if (!plan) return
    try {
      await navigator.clipboard.writeText(planToText(plan))
    } catch {
      const ta = document.createElement('textarea')
      ta.value = planToText(plan)
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const savePlan = async () => {
    if (!plan) return
    const totalDishes = (plan.days ?? []).reduce(
      (sum, d) => sum + (d.meals ?? []).reduce((s, m) => s + (m.dishes ?? []).length, 0),
      0,
    )
    setSavingPlan(true)
    try {
      await api.savePlan({
        title: `${days} 天菜单 · ${totalDishes} 道菜`,
        payload: plan,
      })
      setSavedPlans(await api.listSavedPlans())
    } finally {
      setSavingPlan(false)
    }
  }

  const deletePlan = async (id: number) => {
    await api.deleteSavedPlan(id)
    setSavedPlans((prev) => prev.filter((p) => p.id !== id))
    if (expandedSaved === id) setExpandedSaved(null)
  }

  if (ingredients.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 pt-20 text-center">
        <span className="text-5xl">📅</span>
        <h2 className="mt-4 text-lg font-bold text-gray-800">还没有食材</h2>
        <p className="mt-2 text-sm text-gray-400">先去冰箱页添加食材，才能规划菜单哦</p>
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
        <h1 className="text-2xl font-black text-gray-900">菜单规划 📅</h1>
        <p className="mt-1 text-xs text-gray-400">AI 帮你安排未来几天的餐桌，支持自定义餐次</p>
      </header>

      {/* 配置面板 */}
      <section className="mb-4 space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
        <div>
          <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-gray-700">
            <CalendarDays size={15} className="text-fresh-500" /> 规划天数
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 5, 7].map((d) => (
              <button
                key={d}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  days === d ? 'bg-fresh-500 text-white' : 'bg-fresh-50 text-fresh-700'
                }`}
                onClick={() => setDays(d)}
              >
                {d} 天
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-sm font-bold text-gray-700">🕐 每日餐次</p>
          <div className="flex gap-2">
            {MEAL_TYPES.map((m) => {
              const on = meals.includes(m)
              return (
                <button
                  key={m}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    on ? 'bg-fresh-500 text-white' : 'bg-fresh-50 text-fresh-700'
                  }`}
                  onClick={() => toggleMeal(m)}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>

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

        <input
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="口味偏好 / 忌口，如：少油、不吃辣（选填）"
          className="w-full rounded-xl border border-fresh-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-300 focus:border-fresh-500"
        />
      </section>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fresh-500 to-emerald-600 py-4 text-base font-bold text-white shadow-lg shadow-fresh-500/25 transition-transform active:scale-[0.98] disabled:opacity-60"
        onClick={generatePlan}
        disabled={loading}
      >
        <Sparkles size={20} />
        {loading ? 'AI 正在排菜单…' : plan ? '重新规划' : '生成菜单'}
      </button>

      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-center text-xs text-red-500">{error}</p>}

      {loading && <div className="mt-5"><AILoading title={`AI 正在安排每天的${meals.join('、')}`} /></div>}

      {plan && !loading && (
        <div className="mt-5 space-y-4">
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-bold text-fresh-700 shadow-sm ring-1 ring-fresh-100 active:bg-fresh-50 disabled:opacity-50"
              onClick={savePlan}
              disabled={savingPlan}
            >
              <BookmarkPlus size={14} />
              {savingPlan ? '保存中…' : '保存这份菜单'}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-bold text-fresh-700 shadow-sm ring-1 ring-fresh-100 active:bg-fresh-50"
              onClick={copyPlan}
            >
              {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
              {copied ? '已复制' : '复制菜单文本'}
            </button>
          </div>

          {plan.days?.map((day) => (
            <section key={day.day} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black text-gray-800">第 {day.day} 天</h3>
                <p className="max-w-[72%] text-right text-[11px] leading-snug text-gray-400">{day.idea}</p>
              </div>
              {day.meals?.map((meal) => (
                <div key={meal.type} className="mb-2 last:mb-0">
                  <p className="mb-1.5 text-xs font-bold text-fresh-600">{meal.type}</p>
                  <div className="space-y-1.5">
                    {meal.dishes?.map((dish) => (
                      <div
                        key={dish.name}
                        className="flex items-start justify-between gap-2 rounded-xl bg-fresh-50/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {dish.emoji} {dish.name}
                          </p>
                          {dish.use_ingredients?.length > 0 && (
                            <p className="mt-0.5 text-[10px] text-fresh-600">
                              已有：{dish.use_ingredients.join('、')}
                            </p>
                          )}
                        </div>
                        {dish.missing_ingredients?.length > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600">
                            缺 {dish.missing_ingredients.length} 样
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}

          {/* 缺料汇总勾选清单 */}
          {missingList.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
              <h3 className="mb-1 text-sm font-bold text-amber-700">
                🛒 缺料采购清单 · {missingList.length} 项
              </h3>
              <p className="mb-3 text-[11px] text-amber-500/80">
                已按出现次数排序，勾选状态自动保存（{Object.values(checks).filter(Boolean).length}/{missingList.length} 已备齐）
              </p>
              <div className="space-y-1">
                {missingList.map(({ name, count }) => {
                  const checked = !!checks[name]
                  return (
                    <button
                      key={name}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors ${
                        checked ? 'bg-amber-100/60' : 'bg-white/70'
                      }`}
                      onClick={() => persistChecks({ ...checks, [name]: !checked })}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                            checked ? 'border-amber-500 bg-amber-500' : 'border-amber-300'
                          }`}
                        >
                          {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-sm ${checked ? 'text-amber-500/60 line-through' : 'text-gray-700'}`}>
                          {name}
                        </span>
                      </span>
                      <span className="text-[10px] text-amber-500/70">{count} 道菜需要</span>
                    </button>
                  )
                })}
              </div>
              {missingList.every((m) => checks[m.name]) && (
                <p className="mt-3 rounded-xl bg-amber-500/10 p-2.5 text-center text-xs font-semibold text-amber-700">
                  🎉 全部备齐，开火吧！
                </p>
              )}
            </section>
          )}

          {plan.grocery_summary?.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-amber-700">💡 采购建议</h3>
              <ul className="space-y-1">
                {plan.grocery_summary.map((s, i) => (
                  <li key={i} className="text-xs leading-relaxed text-amber-700/90">· {s}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* 已保存菜单 */}
      {savedPlans.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold text-gray-700">💾 已保存菜单 · {savedPlans.length} 份</h2>
          <div className="space-y-2.5">
            {savedPlans.map((saved) => {
              const open = expandedSaved === saved.id
              const totalDishes = (saved.payload.days ?? []).reduce(
                (sum, d) => sum + (d.meals ?? []).reduce((s, m) => s + (m.dishes ?? []).length, 0),
                0,
              )
              return (
                <div key={saved.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-fresh-100">
                  <div className="flex items-center justify-between px-4 py-3">
                    <button className="flex-1 text-left" onClick={() => setExpandedSaved(open ? null : saved.id)}>
                      <p className="text-sm font-bold text-gray-800">{saved.title}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {formatDateTime(saved.created_at)} · {totalDishes} 道菜
                      </p>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="展开"
                        onClick={() => setExpandedSaved(open ? null : saved.id)}
                        className="rounded-full bg-gray-100 p-1.5 text-gray-400"
                      >
                        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        aria-label="删除菜单"
                        onClick={() => deletePlan(saved.id)}
                        className="rounded-full bg-red-50 p-1.5 text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {open && (
                    <div className="space-y-2 px-4 pb-4">
                      {(saved.payload.days ?? []).map((day) => (
                        <div key={day.day} className="rounded-xl bg-fresh-50/50 p-3">
                          <p className="mb-1 text-xs font-bold text-fresh-700">第 {day.day} 天</p>
                          {(day.meals ?? []).map((meal) => (
                            <p key={meal.type} className="mt-1 text-[11px] leading-relaxed text-gray-600">
                              <span className="font-semibold">{meal.type}：</span>
                              {(meal.dishes ?? []).map((d) => `${d.emoji ?? ''}${d.name}`).join('、')}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 购物清单生成器 */}
      <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
        <h3 className="mb-1 text-sm font-black text-gray-800">购物清单生成器</h3>
        <p className="mb-3 text-xs text-gray-400">想吃某道菜但缺食材？输入菜名，AI 帮你列出要买什么</p>
        <div className="flex gap-2">
          <input
            value={dishInput}
            onChange={(e) => setDishInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && dishInput.trim() && generateGroceries([dishInput.trim()])}
            placeholder="如：可乐鸡翅、番茄牛腩"
            className="flex-1 rounded-xl border border-fresh-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-300 focus:border-fresh-500"
          />
          <button
            className="flex items-center gap-1 rounded-xl bg-fresh-500 px-4 text-sm font-semibold text-white active:bg-fresh-600 disabled:opacity-60"
            onClick={() => dishInput.trim() && generateGroceries([dishInput.trim()])}
            disabled={groceryLoading}
          >
            <ShoppingCart size={15} />
            {groceryLoading ? '…' : '生成'}
          </button>
        </div>

        {groceryLoading && <div className="skeleton mt-3 h-20 rounded-xl" />}

        {groceries && groceries.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100">
            {groceries.map((item) => (
              <li key={item.name} className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.name}
                    <span className="ml-2 rounded-full bg-fresh-50 px-2 py-0.5 text-[10px] text-fresh-600">{item.category}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{item.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">{item.amount}</span>
              </li>
            ))}
          </ul>
        )}

        {groceries && groceries.length === 0 && (
          <p className="mt-3 rounded-xl bg-fresh-50 p-3 text-center text-xs text-fresh-700">
            太棒了，你冰箱里的食材足够做这道菜！🎉
          </p>
        )}
      </section>
    </div>
  )
}
