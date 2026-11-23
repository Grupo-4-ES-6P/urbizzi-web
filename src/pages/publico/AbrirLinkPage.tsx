import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Spinner } from '../../components/ui'
import { useDb } from '../../data/db'
import { abrirLink, destinoDoLink, type Escopo } from '../../services/linksPublicos'

/** /l/:token — conta a visita na API e leva o visitante à página certa do catálogo. */
export function AbrirLinkPage() {
  const { token = '' } = useParams()
  const db = useDb()
  const [resultado, setResultado] = useState<{ escopo: Escopo; alvo: string | null; valido: boolean } | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    abrirLink(token)
      .then((r) => (r.valido ? setResultado(r) : setErro('Este link expirou.')))
      .catch(() => setErro('Link não encontrado.'))
  }, [token])

  // Visitante: o loteamento só aparece depois que o catálogo carrega
  const aguardandoCatalogo = resultado?.escopo === 'loteamento' && db.loteamentos.length === 0
  if (resultado && !aguardandoCatalogo) return <Navigate to={destinoDoLink(db, resultado.escopo, resultado.alvo)} replace />
  if (erro) {
    return (
      <main className="conteudo">
        <section className="card">
          <h1 className="card__titulo">{erro}</h1>
          <p className="card__subtitulo">Peça um novo link a quem compartilhou ou veja todos os terrenos disponíveis.</p>
          <Link to="/terrenos" className="btn btn--primario">
            Ver terrenos
          </Link>
        </section>
      </main>
    )
  }
  return <Spinner />
}
