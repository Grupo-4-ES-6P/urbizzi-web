import { http } from './http'

export const ANTECEDENCIAS = [12, 24, 48, 72] as const

export interface ConfigAlerta {
  tipo: string
  evento: string
  quando: string
  destinatario: string
  ativo: boolean
  email: boolean
  antecedenciaHoras: number | null
}

export interface Envio {
  id: string
  tipo: string
  titulo: string
  destinatario: string
  lida: boolean
  criadaEm: string
}

export const listarConfig = () => http<ConfigAlerta[]>('/notificacoes/config')

export const salvarConfig = (c: ConfigAlerta) =>
  http<ConfigAlerta>(`/notificacoes/config/${c.tipo}`, {
    method: 'PUT',
    body: { ativo: c.ativo, email: c.email, ...(c.antecedenciaHoras === null ? {} : { antecedenciaHoras: c.antecedenciaHoras }) },
  })

export const listarEnvios = () => http<Envio[]>('/notificacoes/envios')
