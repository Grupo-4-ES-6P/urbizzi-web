/*Geral*/
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TemaProvider } from './contexts/TemaContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppLayout } from './layouts/AppLayout'
import { SiteLayout } from './pages/publico/SiteLayout'
import { EmConstrucaoPage } from './pages/EmConstrucaoPage'
import { EmBrevePublicoPage } from './pages/publico/EmBrevePublicoPage'
/*Login e Dashboard*/
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
/*Imóveis*/
import { ImoveisPage } from './pages/imovel/ImoveisPage'
import { ImovelFormPage } from './pages/imovel/ImovelFormPage'
import { HistoricoPage } from './pages/imovel/HistoricoPage'
import { AcoesPage } from './pages/imovel/AcoesPage'
import { DocumentosPage } from './pages/imovel/DocumentosPage'
/*Loteamentos*/
import { LoteamentosPage } from './pages/loteamento/LoteamentosPage'
import { NovoLoteamentoPage } from './pages/loteamento/NovoLoteamentoPage'
import { MapaLoteamentoPage } from './pages/loteamento/MapaLoteamentoPage'
import { EditarLoteamentoPage } from './pages/loteamento/EditarLoteamentoPage'
/*Quadras*/
import { NovaQuadraPage } from './pages/quadra/NovaQuadraPage'
import { QuadraPage } from './pages/quadra/QuadraPage'
/*Propostas*/
import { NovaPropostaPage } from './pages/propostas/NovaPropostaPage'
import { DetalhePropostaPage } from './pages/propostas/DetalhePropostaPage'
/*Vendas*/
import { VendasPage } from './pages/vendas/VendasPage'
/*Relatórios*/
import { DivulgacaoPage } from './pages/relatorios/DivulgacaoPage'
/*Clientes*/
import { ClienteFormPage } from './pages/clientes/ClienteFormPage'
import { ClientesPage } from './pages/clientes/ClientesPage'
/*Catálogo Público*/
import { CatalogoPage } from './pages/publico/CatalogoPage'

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
        {/*Links de Páginas de Imóveis*/}
        <Route path="/imoveis" element={<ImoveisPage />} />
        <Route path="/imoveis/novo" element={<ImovelFormPage />} />
        <Route path="/imoveis/:id" element={<ImovelFormPage />} />
        <Route path="/imoveis/:id/historico" element={<HistoricoPage />} />
        <Route path="/imoveis/:id/acoes" element={<AcoesPage />} />
        <Route path="/imoveis/:id/documentos" element={<DocumentosPage />} />
        {/*Links de Páginas de Loteamentos*/}
        <Route path="/loteamentos" element={<LoteamentosPage />} />
        <Route path="/loteamentos/novo" element={<NovoLoteamentoPage />} />
        <Route path="/loteamentos/:id" element={<EditarLoteamentoPage />} />
        <Route path="/loteamentos/:id/mapa" element={<MapaLoteamentoPage />} />
        {/*Links de Páginas de Quadras*/}
        <Route path="/loteamentos/:id/quadras/nova" element={<NovaQuadraPage />} />
        <Route path="/loteamentos/:id/quadras/:quadraId" element={<QuadraPage />} />
        {/*Mesmas telas de loteamento acessadas a partir de Imóveis (links da listagem)*/}
        <Route path="/imoveis/loteamentos" element={<LoteamentosPage />} />
        <Route path="/imoveis/loteamentos/novo" element={<NovoLoteamentoPage />} />
        <Route path="/imoveis/loteamentos/:id" element={<EditarLoteamentoPage />} />
        <Route path="/imoveis/loteamentos/:id/mapa" element={<MapaLoteamentoPage />} />
        <Route path="/imoveis/loteamentos/:id/quadras/nova" element={<NovaQuadraPage />} />
        <Route path="/imoveis/loteamentos/:id/quadras/:quadraId" element={<QuadraPage />} />
        {/*Links de Páginas de Propostas*/}
        <Route path="/propostas" element={<EmConstrucaoPage titulo="Propostas" />} />
        <Route path="/propostas/nova" element={<NovaPropostaPage />} />
        <Route path="/propostas/:id" element={<DetalhePropostaPage />} />
        {/*Links de Páginas de Vendas e Relatórios*/}
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/relatorios" element={<EmConstrucaoPage titulo="Relatórios" />} />
        <Route path="/relatorios/divulgacao" element={<DivulgacaoPage />} />
        {/*Links de Páginas de Clientes*/}
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/novo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteFormPage />} />
        {/*Links de Páginas de Usuários*/}
        <Route path="/usuarios" element={<EmConstrucaoPage titulo="Usuários" />} />
        <Route path="/usuarios/novo" element={<EmConstrucaoPage titulo="Usuários" />} />
        <Route path="/usuarios/:id" element={<EmConstrucaoPage titulo="Usuários" />} />
      </Route>
      {/* Site público: não exige login*/}
      <Route element={<SiteLayout />}>
        <Route path="/terrenos" element={<CatalogoPage />} />
        <Route path="/terrenos/:id" element={<EmBrevePublicoPage titulo="Terreno" />} />
      </Route>
      {/*Failsafe: redireciona qualquer link errado devolta para a dashbaord*/}
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
