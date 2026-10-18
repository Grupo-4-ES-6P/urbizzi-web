import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { BotaoTema } from '../../components/BotaoTema'
import { Logo } from '../../components/Logo'

const LINKS = [
  { para: '/inicio', rotulo: 'Início' },
  { para: '/terrenos', rotulo: 'Terrenos' },
  { para: '/empreendimentos', rotulo: 'Empreendimentos' },
  { para: '/financiamento', rotulo: 'Financiamento' },
  { para: '/contato', rotulo: 'Contato' },
]

/** Layout do site público (catálogo), separado do painel administrativo. */
export function SiteLayout() {
  const { pathname } = useLocation()
  const [aberto, setAberto] = useState(false)
  useEffect(() => setAberto(false), [pathname])

  return (
    <div className="site">
      <header className="site__topo">
        <Link to="/terrenos" aria-label="Urbizzi — página inicial">
          <Logo />
        </Link>
        <button type="button" className="site__menu-botao" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label="Menu">
          {aberto ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`site__nav ${aberto ? 'site__nav--aberta' : ''}`} aria-label="Site">
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} className="site__link">
              {l.rotulo}
            </NavLink>
          ))}
        </nav>
        <BotaoTema sobreEscuro />
        <Link to="/login" className="site__acesso">
          Área restrita
        </Link>
      </header>
      <Outlet />
      <footer className="site__rodape">
        © {new Date().getFullYear()} Urbizzi Desenvolvimento Urbano · Valores sujeitos a confirmação.
      </footer>
    </div>
  )
}
