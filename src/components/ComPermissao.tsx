import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

/** Mostra o conteúdo só para quem tem a permissão da matriz (a API também barra). */
export function SePuder({ permissao, children }: Readonly<{ permissao: string; children: ReactNode }>) {
  const { pode } = useAuth()
  return pode(permissao) ? <>{children}</> : null
}

export function RotaComPermissao({ permissao, children }: Readonly<{ permissao: string; children: ReactNode }>) {
  const { pode } = useAuth()
  if (pode(permissao)) return <>{children}</>
  return (
    <main className="conteudo">
      <section className="card vazio">
        <h1>Sem permissão</h1>
        <p>Seu perfil não tem acesso a esta tela. Se precisar, fale com o administrador.</p>
        <Link to="/dashboard" className="btn btn--secundario">
          Voltar para o painel
        </Link>
      </section>
    </main>
  )
}
