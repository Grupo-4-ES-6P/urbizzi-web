import type { Imovel, Loteamento } from '../../imoveis/types';

/** "Lote 12 — Qd. 04 · Universitário I" ou "Lote 31 — Biopark Toledo" quando não há quadra. */
export function rotuloImovel(imovel: Imovel | undefined, loteamento: Loteamento | undefined): string {
  if (!imovel) return 'Imóvel não encontrado';

  const local = [imovel.quadra ? `Qd. ${imovel.quadra}` : null, loteamento?.nome].filter(Boolean).join(' · ');
  return local ? `Lote ${imovel.lote} — ${local}` : `Lote ${imovel.lote}`;
}

/** "Qd. 04 — Lote 12" ou "Lote 31". */
export function rotuloQuadraLote(imovel: Imovel): string {
  return imovel.quadra ? `Qd. ${imovel.quadra} — Lote ${imovel.lote}` : `Lote ${imovel.lote}`;
}

/** "Juliana Billó" → "J. Billó". */
export function abreviarNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length < 2) return nome.trim();
  return `${partes[0][0]}. ${partes[partes.length - 1]}`;
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Formata valor inteiro em reais: 455000 → "R$ 455.000". */
export function formatarMoeda(valor: number | null): string {
  if (valor === null) return '';
  // Intl usa espaço não separável entre "R$" e o valor; normaliza para espaço comum.
  return formatadorMoeda.format(valor).replace(/\s/g, ' ');
}

/** Máscara de digitação de moeda (reais inteiros). Retorna null quando vazio. */
export function parseMoeda(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '');
  return digitos ? Number(digitos) : null;
}
