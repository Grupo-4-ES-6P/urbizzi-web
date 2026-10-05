import { Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

export function EmConstrucaoPage({ titulo }: Readonly<{ titulo: string }>) {
  return (
    <>
      <header className="cabecalho">
        <div>
          <h1 className="cabecalho__titulo">{titulo}</h1>
        </div>
      </header>
      <main className="conteudo">
        <section className="card vazio">
          <Construction size={28} aria-hidden />
          <h2>Tela em construção</h2>
          <p>O módulo de {titulo.toLowerCase()} ainda não foi desenhado no protótipo.</p>
          <Link to="/dashboard" className="btn btn--secundario">
            Voltar ao dashboard
          </Link>
        </section>
      </main>
    </>
  )
}
