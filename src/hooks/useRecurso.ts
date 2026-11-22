import { useCallback, useEffect, useRef, useState } from 'react'

interface Estado<T> {
  dados?: T
  erro?: string
  carregando: boolean
}

/** Carrega dados da API; recarrega quando `chave` muda e cancela ao desmontar. */
export function useRecurso<T>(chave: string, carregar: (signal: AbortSignal) => Promise<T>) {
  const carregarRef = useRef(carregar)
  carregarRef.current = carregar
  const [estado, setEstado] = useState<Estado<T>>({ carregando: true })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    const controle = new AbortController()
    setEstado((atual) => ({ ...atual, carregando: true, erro: undefined }))
    carregarRef
      .current(controle.signal)
      .then((dados) => setEstado({ dados, carregando: false }))
      .catch((error_: unknown) => {
        if (controle.signal.aborted) return
        setEstado({ carregando: false, erro: error_ instanceof Error ? error_.message : 'Não foi possível carregar.' })
      })
    return () => controle.abort()
  }, [chave, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  const definir = useCallback((dados: T) => setEstado({ dados, carregando: false }), [])

  return { ...estado, recarregar, definir }
}
