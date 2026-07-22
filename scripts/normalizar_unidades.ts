/**
 * Normaliza, de forma idempotente, as unidades legadas dos itens.
 *
 * Antes deste recurso, o campo `unidade` do Item guardava um número (herança da
 * coluna "Uni." da planilha de origem). Agora `unidade` é a unidade de medida
 * (un, par, cx…) e a quantidade vive em ItemPosto.quantidadeEsperada.
 *
 * Este script converte todo `unidade` puramente numérico (ex.: "1", "2") para o
 * padrão "un", sem tocar em itens que já têm unidade de medida válida.
 *
 * Uso:  DATABASE_URL=... bun scripts/normalizar_unidades.ts
 * Rode primeiro em LOCAL. É seguro rodar mais de uma vez (idempotente).
 */
import { db } from '../src/lib/db'
import { UNIDADE_PADRAO } from '../src/lib/unidades'

async function main() {
  const itens = await db.item.findMany({ select: { id: true, unidade: true } })

  const legados = itens.filter(i => /^\d+$/.test((i.unidade || '').trim()))
  if (legados.length === 0) {
    console.log('✓ Nenhum item com unidade numérica legada. Nada a fazer.')
    return
  }

  console.log(`Encontrados ${legados.length} itens com unidade numérica legada → "${UNIDADE_PADRAO}".`)
  const result = await db.item.updateMany({
    where: { id: { in: legados.map(i => i.id) } },
    data: { unidade: UNIDADE_PADRAO },
  })
  console.log(`✓ ${result.count} itens atualizados para "${UNIDADE_PADRAO}".`)
}

main()
  .catch(e => { console.error('Erro:', e); process.exit(1) })
  .finally(() => db.$disconnect())
