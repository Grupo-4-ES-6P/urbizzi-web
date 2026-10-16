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
import { ImovelFormPage } from './pages/ImovelFormPage'
import { ImoveisPage } from './pages/ImoveisPage'
import { AcoesPage } from './pages/imovel/AcoesPage'
import { DocumentosPage } from './pages/imovel/DocumentosPage'
import { HistoricoPage } from './pages/imovel/HistoricoPage'
import { LoginPage } from './pages/LoginPage'
import { LoteamentoFormPage } from './pages/loteamento/LoteamentoFormPage'
import { LoteamentosPage } from './pages/loteamento/LoteamentosPage'
import { MapaLoteamentoPage } from './pages/loteamento/MapaLoteamentoPage'
import { NovaQuadraPage } from './pages/loteamento/NovaQuadraPage'
import { PropostaDocumentoPage } from './pages/propostas/PropostaDocumentoPage'
import { PropostaFormPage } from './pages/propostas/PropostaFormPage'
import { PropostaPage } from './pages/propostas/PropostaPage'
import { PropostasPage } from './pages/propostas/PropostasPage'
import { VersoesPropostaPage } from './pages/propostas/VersoesPropostaPage'
import { CatalogoPage } from './pages/publico/CatalogoPage'
import { DetalheTerrenoPage } from './pages/publico/DetalheTerrenoPage'
import { EmBrevePublicoPage } from './pages/publico/EmBrevePublicoPage'
import { SiteLayout } from './pages/publico/SiteLayout'
import { QuadraPage } from './pages/quadra/QuadraPage'
import { NovaReservaPage } from './pages/reservas/NovaReservaPage'
import { ReservaPage } from './pages/reservas/ReservaPage'
import { ReservasPage } from './pages/reservas/ReservasPage'
import { NovaVendaPage } from './pages/vendas/NovaVendaPage'
import { VendaPage } from './pages/vendas/VendaPage'
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
        <Route path="/imoveis/loteamentos" element={<LoteamentosPage />} />
        <Route path="/imoveis/loteamentos/novo" element={<LoteamentoFormPage />} />
        <Route path="/imoveis/loteamentos/:id" element={<LoteamentoFormPage />} />
        <Route path="/imoveis/loteamentos/:id/mapa" element={<MapaLoteamentoPage />} />
        <Route path="/imoveis/loteamentos/:id/quadras/nova" element={<NovaQuadraPage />} />
        <Route path="/imoveis/loteamentos/:id/quadras/:quadraId" element={<QuadraPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/novo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteFormPage />} />
        <Route path="/reservas" element={<ReservasPage />} />
        <Route path="/reservas/nova" element={<NovaReservaPage />} />
        <Route path="/reservas/:id" element={<ReservaPage />} />
        <Route path="/propostas" element={<PropostasPage />} />
        <Route path="/propostas/nova" element={<PropostaFormPage modo="nova" />} />
        <Route path="/propostas/:id" element={<PropostaPage />} />
        <Route path="/propostas/:id/documento" element={<PropostaDocumentoPage />} />
        <Route path="/propostas/:id/editar" element={<PropostaFormPage modo="editar" />} />
        <Route path="/propostas/:id/versoes" element={<VersoesPropostaPage />} />
        <Route path="/propostas/:id/versoes/nova" element={<PropostaFormPage modo="versao" />} />
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/vendas/nova" element={<NovaVendaPage />} />
        <Route path="/vendas/:id" element={<VendaPage />} />
        <Route path="/relatorios" element={<EmConstrucaoPage titulo="Relatórios" />} />
        <Route path="/usuarios" element={<EmConstrucaoPage titulo="Usuários" />} />
      </Route>
      {/* Site público: não exige login */}
      <Route element={<SiteLayout />}>
        <Route path="/terrenos" element={<CatalogoPage />} />
        <Route path="/terrenos/:id" element={<DetalheTerrenoPage />} />
        <Route path="/empreendimentos" element={<EmBrevePublicoPage titulo="Empreendimentos" />} />
        <Route path="/financiamento" element={<EmBrevePublicoPage titulo="Financiamento" />} />
        <Route path="/contato" element={<EmBrevePublicoPage titulo="Contato" />} />
        <Route path="/inicio" element={<Navigate to="/terrenos" replace />} />
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
