import { useEffect, useState } from 'react'
import { Calendar, Package, Tag, Trash2, X } from 'lucide-react'
import { useFridge } from '../stores/fridge'
import { PRESET_CATEGORIES, foodEmoji } from '../utils/foodEmoji'
import { ingredientImage } from '../utils/ingredientImages'
import type { Ingredient } from '../types'

interface Props {
  ingredient: Ingredient
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export default function IngredientEditSheet({ ingredient, onClose, onSaved, onDeleted }: Props) {
  const updateIngredient = useFridge((s) => s.updateIngredient)
  const [category, setCategory] = useState(ingredient.category ?? '')
  const [customMode, setCustomMode] = useState(
    !!ingredient.category && !PRESET_CATEGORIES.includes(ingredient.category),
  )
  const [quantity, setQuantity] = useState(ingredient.quantity ?? '')
  const [expiresAt, setExpiresAt] = useState(ingredient.expires_at ?? '')
  const [saving, setSaving] = useState(false)
  const heroImage = ingredientImage(ingredient.name)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const save = async () => {
    setSaving(true)
    try {
      await updateIngredient(ingredient.id, {
        category: category.trim() || undefined,
        quantity: quantity.trim() || undefined,
        expires_at: expiresAt || undefined,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2.5 text-base font-black text-gray-900">
            {heroImage ? (
              <img src={heroImage} alt={ingredient.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-fresh-100" />
            ) : (
              <span className="text-2xl">{foodEmoji(ingredient.name)}</span>
            )}
            {ingredient.name}
          </h3>
          <button aria-label="关闭" onClick={onClose} className="rounded-full bg-gray-100 p-1.5 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <Tag size={13} /> 分类（自定义你的冰箱分区）
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESET_CATEGORIES.map((c) => (
            <button
              key={c}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                !customMode && category === c ? 'bg-fresh-500 text-white' : 'bg-fresh-50 text-fresh-700'
              }`}
              onClick={() => {
                setCustomMode(false)
                setCategory(c)
              }}
            >
              {c}
            </button>
          ))}
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              customMode ? 'bg-fresh-500 text-white' : 'bg-fresh-50 text-fresh-700'
            }`}
            onClick={() => {
              setCustomMode(true)
              setCategory('')
            }}
          >
            ✏️ 自定义
          </button>
        </div>
        {customMode && (
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={16}
            placeholder="输入自定义分类，如：火锅食材、宝宝辅食"
            className="mb-4 w-full rounded-xl border border-fresh-200 px-4 py-2.5 text-sm outline-none focus:border-fresh-500"
          />
        )}
        {!customMode && <div className="mb-4" />}

        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <Package size={13} /> 数量
        </label>
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="如：3 个 / 500g"
          maxLength={32}
          className="mb-4 w-full rounded-xl border border-fresh-200 px-4 py-2.5 text-sm outline-none focus:border-fresh-500"
        />

        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <Calendar size={13} /> 保质期至
        </label>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="mb-5 w-full rounded-xl border border-fresh-200 px-4 py-2.5 text-sm text-gray-600 outline-none focus:border-fresh-500"
        />

        <button
          className="w-full rounded-xl bg-fresh-500 py-3 text-sm font-bold text-white active:bg-fresh-600 disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-red-50 py-2.5 text-xs font-semibold text-red-400 active:bg-red-100"
          onClick={onDeleted}
        >
          <Trash2 size={13} /> 从冰箱移除
        </button>
      </div>
    </div>
  )
}
