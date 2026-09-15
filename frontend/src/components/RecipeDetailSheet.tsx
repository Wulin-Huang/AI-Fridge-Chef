import { useState } from 'react'
import { CheckCircle2, Flame, ShoppingCart, Star, X } from 'lucide-react'
import type { NutritionInfo, Recipe } from '../types'
import { api } from '../api/client'

interface Props {
  recipe: Recipe
  servings: number
  onClose: () => void
}

export default function RecipeDetailSheet({ recipe, servings, onClose }: Props) {
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null)
  const [loadingNutrition, setLoadingNutrition] = useState(false)
  const [error, setError] = useState('')
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')
  const [checkinDone, setCheckinDone] = useState(false)
  const [checkinSaving, setCheckinSaving] = useState(false)

  const loadNutrition = async () => {
    if (nutrition || loadingNutrition) return
    setLoadingNutrition(true)
    setError('')
    try {
      const desc = recipe.ingredients.map((i) => `${i.name} ${i.amount}`).join('、')
      setNutrition(await api.analyzeNutrition({ recipe_name: recipe.name, ingredients_desc: desc, servings }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '营养分析失败')
    } finally {
      setLoadingNutrition(false)
    }
  }

  const submitCheckin = async () => {
    setCheckinSaving(true)
    try {
      await api.checkin({
        recipe_name: recipe.name,
        emoji: recipe.emoji,
        rating: rating || undefined,
        note: note.trim() || undefined,
      })
      setCheckinDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '打卡失败')
    } finally {
      setCheckinSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{recipe.emoji || '🍽️'}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
              <p className="text-xs text-gray-400">
                {recipe.cuisine} · {recipe.difficulty} · {recipe.time_minutes} 分钟 · {recipe.calories} 千卡
              </p>
            </div>
          </div>
          <button aria-label="关闭" className="rounded-full bg-gray-100 p-2" onClick={onClose}>
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <p className="rounded-xl bg-fresh-50 p-3 text-sm leading-relaxed text-fresh-700">{recipe.reason}</p>

        <section className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-800">用料（{servings} 人份）</h3>
          <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-100">
            {recipe.ingredients.map((ing) => (
              <li key={ing.name} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  {ing.is_in_fridge ? (
                    <CheckCircle2 size={16} className="text-fresh-500" />
                  ) : (
                    <ShoppingCart size={16} className="text-gray-300" />
                  )}
                  {ing.name}
                </span>
                <span className="text-gray-400">{ing.amount}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-800">做法步骤</h3>
          <ol className="space-y-3">
            {recipe.steps.map((step, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fresh-500 text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <p className="text-sm leading-relaxed text-gray-600">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-gray-800">小贴士</h3>
          <ul className="space-y-1.5">
            {recipe.tips.map((tip, idx) => (
              <li key={idx} className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                💡 {tip}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <button
            className="w-full rounded-xl bg-fresh-50 py-3 text-sm font-semibold text-fresh-700 transition-colors active:bg-fresh-100"
            onClick={loadNutrition}
            disabled={loadingNutrition}
          >
            {loadingNutrition ? '营养师分析中…' : nutrition ? '营养分析（已生成）' : '🥗 让营养师分析这道菜'}
          </button>

          {/* 做菜打卡 */}
          {!checkinOpen && !checkinDone && (
            <button
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/20 active:scale-[0.98]"
              onClick={() => setCheckinOpen(true)}
            >
              <Flame size={16} />
              做完了，打卡！
            </button>
          )}
          {checkinDone && (
            <div className="mt-2.5 rounded-xl bg-orange-50 p-3 text-center text-sm font-semibold text-orange-600">
              🎉 打卡成功！去「我的厨房」看看你的成就
            </div>
          )}
          {checkinOpen && !checkinDone && (
            <div className="mt-2.5 rounded-2xl bg-orange-50/60 p-4 ring-1 ring-orange-100">
              <p className="text-center text-xs font-bold text-orange-600">
                {recipe.emoji} 「{recipe.name}」做得怎么样？
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} aria-label={`${n} 星`} onClick={() => setRating(n)}>
                    <Star
                      size={26}
                      className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                    />
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="一句话心得（选填）"
                maxLength={100}
                className="mt-3 w-full rounded-xl border border-orange-200 bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-300 focus:border-orange-400"
              />
              <div className="mt-3 flex gap-2">
                <button
                  className="flex-1 rounded-xl bg-white py-2.5 text-xs font-semibold text-gray-400 ring-1 ring-gray-200"
                  onClick={() => setCheckinOpen(false)}
                >
                  还没做
                </button>
                <button
                  className="flex-[2] rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white active:bg-orange-600 disabled:opacity-50"
                  onClick={submitCheckin}
                  disabled={checkinSaving}
                >
                  {checkinSaving ? '保存中…' : '完成打卡'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-center text-xs text-red-500">{error}</p>}
          {nutrition && (
            <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-fresh-100">
              <div className="grid grid-cols-5 gap-1 text-center">
                {[
                  ['热量', nutrition.calories],
                  ['蛋白质', nutrition.protein],
                  ['碳水', nutrition.carbs],
                  ['脂肪', nutrition.fat],
                  ['纤维', nutrition.fiber],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[10px] text-gray-400">{label}</p>
                    <p className="mt-1 text-xs font-bold text-gray-700">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">{nutrition.analysis}</p>
              {nutrition.suggestions?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {nutrition.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-fresh-700">· {s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
