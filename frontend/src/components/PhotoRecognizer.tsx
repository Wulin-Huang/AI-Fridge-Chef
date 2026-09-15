import { useRef, useState } from 'react'
import { Camera, Check, RefreshCw, ScanLine, X } from 'lucide-react'
import { api } from '../api/client'
import { compressImage } from '../utils/compress'

interface Props {
  onAdded: (names: string[]) => void
  /** 紧凑模式：仅渲染一个方形相机图标按钮（用于输入行内联）。 */
  compact?: boolean
}

interface RecognizedItem {
  name: string
  confidence: number
}

export default function PhotoRecognizer({ onAdded, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [items, setItems] = useState<RecognizedItem[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setPreview(null)
    setItems(null)
    setSelected(new Set())
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setLoading(true)
    setError('')
    setItems(null)
    try {
      const { base64, dataUrl } = await compressImage(file)
      setPreview(dataUrl)
      const data = await api.recognizeIngredients(base64)
      const list = (data.ingredients || []).filter((i) => i.name)
      if (list.length === 0) {
        setError('没有识别出食材，换一张清晰点的照片试试')
      } else {
        setItems(list)
        setSelected(new Set(list.filter((i) => i.confidence >= 0.6).map((i) => i.name)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const confirmAdd = async () => {
    const names = items?.map((i) => i.name).filter((n) => selected.has(n)) ?? []
    if (names.length === 0) return
    onAdded(names)
    reset()
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

      {compact ? (
        <button
          aria-label="拍照识别食材"
          className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-fresh-50 text-fresh-600 ring-1 ring-fresh-200 transition-colors active:bg-fresh-100 ${
            loading ? 'animate-pulse' : ''
          }`}
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? <ScanLine size={20} className="animate-pulse" /> : <Camera size={20} />}
        </button>
      ) : (
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-fresh-300 bg-fresh-50/50 py-3.5 text-sm font-semibold text-fresh-700 transition-colors active:bg-fresh-100"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? (
            <>
              <ScanLine size={18} className="animate-pulse" />
              AI 正在识别食材…
            </>
          ) : (
            <>
              <Camera size={18} />
              拍照识别食材
            </>
          )}
        </button>
      )}

      {error && (
        <div className="mt-3 flex items-start justify-between gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-500">
          <span>{error}</span>
          <button aria-label="关闭错误" onClick={reset}>
            <X size={14} />
          </button>
        </div>
      )}

      {loading && preview && (
        <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-fresh-100">
          <img src={preview} alt="待识别照片" className="h-44 w-full object-cover opacity-70" />
          <div className="flex items-center justify-center gap-2 bg-white py-2.5 text-xs text-fresh-600">
            <RefreshCw size={13} className="animate-spin" />
            视觉模型分析中，通常需要几秒…
          </div>
        </div>
      )}

      {items && preview && (
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-fresh-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-800">识别结果</h3>
              <p className="mt-0.5 text-[11px] text-gray-400">
                已自动勾选置信度较高的 {Math.max(0, items.filter((i) => selected.has(i.name)).length)} 项，确认后加入冰箱
              </p>
            </div>
            <div className="flex gap-1">
              <button
                className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] text-gray-500"
                onClick={reset}
              >
                取消
              </button>
              <button
                className="rounded-lg bg-fresh-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                onClick={confirmAdd}
                disabled={selected.size === 0}
              >
                加入冰箱
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((item) => {
              const on = selected.has(item.name)
              return (
                <button
                  key={item.name}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-all active:scale-95 ${
                    on
                      ? 'bg-fresh-500 text-white shadow-sm shadow-fresh-500/30'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  onClick={() => toggle(item.name)}
                >
                  {on && <Check size={13} strokeWidth={3} />}
                  {item.name}
                  <span className={`text-[10px] ${on ? 'text-white/75' : 'text-gray-400'}`}>
                    {Math.round(item.confidence * 100)}%
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
