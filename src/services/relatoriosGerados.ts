import { http } from './http'

export interface RelatorioRegistrado {
  id: string
  nome: string
  periodo: string
  formato: 'CSV' | 'PDF'
  registros: number
  geradoPor: string
  criadoEm: string
}

export const listarRelatorios = () => http<RelatorioRegistrado[]>('/relatorios')

export const registrarRelatorio = (r: Pick<RelatorioRegistrado, 'nome' | 'periodo' | 'formato' | 'registros'>) =>
  http<{ id: string }>('/relatorios', { method: 'POST', body: r })
