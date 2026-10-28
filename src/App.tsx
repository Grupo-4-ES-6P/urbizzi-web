import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TemaProvider } from './contexts/TemaContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppLayout } from './layouts/AppLayout'
import { ClienteFormPage } from './pages/clientes/ClienteFormPage'
import { ClientesPage } from './pages/clientes/ClientesPage'
import { DashboardPage } from './pages/DashboardPage'
import { EmConstrucaoPage } from './pages/EmConstrucaoPage'
import { ImovelFormPage } from './pages/imovel/ImovelFormPage'
import { ImoveisPage } from './pages/imovel/ImoveisPage'
import { HistoricoPage } from './pages/imovel/HistoricoPage'
import { LoginPage } from './pages/LoginPage'
import { LoteamentosPage } from './pages/loteamento/LoteamentosPage'
import { AcoesPage } from './pages/imovel/AcoesPage'
import { DocumentosPage } from './pages/imovel/DocumentosPage'
import { NovaQuadraPage } from './pages/quadra/NovaQuadraPage'
import { QuadraPage } from './pages/quadra/QuadraPage'
import { DetalhePropostaPage } from './pages/propostas/DetalhePropostaPage'
import { NovaPropostaPage } from './pages/propostas/NovaPropostaPage'
import { CatalogoPage } from './pages/publico/CatalogoPage'
import { EmBrevePublicoPage } from './pages/publico/EmBrevePublicoPage'
import { SiteLayout } from './pages/publico/SiteLayout'
import { VendasPage } from './pages/vendas/VendasPage'

function Protegida({ children }: Readonly<{ children: ReactNode }>) {
  const { usuario } = useAuth()
  const location = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />
  return <>{children}</>
}

function SomenteVisitante({ children }: Readonly<{ children: ReactNode }>) {
  const { usuario } = useAuth()
  const location = useLocation()
  // Depois do login, volta para a página que exigiu autenticação.
  const destino = (location.state as { de?: string } | null)?.de ?? '/dashboard'
  return usuario ? <Navigate to={destino} replace /> : <>{children}</>
}

export function Rotas() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <SomenteVisitante>
            <LoginPage />
          </SomenteVisitante>
        }
      />
      <Route
        element={
          <Protegida>
            <AppLayout />
          </Protegida>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/imoveis" element={<ImoveisPage />} />
        <Route path="/imoveis/novo" element={<ImovelFormPage />} />
        <Route path="/imoveis/:id" element={<ImovelFormPage />} />
        <Route path="/imoveis/:id/historico" element={<HistoricoPage />} />
        <Route path="/imoveis/:id/acoes" element={<AcoesPage />} />
        <Route path="/imoveis/:id/documentos" element={<DocumentosPage />} />
        <Route path="/loteamentos" element={<LoteamentosPage />} />
        <Route path="/loteamentos/novo" element={<EmConstrucaoPage titulo="Loteamentos" />} />
        <Route path="/loteamentos/:id" element={<EmConstrucaoPage titulo="Loteamentos" />} />
        <Route path="/loteamentos/:id/mapa" element={<EmConstrucaoPage titulo="Loteamentos" />} />
        <Route path="/loteamentos/:id/quadras/nova" element={<NovaQuadraPage />} />
        <Route path="/loteamentos/:id/quadras/:quadraId" element={<QuadraPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/novo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteFormPage />} />
        <Route path="/propostas" element={<EmConstrucaoPage titulo="Propostas" />} />
        <Route path="/propostas/nova" element={<NovaPropostaPage />} />
        <Route path="/propostas/:id" element={<DetalhePropostaPage />} />
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/relatorios" element={<EmConstrucaoPage titulo="Relatórios" />} />
        <Route path="/usuarios" element={<EmConstrucaoPage titulo="Usuários" />} />
      </Route>
      {/* Site público: não exige login */}
      <Route element={<SiteLayout />}>
        <Route path="/terrenos" element={<CatalogoPage />} />
        <Route path="/terrenos/:id" element={<EmBrevePublicoPage titulo="Terreno" />} />
        <Route path="/empreendimentos" element={<EmBrevePublicoPage titulo="Empreendimentos" />} />
        <Route path="/financiamento" element={<EmBrevePublicoPage titulo="Financiamento" />} />
        <Route path="/contato" element={<EmBrevePublicoPage titulo="Contato" />} />
        <Route path="/inicio" element={<EmBrevePublicoPage titulo="Inicio" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <TemaProvider>
      <ToastProvider>
        <AuthProvider>
          <Rotas />
        </AuthProvider>
      </ToastProvider>
    </TemaProvider>
  )
}
