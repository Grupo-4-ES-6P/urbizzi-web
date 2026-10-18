import { VERSAO_DB } from './seed'

/** Importa o módulo do zero, para `carregar` ler o localStorage preparado pelo teste. */
async function carregarDb() {
  vi.resetModules()
  return import('./db')
}

describe('carga do banco local', () => {
  it('recria a base quando outra branch gravou a mesma versão com outra estrutura', async () => {
    // Ex.: feat/telas-clientes também usou a versão 6, sem o log de acessos.
    localStorage.setItem('urbizzi:db', JSON.stringify({ versao: VERSAO_DB, usuarios: [], imoveis: [] }))
    const { lerDb } = await carregarDb()
    expect(Array.isArray(lerDb().acessos)).toBe(true)
    expect(lerDb().usuarios.length).toBeGreaterThan(0)
  })

  it('recria a base com versão diferente ou JSON corrompido', async () => {
    localStorage.setItem('urbizzi:db', JSON.stringify({ versao: VERSAO_DB - 1 }))
    expect((await carregarDb()).lerDb().versao).toBe(VERSAO_DB)
    localStorage.setItem('urbizzi:db', '{corrompido')
    expect((await carregarDb()).lerDb().versao).toBe(VERSAO_DB)
  })

  it('mantém a base gravada quando ela é válida', async () => {
    const { lerDb, atualizarDb } = await carregarDb()
    atualizarDb((db) => ({ ...db, acessos: [] }))
    expect(lerDb().acessos).toHaveLength(0)
    expect((await carregarDb()).lerDb().acessos).toHaveLength(0)
  })
})
