// Normaliza a configuração de postos de um item, aceitando dois formatos:
//   1. Legado:  ["postoId1", "postoId2"]                        → default 1 / obrigatório
//   2. Novo:    [{ postoId, quantidadeEsperada, obrigatorio }]  → valores explícitos
// Retorna sempre a forma canônica, deduplicada por postoId e com quantidade >= 1.

export interface PostoConfig {
  postoId: string
  quantidadeEsperada: number
  obrigatorio: boolean
}

export function normalizarPostos(input: unknown): PostoConfig[] {
  if (!Array.isArray(input)) return []

  const porPosto = new Map<string, PostoConfig>()
  for (const entry of input) {
    let postoId: string | undefined
    let quantidadeEsperada = 1
    let obrigatorio = true

    if (typeof entry === 'string') {
      postoId = entry
    } else if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>
      postoId = typeof e.postoId === 'string' ? e.postoId : undefined
      const q = Number(e.quantidadeEsperada)
      if (Number.isFinite(q) && q >= 1) quantidadeEsperada = Math.floor(q)
      if (e.obrigatorio !== undefined) obrigatorio = !!e.obrigatorio
    }

    if (!postoId) continue
    porPosto.set(postoId, { postoId, quantidadeEsperada, obrigatorio })
  }
  return Array.from(porPosto.values())
}
