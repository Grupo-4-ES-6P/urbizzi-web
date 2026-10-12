/** Marca de ordem de bytes: faz o Excel reconhecer o arquivo como UTF-8 (acentos). */
export const BOM = String.fromCharCode(0xfeff)

/** Texto que começa com estes caracteres vira fórmula no Excel/Sheets (injeção de CSV). */
const INICIO_FORMULA = /^[=+\-@\t\r]/

function celula(valor: string) {
  const seguro = INICIO_FORMULA.test(valor) ? `'${valor}` : valor
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}

/** CSV separado por ";" (padrão do Excel em pt-BR), em UTF-8 com BOM. */
export function gerarCsv(cabecalho: string[], linhas: string[][]) {
  return BOM + [cabecalho, ...linhas].map((linha) => linha.map(celula).join(';')).join('\r\n')
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}
