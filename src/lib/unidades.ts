// Unidades de medida para itens do catálogo — enxutas para o contexto de
// controle de ENTREGA (conta-se peça entregue, não medida contínua).
// Para acrescentar/ajustar, edite este array — nenhuma outra mudança é necessária.

export const UNIDADES_MEDIDA = [
  { valor: 'un', label: 'un — unidade' },
  { valor: 'par', label: 'par' },
  { valor: 'caixa', label: 'caixa' },
  { valor: 'metro', label: 'metro' },
  { valor: 'litro', label: 'litro' },
] as const

export const UNIDADES_VALORES = UNIDADES_MEDIDA.map(u => u.valor) as readonly string[]

export const UNIDADE_PADRAO = 'un'

// Valida/normaliza um valor de unidade recebido. Aceita valores legados numéricos
// (ex.: "1", "2") preservando-os para não quebrar itens antigos; caso contrário,
// exige que esteja na lista, senão cai no padrão.
export function normalizarUnidade(valor: unknown): string {
  const v = String(valor ?? '').trim()
  if (!v) return UNIDADE_PADRAO
  if (UNIDADES_VALORES.includes(v)) return v
  if (/^\d+$/.test(v)) return v // legado: quantidade numérica gravada como unidade
  return UNIDADE_PADRAO
}
