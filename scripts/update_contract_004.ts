/**
 * Renumera, de forma idempotente, o contrato 003/2026 para 004/2026.
 * O registro e todos os seus vínculos são preservados; somente `numero` muda.
 */
import { db } from '../src/lib/db'

const NUMERO_ANTERIOR = '003/2026'
const NUMERO_ATUAL = '004/2026'

async function main() {
  const [anterior, atual] = await Promise.all([
    db.contrato.findUnique({ where: { numero: NUMERO_ANTERIOR } }),
    db.contrato.findUnique({ where: { numero: NUMERO_ATUAL } }),
  ])

  if (anterior && atual) {
    throw new Error(
      `Conflito: os contratos ${NUMERO_ANTERIOR} e ${NUMERO_ATUAL} já existem. Nenhuma alteração foi realizada.`
    )
  }

  if (atual) {
    console.log(`✓ Contrato já está atualizado: ${NUMERO_ATUAL} (id: ${atual.id})`)
    return
  }

  if (!anterior) {
    throw new Error(
      `Contrato ${NUMERO_ANTERIOR} não encontrado e ${NUMERO_ATUAL} ainda não existe. Nenhuma alteração foi realizada.`
    )
  }

  const atualizado = await db.contrato.update({
    where: { id: anterior.id },
    data: { numero: NUMERO_ATUAL },
  })

  console.log(`✓ Contrato renumerado: ${NUMERO_ANTERIOR} → ${atualizado.numero} (id preservado: ${atualizado.id})`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
