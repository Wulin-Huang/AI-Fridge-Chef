import { Clock, Flame, Heart, Sparkles } from 'lucide-react'
import type { Recipe } from '../types'

interface Props {
  recipe: Recipe
  onOpen: (recipe: Recipe) => void
  onFavorite: (recipe: Recipe) => void
  favorited: boolean
}

export default function RecipeCard({ recipe, onOpen, onFavorite, favorited }: Props) {
  return (
    <article
      className="cursor-pointer rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100 transition-all active:scale-[0.98]"
      onClick={() => onOpen(recipe)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-fresh-50 text-3xl">
            {recipe.emoji || '🍽️'}
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-900">{recipe.name || '正在构思…'}</h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {recipe.cuisine} · {recipe.difficulty}
            </p>
          </div>
        </div>
        <button
          aria-label="收藏"
          className="rounded-full p-2 transition-colors active:bg-fresh-50"
          onClick={(e) => {
            e.stopPropagation()
            onFavorite(recipe)
          }}
        >
          <Heart
            size={20}
            className={favorited ? 'fill-red-500 text-red-500' : 'text-gray-300'}
          />
        </button>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-500">{recipe.description}</p>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Clock size={14} /> {recipe.time_minutes} 分钟
        </span>
        <span className="flex items-center gap-1">
          <Flame size={14} /> {recipe.calories} 千卡
        </span>
        <span className="flex flex-1 items-center gap-1 text-fresh-600">
          <Sparkles size={13} />
          <span className="truncate">{recipe.ingredients.filter((i) => i.is_in_fridge).length} 种食材冰箱已有</span>
        </span>
      </div>
    </article>
  )
}
