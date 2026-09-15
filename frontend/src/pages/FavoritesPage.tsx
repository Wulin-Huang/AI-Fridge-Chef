import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../api/client'
import type { FavoriteItem, Recipe } from '../types'
import RecipeDetailSheet from '../components/RecipeDetailSheet'

export default function FavoritesPage() {
  const [list, setList] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<Recipe | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setList(await api.listFavorites())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (id: number) => {
    await api.deleteFavorite(id)
    setList((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-black text-gray-900">我的收藏 ❤️</h1>
        <p className="mt-1 text-xs text-gray-400">收藏过的好菜，随时翻出来再做一次</p>
      </header>

      {loading && (
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="flex flex-col items-center pt-16 text-center">
          <span className="text-5xl">🍽️</span>
          <p className="mt-4 text-sm text-gray-400">还没有收藏的菜谱</p>
          <p className="mt-1 text-xs text-gray-300">去「发现菜谱」页点亮小心心吧</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map((fav) => (
          <div
            key={fav.id}
            className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100 transition-transform active:scale-[0.98]"
            onClick={() => setActive(fav.payload)}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-fresh-50 text-2xl">
              {fav.emoji || '🍽️'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">{fav.title}</p>
              <p className="mt-0.5 truncate text-xs text-gray-400">
                {fav.payload?.cuisine} · {fav.payload?.time_minutes} 分钟 · {fav.payload?.calories} 千卡
              </p>
            </div>
            <button
              aria-label={`删除收藏 ${fav.title}`}
              className="rounded-full p-2 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation()
                remove(fav.id)
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>

      {active && <RecipeDetailSheet recipe={active} servings={2} onClose={() => setActive(null)} />}
    </div>
  )
}
