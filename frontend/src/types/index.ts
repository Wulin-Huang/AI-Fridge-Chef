export interface Ingredient {
  id: number
  name: string
  category: string | null
  quantity: string | null
  expires_at: string | null
}

export interface SuggestionCategory {
  name: string
  items: string[]
}

export interface StyleIdea {
  name: string
  emoji: string
  desc: string
}

export interface RecipeIngredient {
  name: string
  amount: string
  is_in_fridge: boolean
}

export interface Recipe {
  name: string
  emoji: string
  cuisine: string
  difficulty: string
  time_minutes: number
  calories: number
  description: string
  reason: string
  ingredients: RecipeIngredient[]
  steps: string[]
  tips: string[]
}

export interface NutritionInfo {
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  analysis: string
  suggestions: string[]
}

export interface MealDish {
  name: string
  emoji: string
  use_ingredients: string[]
  missing_ingredients: string[]
}

export interface Meal {
  type: string
  dishes: MealDish[]
}

export interface MealDay {
  day: number
  idea: string
  meals: Meal[]
}

export interface MealPlan {
  days: MealDay[]
  grocery_summary: string[]
}

export interface GroceryItem {
  name: string
  amount: string
  category: string
  reason: string
}

export interface FavoriteItem {
  id: number
  title: string
  emoji: string | null
  payload: Recipe
}

export interface CookLogItem {
  id: number
  recipe_name: string
  emoji: string | null
  rating: number | null
  note: string | null
  created_at: string
}

export interface Achievement {
  key: string
  emoji: string
  title: string
  desc: string
  progress: number
  target?: number
}

export interface KitchenStats {
  total_cooked: number
  streak_days: number
  avg_rating: number | null
  favorites: number
  ingredients: number
  achievements: { unlocked: Achievement[]; locked: Achievement[] }
  recent_logs: CookLogItem[]
}

export interface Critique {
  score: number
  verdict: string
  highlights: string[]
  improvements: string[]
}

export interface SavedPlanItem {
  id: number
  title: string
  payload: MealPlan
  created_at: string
}

export interface FridgeHealth {
  grade: string
  summary: string
  highlights: string[]
  gaps: string[]
  advice: string[]
}
