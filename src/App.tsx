import { Navigate, Route, Routes } from 'react-router-dom';
import { ListaClientes } from './pages/clientes/ListaClientes';
import { NovoCliente } from './pages/clientes/NovoCliente';
import { EditarCliente } from './pages/clientes/EditarCliente';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/clientes" replace />} />
      <Route path="/clientes" element={<ListaClientes />} />
      <Route path="/clientes/novo" element={<NovoCliente />} />
      <Route path="/clientes/:id/editar" element={<EditarCliente />} />
    </Routes>
  );
}

export default App;
