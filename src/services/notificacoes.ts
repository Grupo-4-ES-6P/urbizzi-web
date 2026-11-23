import { useCallback, useEffect, useState } from 'react'

import { http } from './http'

export interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  link: string | null
  lida: boolean
  criadaEm: string
}

export interface ListaNotificacoes {
  naoLidas: number
  itens: Notificacao[]
}

const MUDOU = 'urbizzi:notificacoes'

export const listarNotificacoes = () => http<ListaNotificacoes>('/notificacoes')

export async function marcarComoLida(id: string) {
  await http(`/notificacoes/${id}/lida`, { method: 'PATCH' })
  window.dispatchEvent(new Event(MUDOU))
}

export async function marcarTodasComoLidas() {
  await http('/notificacoes/lidas', { method: 'POST' })
  window.dispatchEvent(new Event(MUDOU))
}

/** Menu e tela compartilham o estado: marcar como lida em um atualiza o outro. */
export function useNotificacoes(intervalo = 60_000) {
  const [dados, setDados] = useState<ListaNotificacoes | null>(null)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    try {
      setDados(await listarNotificacoes())
      setErro('')
    } catch (error_) {
      setErro(error_ instanceof Error ? error_.message : 'Não foi possível carregar as notificações.')
    }
  }, [])

  useEffect(() => {
    void recarregar()
    const timer = setInterval(() => void recarregar(), intervalo)
    const aoMudar = () => void recarregar()
    window.addEventListener(MUDOU, aoMudar)
    return () => {
      clearInterval(timer)
      window.removeEventListener(MUDOU, aoMudar)
    }
  }, [recarregar, intervalo])

  return { dados, erro, recarregar }
}
