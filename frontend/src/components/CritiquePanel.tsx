import { useRef, useState } from 'react'
import { Camera, Star, X } from 'lucide-react'
import { api } from '../api/client'
import { compressImage } from '../utils/compress'
import type { Critique } from '../types'

export default function CritiquePanel({ dishNames }: { dishNames: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dish, setDish] = useState('')
  const [result, setResult] = useState<Critique | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setPreview(null)
    setResult(null)
    setError('')
    setDish('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { base64, dataUrl } = await compressImage(file)
      setPreview(dataUrl)
      const data = await api.critique(base64, dish)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '点评失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!preview && !result && (
        <>
          {dishNames.length > 0 && (
            <select
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              className="mb-2.5 w-full rounded-xl border border-fresh-200 bg-white px-3.5 py-2.5 text-sm text-gray-600 outline-none focus:border-fresh-500"
            >
              <option value="">做的是哪道菜？（选填，点评更精准）</option>
              {dishNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-fresh-300 bg-fresh-50/50 py-3.5 text-sm font-semibold text-fresh-700 transition-colors active:bg-fresh-100"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            <Camera size={18} />
            拍成品照，让 AI 美食评审打分
          </button>
        </>
      )}

      {loading && preview && (
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-fresh-100">
          <img src={preview} alt="成品照片" className="h-48 w-full object-cover opacity-70" />
          <div className="bg-white py-2.5 text-center text-xs text-fresh-600">
            评审正在细品你的手艺…
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-500">
          <span>{error}</span>
          <button aria-label="关闭错误" onClick={reset}>
            <X size={14} />
          </button>
        </div>
      )}

      {result && preview && (
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
          <div className="flex gap-3">
            <img src={preview} alt="成品照片" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={16}
                    className={n <= Math.round(result.score / 20) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                  />
                ))}
                <span className="ml-1 text-lg font-black text-gray-900">{result.score}</span>
                <span className="text-[10px] text-gray-400">分</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{result.verdict}</p>
            </div>
          </div>

          {result.highlights.length > 0 && (
            <div className="mt-3 rounded-xl bg-fresh-50 p-3">
              {result.highlights.map((h, i) => (
                <p key={i} className="text-xs leading-relaxed text-fresh-700">
                  ✨ {h}
                </p>
              ))}
            </div>
          )}
          {result.improvements.length > 0 && (
            <div className="mt-2 rounded-xl bg-amber-50 p-3">
              {result.improvements.map((s, i) => (
                <p key={i} className="text-xs leading-relaxed text-amber-700">
                  💡 {s}
                </p>
              ))}
            </div>
          )}

          <button
            className="mt-3 w-full rounded-xl bg-gray-100 py-2 text-xs font-semibold text-gray-500"
            onClick={reset}
          >
            再拍一道
          </button>
        </div>
      )}
    </div>
  )
}
