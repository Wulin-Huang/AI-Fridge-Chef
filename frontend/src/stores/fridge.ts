import { create } from 'zustand'
import { api } from '../api/client'
import type { Ingredient } from '../types'

export interface IngredientDraft {
  name: string
  category?: string
  quantity?: string
}

interface FridgeState {
  ingredients: Ingredient[]
  loading: boolean
  fetchIngredients: () => Promise<void>
  addIngredients: (drafts: IngredientDraft[]) => Promise<{ added: string[]; skipped: string[] }>
  removeIngredient: (id: number) => Promise<void>
  updateIngredient: (id: number, body: { quantity?: string; expires_at?: string; category?: string }) => Promise<void>
}

export const useFridge = create<FridgeState>((set, get) => ({
  ingredients: [],
  loading: false,

  fetchIngredients: async () => {
    set({ loading: true })
    try {
      const ingredients = await api.listIngredients()
      set({ ingredients })
    } finally {
      set({ loading: false })
    }
  },

  addIngredients: async (drafts) => {
    const items = drafts
      .map((d) => ({ name: d.name.trim(), category: d.category?.trim() || undefined, quantity: d.quantity?.trim() || undefined }))
      .filter((d) => d.name)
    const result = await api.addIngredients(items)
    await get().fetchIngredients()
    return result
  },

  removeIngredient: async (id) => {
    await api.deleteIngredient(id)
    set({ ingredients: get().ingredients.filter((i) => i.id !== id) })
  },

  updateIngredient: async (id, body) => {
    const updated = await api.updateIngredient(id, body)
    set({ ingredients: get().ingredients.map((i) => (i.id === id ? updated : i)) })
  },
}))
