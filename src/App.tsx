import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EmConstrucaoPage } from './pages/EmConstrucaoPage'
import { ImovelFormPage } from './pages/ImovelFormPage'
import { ImoveisPage } from './pages/ImoveisPage'
import { LoginPage } from './pages/LoginPage'

function Protegida({ children }: Readonly<{ children: ReactNode }>) {
  const { usuario } = useAuth()
  const location = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ de: location.pathname + location.search }} />
  return children
}

function SomenteVisitante({ children }: Readonly<{ children: ReactNode }>) {
  const { usuario } = useAuth()
  const location = useLocation()
  // Depois do login, volta para a página que exigiu autenticação.
  const destino = (location.state as { de?: string } | null)?.de ?? '/dashboard'
  return usuario ? <Navigate to={destino} replace /> : children
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
        <Route path="/clientes" element={<EmConstrucaoPage titulo="Clientes" />} />
        <Route path="/reservas" element={<EmConstrucaoPage titulo="Reservas" />} />
        <Route path="/propostas" element={<EmConstrucaoPage titulo="Propostas" />} />
        <Route path="/vendas" element={<EmConstrucaoPage titulo="Vendas" />} />
        <Route path="/relatorios" element={<EmConstrucaoPage titulo="Relatórios" />} />
        <Route path="/usuarios" element={<EmConstrucaoPage titulo="Usuários" />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </ToastProvider>
  )
}
