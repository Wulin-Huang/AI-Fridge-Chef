import { useEffect, useState } from 'react'
import { Flame, Medal, Star, Trophy, UtensilsCrossed } from 'lucide-react'
import { api } from '../api/client'
import type { KitchenStats } from '../types'
import CritiquePanel from '../components/CritiquePanel'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return `${diff} 天前`
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export default function KitchenPage() {
  const [stats, setStats] = useState<KitchenStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setStats(await api.kitchenStats())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 px-4 pt-6">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }

  if (!stats) return null

  const recentDishNames = [...new Set(stats.recent_logs.map((l) => l.recipe_name))].slice(0, 8)

  return (
    <div className="pb-6">
      {/* 渐变头部 */}
      <header className="relative overflow-hidden bg-gradient-to-br from-orange-400 via-red-400 to-rose-500 px-5 pb-8 pt-7 text-white">
        <div className="pointer-events-none absolute -right-3 top-2 select-none text-7xl opacity-20">🔥</div>
        <div className="pointer-events-none absolute -bottom-4 left-20 select-none text-6xl opacity-15">🍳</div>

        <p className="text-xs font-medium text-white/75">厨艺修行录</p>
        <h1 className="mt-1 text-2xl font-black tracking-wide">我的厨房</h1>
        <p className="mt-1.5 text-xs text-white/75">每一次开火，都算数</p>

        <div className="mt-5 grid grid-cols-4 gap-2">
          <div className="rounded-2xl bg-white/15 px-2 py-2.5 text-center backdrop-blur-sm">
            <UtensilsCrossed size={14} className="mx-auto text-white/70" />
            <p className="mt-1 text-lg font-black leading-none">{stats.total_cooked}</p>
            <p className="mt-1 text-[9px] text-white/75">做过</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-2.5 text-center backdrop-blur-sm">
            <Flame size={14} className="mx-auto text-amber-300" />
            <p className="mt-1 text-lg font-black leading-none">{stats.streak_days}</p>
            <p className="mt-1 text-[9px] text-white/75">连续天</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-2.5 text-center backdrop-blur-sm">
            <Star size={14} className="mx-auto text-amber-300" />
            <p className="mt-1 text-lg font-black leading-none">{stats.avg_rating ?? '–'}</p>
            <p className="mt-1 text-[9px] text-white/75">平均分</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-2.5 text-center backdrop-blur-sm">
            <Medal size={14} className="mx-auto text-amber-300" />
            <p className="mt-1 text-lg font-black leading-none">{stats.achievements.unlocked.length}</p>
            <p className="mt-1 text-[9px] text-white/75">成就</p>
          </div>
        </div>
      </header>

      <div className="-mt-4 space-y-6 rounded-t-3xl bg-[#f7faf7] px-4 pt-5">
        {/* 成就墙 */}
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-700">
            <Trophy size={15} className="text-amber-500" />
            成就墙
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {[...stats.achievements.unlocked, ...stats.achievements.locked].map((a) => {
              const locked = !stats.achievements.unlocked.some((u) => u.key === a.key)
              return (
                <div
                  key={a.key}
                  className={`flex flex-col items-center rounded-2xl p-3 text-center ${
                    locked ? 'bg-gray-100 opacity-60' : 'bg-gradient-to-b from-amber-50 to-orange-50 ring-1 ring-amber-200'
                  }`}
                >
                  <span className={`text-2xl ${locked ? 'grayscale' : ''}`}>{a.emoji}</span>
                  <p className="mt-1.5 text-[11px] font-bold text-gray-700">{a.title}</p>
                  <p className="mt-0.5 text-[9px] leading-tight text-gray-400">
                    {locked ? `${a.progress}/${a.target}` : '已点亮'}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* AI 厨艺点评 */}
        <section>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-700">
            <Star size={15} className="text-fresh-500" />
            AI 美食评审
          </h2>
          <CritiquePanel dishNames={recentDishNames} />
        </section>

        {/* 打卡时间线 */}
        <section>
          <h2 className="mb-3 text-sm font-bold text-gray-700">做菜记录</h2>
          {stats.recent_logs.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl bg-white py-8 text-center shadow-sm ring-1 ring-fresh-100">
              <span className="text-4xl">🍳</span>
              <p className="mt-3 text-sm font-semibold text-gray-500">还没有开过火</p>
              <p className="mt-1 text-xs text-gray-400">做完菜记得回来打卡哦</p>
            </div>
          ) : (
            <div className="relative space-y-3 pl-4">
              <div className="absolute bottom-2 left-[7px] top-2 w-px bg-fresh-200" />
              {stats.recent_logs.map((log) => (
                <div key={log.id} className="relative rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-fresh-100">
                  <span className="absolute -left-[13px] top-5 h-2.5 w-2.5 rounded-full bg-fresh-500 ring-4 ring-[#f7faf7]" />
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
                      <span className="text-lg">{log.emoji || '🍽️'}</span>
                      {log.recipe_name}
                    </p>
                    <span className="text-[10px] text-gray-400">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    {log.rating ? (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={11}
                            className={n <= log.rating! ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                          />
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    {log.note && <p className="ml-3 truncate text-[11px] text-gray-400">{log.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
