function escaparCelula(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Gera CSV separado por ";" (padrão do Excel em pt-BR). */
export function gerarCsv(cabecalho: string[], linhas: string[][]): string {
  return [cabecalho, ...linhas].map((linha) => linha.map(escaparCelula).join(';')).join('\r\n');
}

export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const blob = new Blob(['﻿', conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
