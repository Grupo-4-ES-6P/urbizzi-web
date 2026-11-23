export interface Corretor {
  id: number;
  nome: string;
}

// Lista mock: substituir pela API de Usuários quando o módulo existir.
const CORRETORES: Corretor[] = [
  { id: 1, nome: 'Gustavo Marques' },
  { id: 2, nome: 'Juliana Billó' },
  { id: 3, nome: 'Guilherme Krüger' },
  { id: 4, nome: 'Matheus Oening' },
  { id: 5, nome: 'Ana Pacheco' },
  { id: 6, nome: 'Gabriel Lima' },
];

export async function listarCorretores(): Promise<Corretor[]> {
  return [...CORRETORES];
}

export async function buscarCorretor(id: number): Promise<Corretor | undefined> {
  return CORRETORES.find((corretor) => corretor.id === id);
}
