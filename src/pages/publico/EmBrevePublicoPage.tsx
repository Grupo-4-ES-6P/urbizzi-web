import { Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

export function EmBrevePublicoPage({ titulo }: { titulo: string }) {
  return (
    <main className="site__conteudo">
      <section className="card vazio">
        <Construction size={28} aria-hidden />
        <h1>{titulo}</h1>
        <p>Esta página ainda não foi desenhada no protótipo.</p>
        <Link to="/terrenos" className="btn btn--primario">
          Ver terrenos disponíveis
        </Link>
      </section>
    </main>
  )
}
