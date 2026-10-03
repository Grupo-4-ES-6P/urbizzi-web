import { Navigate, Route, Routes } from 'react-router-dom';
import { ListaClientes } from './pages/clientes/ListaClientes';
import { NovoCliente } from './pages/clientes/NovoCliente';
import { EditarCliente } from './pages/clientes/EditarCliente';
import { DetalheReserva, ListaReservas, NovaReserva } from './features/reservas';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/clientes" replace />} />
      <Route path="/clientes" element={<ListaClientes />} />
      <Route path="/clientes/novo" element={<NovoCliente />} />
      <Route path="/clientes/:id/editar" element={<EditarCliente />} />
      <Route path="/reservas" element={<ListaReservas />} />
      <Route path="/reservas/nova" element={<NovaReserva />} />
      <Route path="/reservas/:id" element={<DetalheReserva />} />
    </Routes>
  );
}

export default App;
