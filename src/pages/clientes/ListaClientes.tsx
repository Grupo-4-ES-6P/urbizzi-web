import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { atualizarStatusClientes, excluirClientes, listarClientes } from '../../api/clientes/clientes';
import type { Cliente } from '../../types/Cliente';
import styles from './ListaClientes.module.css';

export function ListaClientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  async function recarregar() {
    const dados = await listarClientes();
    setClientes(dados);
  }

  useEffect(() => {
    let ativo = true;

    listarClientes().then((dados) => {
      if (ativo) {
        setClientes(dados);
        setIsLoading(false);
      }
    });

    return () => {
      ativo = false;
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;

    const termoDigitos = termo.replace(/\D/g, '');

    return clientes.filter((cliente) => {
      const telefoneDigitos = cliente.telefone.replace(/\D/g, '');

      return (
        cliente.nome_completo.toLowerCase().includes(termo) ||
        cliente.email.toLowerCase().includes(termo) ||
        (termoDigitos.length > 0 && telefoneDigitos.includes(termoDigitos))
      );
    });
  }, [clientes, busca]);

  const todosFiltradosSelecionados =
    clientesFiltrados.length > 0 && clientesFiltrados.every((cliente) => selecionados.has(cliente.id_cliente));

  function alternarSelecao(id: number) {
    setSelecionados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionados((prev) => {
      if (todosFiltradosSelecionados) {
        const proximo = new Set(prev);
        clientesFiltrados.forEach((cliente) => proximo.delete(cliente.id_cliente));
        return proximo;
      }

      const proximo = new Set(prev);
      clientesFiltrados.forEach((cliente) => proximo.add(cliente.id_cliente));
      return proximo;
    });
  }

  async function handleAlterarStatus(ativo: boolean) {
    await atualizarStatusClientes([...selecionados], ativo);
    setSelecionados(new Set());
    await recarregar();
  }

  async function handleExcluir() {
    await excluirClientes([...selecionados]);
    setSelecionados(new Set());
    setConfirmandoExclusao(false);
    await recarregar();
  }

  const quantidadeSelecionada = selecionados.size;

  return (
    <Layout>
      <PageHeader
        breadcrumb="Clientes"
        title="Clientes"
        description="Listagem de clientes cadastrados."
        actions={
          <Link to="/clientes/novo">
            <Button type="button">Novo cliente</Button>
          </Link>
        }
      />

      {!isLoading && clientes.length === 0 && (
        <p className={styles.empty}>Nenhum cliente cadastrado ainda.</p>
      )}

      {clientes.length > 0 && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={18} aria-hidden="true" />
              <input
                type="search"
                className={styles.search}
                placeholder="Buscar por nome, telefone ou e-mail"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                aria-label="Buscar clientes"
              />
            </div>

            {quantidadeSelecionada > 0 && (
              <div className={styles.bulkActions}>
                <span className={styles.bulkCount}>{quantidadeSelecionada} selecionado(s)</span>
                <Button variant="outline" type="button" onClick={() => handleAlterarStatus(true)}>
                  Ativar
                </Button>
                <Button variant="outline" type="button" onClick={() => handleAlterarStatus(false)}>
                  Desativar
                </Button>
                <Button type="button" onClick={() => setConfirmandoExclusao(true)}>
                  Excluir
                </Button>
              </div>
            )}
          </div>

          <p className={styles.hint}>Dê duplo clique em um cliente para editar.</p>

          {clientesFiltrados.length === 0 ? (
            <p className={styles.empty}>Nenhum cliente encontrado para "{busca.trim()}".</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os clientes"
                      checked={todosFiltradosSelecionados}
                      onChange={alternarSelecionarTodos}
                    />
                  </th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr
                    key={cliente.id_cliente}
                    className={styles.row}
                    onDoubleClick={() => navigate(`/clientes/${cliente.id_cliente}/editar`)}
                  >
                    <td
                      className={styles.checkboxCell}
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${cliente.nome_completo}`}
                        checked={selecionados.has(cliente.id_cliente)}
                        onChange={() => alternarSelecao(cliente.id_cliente)}
                      />
                    </td>
                    <td>{cliente.nome_completo}</td>
                    <td>{cliente.telefone || '—'}</td>
                    <td>{cliente.email || '—'}</td>
                    <td>
                      <span className={cliente.ativo ? styles.badgeAtivo : styles.badgeInativo}>
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {confirmandoExclusao && (
        <ConfirmDialog
          message={`Tem certeza que deseja excluir ${quantidadeSelecionada} cliente${
            quantidadeSelecionada === 1 ? '' : 's'
          } permanentemente?`}
          confirmLabel="Excluir"
          onConfirm={handleExcluir}
          onCancel={() => setConfirmandoExclusao(false)}
        />
      )}
    </Layout>
  );
}
