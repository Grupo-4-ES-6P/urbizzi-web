import { http } from './http'

/** Envia o arquivo para a API e devolve o endereço público dele (/uploads/...). */
export async function enviarArquivo(arquivo: Blob, nome: string) {
  const dados = new FormData()
  dados.append('arquivo', arquivo, nome)
  const { url } = await http<{ url: string }>('/anexos/upload', { method: 'POST', body: dados })
  return url
}

export function dataUrlParaBlob(dataUrl: string) {
  const [cabecalho, conteudo = ''] = dataUrl.split(',')
  const tipo = /:(.*?);/.exec(cabecalho)?.[1] ?? 'application/octet-stream'
  const binario = atob(conteudo)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}
