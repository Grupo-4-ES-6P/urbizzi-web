import type { TipoPessoa } from '../types/Cliente';

function formatCpf(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCnpj(digits: string): string {
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatCpfCnpj(value: string, tipoPessoa: TipoPessoa): string {
  const maxLength = tipoPessoa === 'fisica' ? 11 : 14;
  const digits = value.replace(/\D/g, '').slice(0, maxLength);
  return tipoPessoa === 'fisica' ? formatCpf(digits) : formatCnpj(digits);
}

export function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  function digitoVerificador(base: string): number {
    let soma = 0;
    let peso = base.length + 1;
    for (const digito of base) {
      soma += Number(digito) * peso;
      peso--;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  const d1 = digitoVerificador(cpf.slice(0, 9));
  const d2 = digitoVerificador(cpf.slice(0, 9) + d1);

  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  function digitoVerificador(base: string, pesos: number[]): number {
    const soma = base.split('').reduce((acc, digito, index) => acc + Number(digito) * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  const pesosD1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosD2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = digitoVerificador(cnpj.slice(0, 12), pesosD1);
  const d2 = digitoVerificador(cnpj.slice(0, 12) + d1, pesosD2);

  return cnpj === cnpj.slice(0, 12) + String(d1) + String(d2);
}

export function isValidCpfCnpj(value: string, tipoPessoa: TipoPessoa): boolean {
  return tipoPessoa === 'fisica' ? isValidCpf(value) : isValidCnpj(value);
}
