import { useState, type FormEvent } from 'react';
import { formatTelefoneBR } from '../../utils/phoneMask';
import { formatCep } from '../../utils/cepMask';
import { formatCpfCnpj } from '../../utils/cpfCnpj';
import { validateClienteForm, type ClienteFormValues } from '../../utils/clienteValidation';
import type { Endereco, TipoPessoa } from '../../types/Cliente';
import { Switch } from '../ui/Switch';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import styles from './ClienteForm.module.css';

export type { ClienteFormValues };

interface ClienteFormProps {
  formId: string;
  initialValues?: ClienteFormValues;
  onSubmit: (values: ClienteFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  submittingLabel?: string;
}

const ENDERECO_VAZIO: Endereco = {
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  pais: 'Brasil',
  complemento: '',
};

const EMPTY_VALUES: ClienteFormValues = {
  nome_completo: '',
  telefone: '',
  email: '',
  ativo: true,
  tipo_pessoa: 'fisica',
  cpf_cnpj: '',
  data_nascimento: '',
  estado_civil: '',
  profissao: '',
  endereco: ENDERECO_VAZIO,
};

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável'];

type FieldName = 'nome_completo' | 'telefone' | 'email' | 'cpf_cnpj' | 'data_nascimento';
type EnderecoFieldName = 'cep' | 'rua' | 'bairro' | 'cidade' | 'uf' | 'pais';

export function ClienteForm({
  formId,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Salvar Cliente',
  submittingLabel = 'Salvando...',
}: ClienteFormProps) {
  const [values, setValues] = useState<ClienteFormValues>(initialValues ?? EMPTY_VALUES);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    nome_completo: false,
    telefone: false,
    email: false,
    cpf_cnpj: false,
    data_nascimento: false,
  });
  const [enderecoTouched, setEnderecoTouched] = useState<Record<EnderecoFieldName, boolean>>({
    cep: false,
    rua: false,
    bairro: false,
    cidade: false,
    uf: false,
    pais: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const errors = validateClienteForm(values);
  const isValid = Object.keys(errors).length === 0;

  function handleChange(field: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleBlur(field: FieldName) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function errorFor(field: FieldName) {
    return touched[field] ? errors[field] : undefined;
  }

  function setField<K extends keyof ClienteFormValues>(field: K, value: ClienteFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleTipoPessoaChange(tipo: TipoPessoa) {
    setValues((prev) => ({
      ...prev,
      tipo_pessoa: tipo,
      cpf_cnpj: formatCpfCnpj(prev.cpf_cnpj, tipo),
      ...(tipo === 'juridica' ? { estado_civil: '', profissao: '' } : {}),
    }));
  }

  function handleEnderecoChange(field: keyof Endereco, value: string) {
    setValues((prev) => ({ ...prev, endereco: { ...prev.endereco, [field]: value } }));
  }

  function handleEnderecoBlur(field: EnderecoFieldName) {
    setEnderecoTouched((prev) => ({ ...prev, [field]: true }));
  }

  function enderecoErrorFor(field: EnderecoFieldName) {
    return enderecoTouched[field] ? errors.endereco?.[field] : undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ nome_completo: true, telefone: true, email: true, cpf_cnpj: true, data_nascimento: true });
    setEnderecoTouched({ cep: true, rua: true, bairro: true, cidade: true, uf: true, pais: true });

    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClear() {
    setValues(EMPTY_VALUES);
    setTouched({ nome_completo: false, telefone: false, email: false, cpf_cnpj: false, data_nascimento: false });
    setEnderecoTouched({ cep: false, rua: false, bairro: false, cidade: false, uf: false, pais: false });
    setShowClearConfirm(false);
  }

  return (
    <form id={formId} className={styles.form} onSubmit={handleSubmit} noValidate>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Identificação</h2>
        <p className={styles.sectionNote}>Dados que identificam o cliente no cadastro.</p>

        <div className={`${styles.grid} ${styles.gridCols3}`}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label} htmlFor="nome_completo">
              Nome Completo / Razão Social
            </label>
            <input
              id="nome_completo"
              className={styles.input}
              type="text"
              value={values.nome_completo}
              onChange={(event) => handleChange('nome_completo', event.target.value)}
              onBlur={() => handleBlur('nome_completo')}
              placeholder="Ex.: Maria da Silva"
            />
            {errorFor('nome_completo') && <p className={styles.error}>{errorFor('nome_completo')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tipo_pessoa">
              Tipo de pessoa
            </label>
            <select
              id="tipo_pessoa"
              className={styles.input}
              value={values.tipo_pessoa}
              onChange={(event) => handleTipoPessoaChange(event.target.value as TipoPessoa)}
            >
              <option value="fisica">Pessoa física</option>
              <option value="juridica">Pessoa jurídica</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cpf_cnpj">
              {values.tipo_pessoa === 'fisica' ? 'CPF' : 'CNPJ'}
            </label>
            <input
              id="cpf_cnpj"
              className={styles.input}
              type="text"
              inputMode="numeric"
              value={values.cpf_cnpj}
              onChange={(event) => handleChange('cpf_cnpj', formatCpfCnpj(event.target.value, values.tipo_pessoa))}
              onBlur={() => handleBlur('cpf_cnpj')}
              placeholder={values.tipo_pessoa === 'fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
            />
            {errorFor('cpf_cnpj') && <p className={styles.error}>{errorFor('cpf_cnpj')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="data_nascimento">
              Data de nascimento
            </label>
            <input
              id="data_nascimento"
              className={styles.input}
              type="date"
              value={values.data_nascimento}
              onChange={(event) => handleChange('data_nascimento', event.target.value)}
              onBlur={() => handleBlur('data_nascimento')}
            />
            {errorFor('data_nascimento') && <p className={styles.error}>{errorFor('data_nascimento')}</p>}
          </div>

          {values.tipo_pessoa === 'fisica' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="estado_civil">
                Estado civil
              </label>
              <select
                id="estado_civil"
                className={styles.input}
                value={values.estado_civil}
                onChange={(event) => setField('estado_civil', event.target.value)}
              >
                <option value="">Selecione</option>
                {ESTADOS_CIVIS.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            </div>
          )}

          {values.tipo_pessoa === 'fisica' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="profissao">
                Profissão
              </label>
              <input
                id="profissao"
                className={styles.input}
                type="text"
                value={values.profissao}
                onChange={(event) => setField('profissao', event.target.value)}
                placeholder="Ex.: Engenheira civil"
              />
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>Status</span>
            <Switch
              id="ativo"
              checked={values.ativo}
              onChange={(checked) => setField('ativo', checked)}
              label={values.ativo ? 'Ativo' : 'Inativo'}
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contato</h2>
        <p className={styles.sectionNote}>Pelo menos um telefone ou e-mail é obrigatório.</p>

        <div className={`${styles.grid} ${styles.gridCols2}`}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="telefone">
              Telefone
            </label>
            <input
              id="telefone"
              className={styles.input}
              type="tel"
              value={values.telefone}
              onChange={(event) => handleChange('telefone', formatTelefoneBR(event.target.value))}
              onBlur={() => handleBlur('telefone')}
              placeholder="(11) 91234-5678"
            />
            {errorFor('telefone') && <p className={styles.error}>{errorFor('telefone')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              className={styles.input}
              type="email"
              value={values.email}
              onChange={(event) => handleChange('email', event.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="nome@email.com"
            />
            {errorFor('email') && <p className={styles.error}>{errorFor('email')}</p>}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Endereço</h2>
        <p className={styles.sectionNote}>Preenchimento automático a partir do CEP.</p>

        <div className={`${styles.grid} ${styles.gridCols4}`}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cep">
              CEP
            </label>
            <input
              id="cep"
              className={styles.input}
              type="text"
              inputMode="numeric"
              value={values.endereco.cep}
              onChange={(event) => handleEnderecoChange('cep', formatCep(event.target.value))}
              onBlur={() => handleEnderecoBlur('cep')}
              placeholder="00000-000"
            />
            {enderecoErrorFor('cep') && <p className={styles.error}>{enderecoErrorFor('cep')}</p>}
          </div>

          <div className={`${styles.field} ${styles.fieldSpan2}`}>
            <label className={styles.label} htmlFor="rua">
              Rua
            </label>
            <input
              id="rua"
              className={styles.input}
              type="text"
              value={values.endereco.rua}
              onChange={(event) => handleEnderecoChange('rua', event.target.value)}
              onBlur={() => handleEnderecoBlur('rua')}
              placeholder="Ex.: Av. Paulista"
            />
            {enderecoErrorFor('rua') && <p className={styles.error}>{enderecoErrorFor('rua')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="numero">
              Número
            </label>
            <input
              id="numero"
              className={styles.input}
              type="text"
              value={values.endereco.numero}
              onChange={(event) => handleEnderecoChange('numero', event.target.value)}
              placeholder="123"
            />
          </div>

          <div className={`${styles.field} ${styles.fieldSpan2}`}>
            <label className={styles.label} htmlFor="bairro">
              Bairro
            </label>
            <input
              id="bairro"
              className={styles.input}
              type="text"
              value={values.endereco.bairro}
              onChange={(event) => handleEnderecoChange('bairro', event.target.value)}
              onBlur={() => handleEnderecoBlur('bairro')}
              placeholder="Ex.: Bela Vista"
            />
            {enderecoErrorFor('bairro') && <p className={styles.error}>{enderecoErrorFor('bairro')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="cidade">
              Cidade
            </label>
            <input
              id="cidade"
              className={styles.input}
              type="text"
              value={values.endereco.cidade}
              onChange={(event) => handleEnderecoChange('cidade', event.target.value)}
              onBlur={() => handleEnderecoBlur('cidade')}
              placeholder="Ex.: São Paulo"
            />
            {enderecoErrorFor('cidade') && <p className={styles.error}>{enderecoErrorFor('cidade')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="uf">
              UF
            </label>
            <input
              id="uf"
              className={styles.input}
              type="text"
              maxLength={2}
              value={values.endereco.uf}
              onChange={(event) => handleEnderecoChange('uf', event.target.value.toUpperCase())}
              onBlur={() => handleEnderecoBlur('uf')}
              placeholder="Ex.: SP"
            />
            {enderecoErrorFor('uf') && <p className={styles.error}>{enderecoErrorFor('uf')}</p>}
          </div>

          <div className={`${styles.field} ${styles.fieldSpan2}`}>
            <label className={styles.label} htmlFor="pais">
              País
            </label>
            <input
              id="pais"
              className={styles.input}
              type="text"
              value={values.endereco.pais}
              onChange={(event) => handleEnderecoChange('pais', event.target.value)}
              onBlur={() => handleEnderecoBlur('pais')}
              placeholder="Ex.: Brasil"
            />
            {enderecoErrorFor('pais') && <p className={styles.error}>{enderecoErrorFor('pais')}</p>}
          </div>

          <div className={`${styles.field} ${styles.fieldSpan2}`}>
            <label className={styles.label} htmlFor="complemento">
              Complemento
            </label>
            <input
              id="complemento"
              className={styles.input}
              type="text"
              value={values.endereco.complemento}
              onChange={(event) => handleEnderecoChange('complemento', event.target.value)}
              placeholder="Ex.: Apto 42 (opcional)"
            />
          </div>
        </div>
      </section>

      <div className={styles.footer}>
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="outline" type="button" onClick={() => setShowClearConfirm(true)}>
          Limpar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>

      {showClearConfirm && (
        <ConfirmDialog
          message="Tem certeza que quer limpar todos os campos?"
          confirmLabel="Limpar"
          onConfirm={handleClear}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </form>
  );
}
