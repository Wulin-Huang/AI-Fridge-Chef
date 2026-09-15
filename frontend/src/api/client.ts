import type {
  Critique,
  FavoriteItem,
  FridgeHealth,
  GroceryItem,
  Ingredient,
  KitchenStats,
  MealPlan,
  NutritionInfo,
  Recipe,
  SavedPlanItem,
  SuggestionCategory,
  StyleIdea,
} from '../types'

const BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let message = `请求失败 (${res.status})`
    try {
      const body = await res.json()
      if (body.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* keep default */
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export const api = {
  listIngredients: () => request<Ingredient[]>('/ingredients'),

  updateIngredient: (id: number, body: { quantity?: string; expires_at?: string; category?: string }) =>
    request<Ingredient>(`/ingredients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  fridgeHealthCheck: () => request<FridgeHealth>('/ingredients/health-check'),

  recognizeIngredients: (image_base64: string, mime_type = 'image/jpeg') =>
    request<{ ingredients: { name: string; confidence: number }[] }>('/ingredients/recognize', {
      method: 'POST',
      body: JSON.stringify({ image_base64, mime_type }),
    }),

  addIngredients: (items: Array<{ name: string; category?: string; quantity?: string }>) =>
    request<{ added: string[]; skipped: string[] }>('/ingredients', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  deleteIngredient: (id: number) => request<{ ok: boolean }>(`/ingredients/${id}`, { method: 'DELETE' }),

  suggestIngredients: () => request<{ categories: SuggestionCategory[] }>('/ingredients/suggestions'),

  suggestStyles: (ingredients: string[]) =>
    request<{ styles: StyleIdea[] }>('/recipes/styles', {
      method: 'POST',
      body: JSON.stringify({ ingredients }),
    }),

  generateRecipes: (payload: {
    ingredients: string[]
    style: string
    servings: number
    preferences: string
    excluded: string[]
    count?: number
  }) =>
    request<{ recipes: Recipe[] }>('/recipes/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  streamGenerateRecipes: async (
    payload: {
      ingredients: string[]
      style: string
      servings: number
      preferences: string
      excluded: string[]
      count?: number
    },
    onChunk: (fullText: string) => void,
  ): Promise<string> => {
    const res = await fetch(`${BASE}/recipes/generate-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok || !res.body) {
      let message = `请求失败 (${res.status})`
      try {
        const body = await res.json()
        if (body.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      } catch {
        /* keep default */
      }
      throw new Error(message)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const evt of events) {
        const line = evt.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') return full
        let parsed: { text?: string; error?: string }
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.text) {
          full += parsed.text
          onChunk(full)
        }
      }
    }
    return full
  },

  analyzeNutrition: (payload: { recipe_name: string; ingredients_desc: string; servings: number }) =>
    request<NutritionInfo>('/recipes/nutrition', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateMealPlan: (payload: {
    ingredients: string[]
    days: number
    servings: number
    preferences: string
    meals?: string[]
  }) =>
    request<MealPlan>('/planner/meal-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listSavedPlans: () => request<SavedPlanItem[]>('/planner/saved-plans'),

  savePlan: (payload: { title: string; payload: MealPlan }) =>
    request<{ id: number }>('/planner/saved-plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteSavedPlan: (id: number) =>
    request<{ ok: boolean }>(`/planner/saved-plans/${id}`, { method: 'DELETE' }),

  generateGroceries: (payload: { target_dishes: string[]; current_ingredients: string[] }) =>
    request<{ items: GroceryItem[] }>('/planner/groceries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listFavorites: () => request<FavoriteItem[]>('/recipes/favorites'),

  addFavorite: (payload: { title: string; emoji: string | null; payload: Recipe }) =>
    request<{ id: number }>('/recipes/favorites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteFavorite: (id: number) => request<{ ok: boolean }>(`/recipes/favorites/${id}`, { method: 'DELETE' }),

  checkin: (payload: { recipe_name: string; emoji: string | null; rating?: number; note?: string }) =>
    request<{ id: number; created_at: string }>('/kitchen/checkin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  kitchenStats: () => request<KitchenStats>('/kitchen/stats'),

  critique: (image_base64: string, recipe_name = '', mime_type = 'image/jpeg') =>
    request<Critique>('/kitchen/critique', {
      method: 'POST',
      body: JSON.stringify({ image_base64, recipe_name, mime_type }),
    }),
}
