import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { ClienteForm, type ClienteFormValues } from '../../components/clientes/ClienteForm';
import { atualizarCliente, buscarClientePorId } from '../../api/clientes';

const FORM_ID = 'editar-cliente-form';

export function EditarCliente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState<ClienteFormValues>();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const clienteId = Number(id);

    buscarClientePorId(clienteId).then((cliente) => {
      if (!cliente) {
        setNotFound(true);
        return;
      }

      setInitialValues({
        nome_completo: cliente.nome_completo,
        telefone: cliente.telefone,
        email: cliente.email,
        ativo: cliente.ativo,
        tipo_pessoa: cliente.tipo_pessoa,
        cpf_cnpj: cliente.cpf_cnpj,
        data_nascimento: cliente.data_nascimento,
        estado_civil: cliente.estado_civil,
        profissao: cliente.profissao,
        endereco: cliente.endereco,
      });
    });
  }, [id]);

  async function handleSubmit(values: ClienteFormValues) {
    await atualizarCliente(Number(id), values);
    navigate('/clientes');
  }

  if (notFound) {
    return (
      <Layout>
        <PageHeader breadcrumb="Clientes › Editar cliente" title="Cliente não encontrado" />
        <Button type="button" onClick={() => navigate('/clientes')}>
          Voltar para clientes
        </Button>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        breadcrumb="Clientes › Editar cliente"
        title="Editar cliente"
        description="Atualize os dados de contato do cliente."
      />
      {initialValues && (
        <ClienteForm
          formId={FORM_ID}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/clientes')}
          submitLabel="Salvar alterações"
        />
      )}
    </Layout>
  );
}
