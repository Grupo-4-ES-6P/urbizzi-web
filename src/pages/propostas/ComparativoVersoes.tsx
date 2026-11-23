import { useState } from 'react'

import { Dialogo } from '../../components/Dialogo'
import { Campo } from '../../components/ui'
import type { VersaoProposta } from '../../data/types'
import { compararCondicoes } from '../../lib/propostas'

interface Props {
  aberto: boolean
  versoes: VersaoProposta[]
  onFechar: () => void
}

/** Comparativo lado a lado de duas versões, destacando (com cor e texto) os campos que mudaram. */
export function ComparativoVersoes({ aberto, versoes, onFechar }: Props) {
  const ultima = versoes[versoes.length - 1]?.numero ?? 1
  const [a, setA] = useState(Math.max(1, ultima - 1))
  const [b, setB] = useState(ultima)
  const va = versoes.find((v) => v.numero === a)
  const vb = versoes.find((v) => v.numero === b)
  const linhas = va && vb ? compararCondicoes(va.condicoes, vb.condicoes) : []
  const mudancas = linhas.filter((l) => l.mudou).length

  const seletor = (rotulo: string, valor: number, onChange: (n: number) => void) => (
    <Campo rotulo={rotulo} className="c-6">
      {(p) => (
        <select {...p} className="input select" value={valor} onChange={(e) => onChange(Number(e.target.value))}>
          {versoes.map((v) => (
            <option key={v.numero} value={v.numero}>
              v{v.numero} · {v.autor}
            </option>
          ))}
        </select>
      )}
    </Campo>
  )

  return (
    <Dialogo
      aberto={aberto}
      titulo="Comparar versões"
      descricao={
        a === b
          ? 'Escolha duas versões diferentes.'
          : `${mudancas === 0 ? 'Nenhum campo mudou' : `${mudancas} ${mudancas === 1 ? 'campo mudou' : 'campos mudaram'}`} entre v${a} e v${b}.`
      }
      textoConfirmar="Fechar"
      semCancelar
      largo
      onCancelar={onFechar}
      onConfirmar={onFechar}
    >
      <div className="grade">
        {seletor('Versão A', a, setA)}
        {seletor('Versão B', b, setB)}
      </div>
      <div className="tabela-wrap comparativo">
        <table className="tabela tabela--quebra">
          <thead>
            <tr>
              <th>Campo</th>
              <th>v{a}</th>
              <th>v{b}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave} className={l.mudou ? 'comparativo__mudou' : undefined}>
                <th scope="row">
                  {l.rotulo}
                  {l.mudou && <span className="comparativo__marca">Alterado</span>}
                </th>
                <td>{l.antes}</td>
                <td>{l.depois}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialogo>
  )
}
