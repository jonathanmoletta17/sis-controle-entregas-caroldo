// Lista curada de unidades de medida para itens do catálogo.
// Para acrescentar/ajustar uma unidade, edite este array — nenhuma outra mudança é necessária.
// (Decisão do usuário: lista fixa, sem campo livre, para manter padronização nos relatórios.)

export const UNIDADES_MEDIDA = [
  { valor: 'un', label: 'un — unidade' },
  { valor: 'par', label: 'par' },
  { valor: 'cj', label: 'cj — conjunto' },
  { valor: 'jogo', label: 'jogo' },
  { valor: 'cx', label: 'cx — caixa' },
  { valor: 'pct', label: 'pct — pacote' },
  { valor: 'rolo', label: 'rolo' },
  { valor: 'kg', label: 'kg — quilograma' },
  { valor: 'g', label: 'g — grama' },
  { valor: 'L', label: 'L — litro' },
  { valor: 'mL', label: 'mL — mililitro' },
  { valor: 'm', label: 'm — metro' },
  { valor: 'cm', label: 'cm — centímetro' },
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
