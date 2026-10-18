import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TemaProvider } from './contexts/TemaContext'
import { ToastProvider } from './contexts/ToastContext'
import type { Permissao } from './data/types'
import { AppLayout } from './layouts/AppLayout'
import { usePermissao } from './lib/usePermissao'
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
import { NovaReservaPage } from './pages/reservas/NovaReservaPage'
import { ReservaPage } from './pages/reservas/ReservaPage'
import { ReservasPage } from './pages/reservas/ReservasPage'
import { NovaVendaPage } from './pages/vendas/NovaVendaPage'
import { VendaPage } from './pages/vendas/VendaPage'
import { AcessosPage } from './pages/usuarios/AcessosPage'
import { UsuarioPage } from './pages/usuarios/UsuarioPage'
import { UsuariosPage } from './pages/usuarios/UsuariosPage'
import { VendasPage } from './pages/vendas/VendasPage'

function Protegida({ children }: Readonly<{ children: ReactNode }>) {
  const { usuario } = useAuth()
  const location = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />
  return <>{children}</>
}

/** Rota restrita: quem não tem a permissão volta ao dashboard sem ver nada da tela. */
function ComPermissao({ permissao, children }: Readonly<{ permissao: Permissao; children: ReactNode }>) {
  return usePermissao(permissao) ? <>{children}</> : <Navigate to="/dashboard" replace />
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
        <Route
          path="/imoveis/novo"
          element={
            <ComPermissao permissao="cadastrar_imoveis">
              <ImovelFormPage />
            </ComPermissao>
          }
        />
        <Route path="/imoveis/:id" element={<ImovelFormPage />} />
        <Route path="/imoveis/:id/historico" element={<HistoricoPage />} />
        <Route path="/imoveis/:id/acoes" element={<AcoesPage />} />
        <Route path="/imoveis/:id/documentos" element={<DocumentosPage />} />
        <Route path="/imoveis/loteamentos" element={<LoteamentosPage />} />
        <Route
          path="/imoveis/loteamentos/novo"
          element={
            <ComPermissao permissao="cadastrar_imoveis">
              <LoteamentoFormPage />
            </ComPermissao>
          }
        />
        <Route path="/imoveis/loteamentos/:id" element={<LoteamentoFormPage />} />
        <Route path="/imoveis/loteamentos/:id/mapa" element={<MapaLoteamentoPage />} />
        <Route
          path="/imoveis/loteamentos/:id/quadras/nova"
          element={
            <ComPermissao permissao="cadastrar_imoveis">
              <NovaQuadraPage />
            </ComPermissao>
          }
        />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route
          path="/clientes/novo"
          element={
            <ComPermissao permissao="gerenciar_clientes">
              <ClienteFormPage />
            </ComPermissao>
          }
        />
        <Route path="/clientes/:id" element={<ClienteFormPage />} />
        <Route path="/reservas" element={<ReservasPage />} />
        <Route
          path="/reservas/nova"
          element={
            <ComPermissao permissao="registrar_reserva">
              <NovaReservaPage />
            </ComPermissao>
          }
        />
        <Route path="/reservas/:id" element={<ReservaPage />} />
        <Route path="/propostas" element={<PropostasPage />} />
        <Route
          path="/propostas/nova"
          element={
            <ComPermissao permissao="criar_proposta">
              <PropostaFormPage modo="nova" />
            </ComPermissao>
          }
        />
        <Route path="/propostas/:id" element={<PropostaPage />} />
        <Route path="/propostas/:id/documento" element={<PropostaDocumentoPage />} />
        <Route
          path="/propostas/:id/editar"
          element={
            <ComPermissao permissao="criar_proposta">
              <PropostaFormPage modo="editar" />
            </ComPermissao>
          }
        />
        <Route path="/propostas/:id/versoes" element={<VersoesPropostaPage />} />
        <Route
          path="/propostas/:id/versoes/nova"
          element={
            <ComPermissao permissao="criar_proposta">
              <PropostaFormPage modo="versao" />
            </ComPermissao>
          }
        />
        <Route path="/vendas" element={<VendasPage />} />
        <Route
          path="/vendas/nova"
          element={
            <ComPermissao permissao="registrar_venda">
              <NovaVendaPage />
            </ComPermissao>
          }
        />
        <Route path="/vendas/:id" element={<VendaPage />} />
        <Route
          path="/relatorios"
          element={
            <ComPermissao permissao="emitir_relatorios">
              <EmConstrucaoPage titulo="Relatórios" />
            </ComPermissao>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ComPermissao permissao="gerenciar_usuarios">
              <UsuariosPage />
            </ComPermissao>
          }
        />
        <Route
          path="/usuarios/:id"
          element={
            <ComPermissao permissao="gerenciar_usuarios">
              <UsuarioPage />
            </ComPermissao>
          }
        />
        <Route
          path="/usuarios/acessos"
          element={
            <ComPermissao permissao="gerenciar_usuarios">
              <AcessosPage />
            </ComPermissao>
          }
        />
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
