import { Link, useParams } from 'react-router-dom'

import { useDb } from '../../data/db'
import { FormLoteamento } from './NovoLoteamentoPage'

/**
 * Loteamento já cadastrado: mesma tela do cadastro, mas abre com os dados
 * salvos preenchidos para consulta e alteração.
 */
export function EditarLoteamentoPage() {
  const { id } = useParams()
  const db = useDb()
  const loteamento = db.loteamentos.find((l) => l.id === id)

  if (!loteamento) {
    return (
      <main className="conteudo">
        <section className="card vazio">
          <h2>Loteamento não encontrado</h2>
          <Link to="/loteamentos" className="btn btn--secundario">Voltar</Link>
        </section>
      </main>
    )
  }

  return <FormLoteamento key={loteamento.id} loteamento={loteamento} />
}
