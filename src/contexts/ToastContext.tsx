import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type TipoToast = 'sucesso' | 'erro' | 'info'

interface Toast {
  id: number
  tipo: TipoToast
  mensagem: string
}

type Notificar = (mensagem: string, tipo?: TipoToast) => void

const ToastContext = createContext<Notificar | null>(null)

const ICONES = { sucesso: CheckCircle2, erro: XCircle, info: Info }

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const proximoId = useRef(1)

  const fechar = useCallback((id: number) => {
    setToasts((lista) => lista.filter((t) => t.id !== id))
  }, [])

  const notificar = useCallback<Notificar>(
    (mensagem, tipo = 'sucesso') => {
      const id = proximoId.current++
      setToasts((lista) => [...lista.slice(-3), { id, tipo, mensagem }])
      setTimeout(() => fechar(id), tipo === 'erro' ? 6000 : 4000)
    },
    [fechar],
  )

  const valor = useMemo(() => notificar, [notificar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <section className="toasts" aria-label="Notificações">
        {toasts.map((t) => {
          const Icone = ICONES[t.tipo]
          // Erros usam role="alert" (lidos na hora); os demais, <output> (anúncio educado).
          const Conteiner = t.tipo === 'erro' ? 'div' : 'output'
          return (
            <Conteiner key={t.id} className={`toast toast--${t.tipo}`} {...(t.tipo === 'erro' ? { role: 'alert' } : {})}>
              <Icone size={18} aria-hidden />
              <span>{t.mensagem}</span>
              <button type="button" className="toast__fechar" onClick={() => fechar(t.id)} aria-label="Fechar">
                <X size={14} />
              </button>
            </Conteiner>
          )
        })}
      </section>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
