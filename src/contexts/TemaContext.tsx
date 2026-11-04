import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Tema = 'claro' | 'escuro'

const CHAVE = 'urbizzi:tema'

interface TemaValor {
  tema: Tema
  alternarTema: () => void
}

const TemaContext = createContext<TemaValor | null>(null)

/** Escolha salva pelo usuário ou, na falta dela, a preferência do sistema. */
function lerTema(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === 'claro' || salvo === 'escuro') return salvo
  } catch {
    // Storage indisponível: segue a preferência do sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(lerTema)

  // O CSS usa data-theme (light/dark); o mesmo atributo é aplicado no index.html antes do primeiro render.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light')
  }, [tema])

  const alternarTema = useCallback(() => {
    setTema((atual) => {
      const proximo = atual === 'escuro' ? 'claro' : 'escuro'
      try {
        localStorage.setItem(CHAVE, proximo)
      } catch {
        // Sem persistência, vale até recarregar a página.
      }
      return proximo
    })
  }, [])

  const valor = useMemo(() => ({ tema, alternarTema }), [tema, alternarTema])
  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>
}

export function useTema() {
  const ctx = useContext(TemaContext)
  if (!ctx) throw new Error('useTema precisa estar dentro de <TemaProvider>')
  return ctx
}
