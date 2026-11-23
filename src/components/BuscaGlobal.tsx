import { Building2, Search, User } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useDb } from '../data/db'
import { rotuloImovel } from '../data/selectors'
import { normalizar } from '../lib/format'

interface Resultado {
  tipo: 'imovel' | 'cliente'
  id: string
  titulo: string
  subtitulo: string
  destino: string
}

const LIMITE = 6

/** Busca de imóveis (rótulo, título ou código) e clientes, com navegação por teclado. */
export function BuscaGlobal() {
  const db = useDb()
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)

  const resultados = useMemo<Resultado[]>(() => {
    const t = normalizar(termo.trim())
    if (t.length < 2) return []
    const imoveis = db.imoveis
      .filter((i) => normalizar(`${rotuloImovel(i)} ${i.titulo} ${i.codigo}`).includes(t))
      .slice(0, LIMITE)
      .map<Resultado>((i) => ({
        tipo: 'imovel',
        id: i.id,
        titulo: rotuloImovel(i),
        subtitulo: `Cód. ${i.codigo}${i.status === 'rascunho' ? ' · Rascunho' : ''}`,
        destino: `/imoveis/${i.id}`,
      }))
    const clientes = db.clientes
      .filter((c) => normalizar(c.nome).includes(t))
      .slice(0, 3)
      .map<Resultado>((c) => ({
        tipo: 'cliente',
        id: c.id,
        titulo: c.nome,
        subtitulo: 'Cliente',
        destino: `/clientes/${c.id}`,
      }))
    return [...imoveis, ...clientes]
  }, [db, termo])

  const ir = (destino: string) => {
    setAberto(false)
    setTermo('')
    navigate(destino)
  }

  const mostrar = aberto && termo.trim().length >= 2

  return (
    <div className="busca">
      <Search size={15} className="busca__icone" aria-hidden />
      <input
        type="search"
        className="busca__input"
        placeholder="Buscar imóvel, cliente ou código"
        aria-label="Buscar imóvel, cliente ou código"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls="busca-resultados"
        aria-activedescendant={mostrar && resultados[ativo] ? `busca-${resultados[ativo].id}` : undefined}
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value)
          setAtivo(0)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAtivo((a) => Math.min(a + 1, resultados.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAtivo((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (resultados[ativo]) ir(resultados[ativo].destino)
            else if (termo.trim()) ir(`/imoveis?q=${encodeURIComponent(termo.trim())}`)
          } else if (e.key === 'Escape') {
            setAberto(false)
          }
        }}
      />
      {mostrar && (
        <ul className="busca__resultados" id="busca-resultados" role="listbox">
          {resultados.length === 0 && <li className="busca__vazio">Nenhum resultado para “{termo.trim()}”.</li>}
          {resultados.map((r, i) => (
            <li
              key={`${r.tipo}-${r.id}`}
              id={`busca-${r.id}`}
              role="option"
              aria-selected={i === ativo}
              className={`busca__item ${i === ativo ? 'busca__item--ativo' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                ir(r.destino)
              }}
              onMouseEnter={() => setAtivo(i)}
            >
              {r.tipo === 'imovel' ? <Building2 size={15} /> : <User size={15} />}
              <span>
                <strong>{r.titulo}</strong>
                <small>{r.subtitulo}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
