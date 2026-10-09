import { ImagePlus, Star, Trash2 } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'

import { Spinner } from './ui'

const TIPOS = ['image/jpeg', 'image/png']
const TAMANHO_MAX = 5 * 1024 * 1024
const MAX_FOTOS = 10
const LADO_MAX = 1280

interface FotosImovelProps {
  fotos: string[]
  onChange: (fotos: string[]) => void
  erro?: string
  onAviso: (mensagem: string) => void
}

/** Redimensiona para caber no armazenamento local sem perder qualidade visível. */
async function prepararFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Imagem inválida'))
      el.src = url
    })
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * escala)
    canvas.height = Math.round(img.height * escala)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff' // PNG transparente não fica preto no JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function FotosImovel({ fotos, onChange, erro, onAviso }: Readonly<FotosImovelProps>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)
  const [processando, setProcessando] = useState(0)

  const adicionar = async (lista: FileList | File[]) => {
    const arquivos = Array.from(lista)
    const recusados: string[] = []
    const validos = arquivos.filter((a) => {
      if (!TIPOS.includes(a.type)) recusados.push(`${a.name}: use JPG ou PNG`)
      else if (a.size > TAMANHO_MAX) recusados.push(`${a.name}: maior que 5 MB`)
      else return true
      return false
    })
    const vagas = MAX_FOTOS - fotos.length
    if (validos.length > vagas) recusados.push(`limite de ${MAX_FOTOS} fotos por imóvel`)
    const aceitos = validos.slice(0, Math.max(vagas, 0))
    if (recusados.length) onAviso(`Algumas imagens foram ignoradas — ${recusados.join('; ')}.`)
    if (!aceitos.length) return

    setProcessando(aceitos.length)
    // Processa todas em paralelo; uma imagem com defeito não impede as outras.
    const resultados = await Promise.allSettled(aceitos.map(prepararFoto))
    const prontas: string[] = []
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') prontas.push(r.value)
      else onAviso(`Não foi possível ler ${aceitos[i].name}.`)
    })
    setProcessando(0)
    onChange([...fotos, ...prontas])
  }

  const receber = (lista: FileList | File[]) => {
    adicionar(lista).catch(() => {
      setProcessando(0)
      onAviso('Não foi possível processar as imagens.')
    })
  }

  const aoSoltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    if (e.dataTransfer.files.length) receber(e.dataTransfer.files)
  }

  const tornarCapa = (indice: number) => {
    const copia = [...fotos]
    const [foto] = copia.splice(indice, 1)
    onChange([foto, ...copia])
  }

  return (
    <div className="fotos">
      <button
        type="button"
        className={`fotos__zona ${arrastando ? 'fotos__zona--ativa' : ''} ${erro ? 'fotos__zona--erro' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        disabled={processando > 0 || fotos.length >= MAX_FOTOS}
        aria-describedby={erro ? 'fotos-erro' : undefined}
      >
        {processando > 0 ? (
          <>
            <Spinner /> Processando {processando} {processando === 1 ? 'imagem' : 'imagens'}…
          </>
        ) : (
          <>
            <ImagePlus size={20} aria-hidden />
            <strong>{fotos.length >= MAX_FOTOS ? 'Limite de fotos atingido' : 'Arraste imagens aqui'}</strong>
            <small>ou clique para escolher · JPG ou PNG até 5 MB cada</small>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={TIPOS.join(',')}
        multiple
        hidden
        aria-label="Selecionar fotos do imóvel"
        onChange={(e) => {
          if (e.target.files) receber(e.target.files)
          e.target.value = ''
        }}
      />
      {erro && (
        <span id="fotos-erro" className="campo__erro">
          {erro}
        </span>
      )}

      <ul className="fotos__grade">
        {fotos.map((foto, i) => (
          <li key={`${i}-${foto.slice(-24)}`} className="fotos__item">
            <img src={foto} alt={i === 0 ? 'Foto de capa' : `Foto ${i + 1}`} />
            {i === 0 && <span className="fotos__capa">Capa</span>}
            <div className="fotos__acoes">
              {i > 0 && (
                <button type="button" onClick={() => tornarCapa(i)} aria-label={`Usar foto ${i + 1} como capa`} title="Usar como capa">
                  <Star size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(fotos.filter((_, j) => j !== i))}
                aria-label={`Remover foto ${i + 1}`}
                title="Remover"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: Math.max(0, 3 - fotos.length) }, (_, i) => (
          <li key={`vazio-${i}`} className="fotos__item fotos__item--vazio" aria-hidden />
        ))}
      </ul>
    </div>
  )
}
