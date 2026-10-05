import { NavLink } from 'react-router-dom'

const ABAS = [
  { caminho: '', rotulo: 'Dados do imóvel' },
  { caminho: '/documentos', rotulo: 'Documentos' },
  { caminho: '/historico', rotulo: 'Histórico' },
  { caminho: '/acoes', rotulo: 'Ações administrativas' },
]

/** Navegação entre as páginas de um mesmo imóvel. */
export function AbasImovel({ imovelId }: Readonly<{ imovelId: string }>) {
  return (
    <nav className="abas" aria-label="Seções do imóvel">
      {ABAS.map((a) => (
        <NavLink key={a.caminho} to={`/imoveis/${imovelId}${a.caminho}`} end className="abas__item">
          {a.rotulo}
        </NavLink>
      ))}
    </nav>
  )
}
