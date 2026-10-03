import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { PageHeader } from '../../components/layout/PageHeader';
import { ClienteForm, type ClienteFormValues } from '../../components/clientes/ClienteForm';
import { criarCliente } from '../../api/clientes/clientes';

const FORM_ID = 'novo-cliente-form';

export function NovoCliente() {
  const navigate = useNavigate();

  async function handleSubmit(values: ClienteFormValues) {
    await criarCliente(values);
    navigate('/clientes');
  }

  return (
    <Layout>
      <PageHeader
        breadcrumb="Clientes › Novo cliente"
        title="Novo cliente"
        description="Cadastre um novo cliente informando os dados de contato."
      />
      <ClienteForm formId={FORM_ID} onSubmit={handleSubmit} onCancel={() => navigate('/clientes')} />
    </Layout>
  );
}
