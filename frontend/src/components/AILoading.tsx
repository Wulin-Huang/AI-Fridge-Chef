import { ChefHat } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
}

const phases = ['正在翻看你的冰箱…', '构思创意搭配中…', '拿起了锅铲…', '马上就好…']

export default function AILoading({ title, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-10 shadow-sm ring-1 ring-fresh-100">
      <div className="animate-float">
        <ChefHat size={56} className="text-fresh-500" strokeWidth={1.5} />
      </div>
      <p className="mt-5 text-base font-semibold text-gray-800">{title}</p>
      <p className="mt-1 text-sm text-gray-400">{subtitle ?? phases[Math.floor(Date.now() / 2500) % phases.length]}</p>
      <div className="mt-4 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-fresh-400"
            style={{ animation: `float 1s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}
