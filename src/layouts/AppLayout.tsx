import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  CalendarClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RotateCcw,
  Sun,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Dialogo } from '../components/Dialogo'
import { Logo } from '../components/Logo'
import { useAuth } from '../contexts/AuthContext'
import { useTema } from '../contexts/TemaContext'
import { useToast } from '../contexts/ToastContext'
import { restaurarDemo } from '../data/db'
import { iniciais } from '../lib/format'
import { useAgora } from '../lib/useAgora'
import { sincronizarReservas } from '../services/api'

const MENU = [
  { para: '/dashboard', rotulo: 'Dashboard', icone: LayoutDashboard },
  { para: '/imoveis', rotulo: 'Imóveis', icone: Building2 },
  { para: '/clientes', rotulo: 'Clientes', icone: Users },
  { para: '/reservas', rotulo: 'Reservas', icone: CalendarClock },
  { para: '/propostas', rotulo: 'Propostas', icone: FileText },
  { para: '/vendas', rotulo: 'Vendas', icone: BadgeDollarSign },
  { para: '/relatorios', rotulo: 'Relatórios', icone: BarChart3 },
  { para: '/usuarios', rotulo: 'Usuários', icone: UserCog },
]

export function AppLayout() {
  const { usuario, sair } = useAuth()
  const notificar = useToast()
  const { tema, alternarTema } = useTema()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const [contaAberta, setContaAberta] = useState(false)
  const [confirmarReset, setConfirmarReset] = useState(false)
  const contaRef = useRef<HTMLDivElement>(null)
  const agora = useAgora()

  // Reservas vencidas expiram e liberam o imóvel mesmo sem ninguém abrir a tela de reservas (RF16).
  useEffect(() => sincronizarReservas(agora), [agora])

  // Fecha o menu lateral (mobile) ao trocar de página.
  useEffect(() => setMenuAberto(false), [pathname])

  useEffect(() => {
    if (!contaAberta) return
    const fora = (e: MouseEvent) => {
      if (!contaRef.current?.contains(e.target as Node)) setContaAberta(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setContaAberta(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [contaAberta])

  return (
    <div className={`app ${menuAberto ? 'app--menu-aberto' : ''}`}>
      <aside className="sidebar" aria-label="Menu principal">
        <div className="sidebar__topo">
          <Logo />
          <button type="button" className="sidebar__fechar" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar__nav">
          {MENU.map(({ para, rotulo, icone: Icone }) => (
            <NavLink key={para} to={para} className="sidebar__link">
              <Icone size={16} aria-hidden />
              {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__conta" ref={contaRef}>
          {contaAberta && (
            <div className="menu-conta" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setContaAberta(false)
                  alternarTema()
                }}
              >
                {tema === 'escuro' ? <Sun size={15} /> : <Moon size={15} />} {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setContaAberta(false)
                  setConfirmarReset(true)
                }}
              >
                <RotateCcw size={15} /> Restaurar dados de demonstração
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  sair()
                  navigate('/login', { replace: true })
                }}
              >
                <LogOut size={15} /> Sair
              </button>
            </div>
          )}
          <button
            type="button"
            className="sidebar__usuario"
            aria-haspopup="menu"
            aria-expanded={contaAberta}
            onClick={() => setContaAberta((v) => !v)}
          >
            <span className="avatar">{iniciais(usuario?.nome ?? '')}</span>
            <span className="sidebar__usuario-texto">
              <strong>{usuario?.nome}</strong>
              <small>{usuario?.papel}</small>
            </span>
          </button>
        </div>
      </aside>
      <div className="app__fundo" onClick={() => setMenuAberto(false)} aria-hidden />
      <div className="app__principal">
        <button type="button" className="botao-menu" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <Outlet />
      </div>
      <Dialogo
        aberto={confirmarReset}
        titulo="Restaurar dados de demonstração?"
        descricao="Todos os imóveis, clientes, reservas e propostas voltam ao estado inicial. Cadastros e rascunhos feitos por você serão apagados."
        textoConfirmar="Restaurar"
        perigoso
        onCancelar={() => setConfirmarReset(false)}
        onConfirmar={() => {
          restaurarDemo()
          setConfirmarReset(false)
          notificar('Dados de demonstração restaurados.')
        }}
      />
    </div>
  )
}
