import { useSyncExternalStore } from 'react'

import { criarSeed, VERSAO_DB } from './seed'
import type { Db } from './types'

/**
 * Banco de dados local (localStorage) usado enquanto a API não existe.
 * Toda escrita passa por `atualizarDb`, então trocar por chamadas HTTP
 * fica restrito a `services/api.ts`.
 */
const CHAVE = 'urbizzi:db'

function carregar(): Db {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const db = JSON.parse(bruto) as Db
      if (db.versao === VERSAO_DB) return db
    }
  } catch {
    // Dados corrompidos ou storage indisponível: recria a base de demonstração.
  }
  const db = criarSeed(new Date())
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db))
  } catch {
    // Sem persistência; segue só em memória.
  }
  return db
}

let estado: Db = carregar()
const ouvintes = new Set<() => void>()

function persistir(db: Db) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(db))
  } catch (error_) {
    if (error_ instanceof DOMException && error_.name === 'QuotaExceededError') {
      throw new Error('O armazenamento local está cheio. Remova algumas fotos e tente novamente.')
    }
    throw error_
  }
}

export function lerDb() {
  return estado
}

export function atualizarDb(receita: (db: Db) => Db) {
  const proximo = receita(estado)
  persistir(proximo)
  estado = proximo
  ouvintes.forEach((o) => o())
}

export function restaurarDemo() {
  estado = criarSeed(new Date())
  try {
    persistir(estado)
  } catch {
    // Mantém em memória mesmo sem conseguir gravar.
  }
  ouvintes.forEach((o) => o())
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export function useDb() {
  return useSyncExternalStore(assinar, lerDb)
}
