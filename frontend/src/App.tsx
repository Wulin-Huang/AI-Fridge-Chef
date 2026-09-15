import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { BookHeart, CalendarDays, ChefHat, Refrigerator, UtensilsCrossed } from 'lucide-react'
import FridgePage from './pages/FridgePage'
import RecipesPage from './pages/RecipesPage'
import MealPlanPage from './pages/MealPlanPage'
import FavoritesPage from './pages/FavoritesPage'
import KitchenPage from './pages/KitchenPage'

const tabs = [
  { to: '/', label: '我的冰箱', icon: Refrigerator },
  { to: '/recipes', label: '发现菜谱', icon: ChefHat },
  { to: '/planner', label: '菜单规划', icon: CalendarDays },
  { to: '/kitchen', label: '我的厨房', icon: UtensilsCrossed },
  { to: '/favorites', label: '我的收藏', icon: BookHeart },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#f7faf7] shadow-lg">
      <div className="flex-1 pb-20">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<FridgePage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/planner" element={<MealPlanPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
        </Routes>
      </div>

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-fresh-100 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  active ? 'text-fresh-600 font-semibold' : 'text-gray-400'
                }`}
              >
                <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
