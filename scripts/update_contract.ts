/**
 * Atualiza o contrato de 003/2025 para 003/2026 no banco de dados.
 * Rodar uma única vez.
 */
import { db } from '../src/lib/db'

async function main() {
  const contrato = await db.contrato.findFirst({
    where: { numero: '003/2025' },
  })
  if (!contrato) {
    console.log('Contrato 003/2025 não encontrado — nada a atualizar.')
    return
  }
  // Atualizar o número e a vigência
  const atualizado = await db.contrato.update({
    where: { id: contrato.id },
    data: {
      numero: '003/2026',
      vigenciaInicio: new Date('2026-01-01'),
      vigenciaFim: new Date('2027-12-31'),
    },
  })
  console.log(`✓ Contrato atualizado: ${contrato.numero} → ${atualizado.numero}`)
  console.log(`  vigência: ${atualizado.vigenciaInicio.toISOString().slice(0,10)} a ${atualizado.vigenciaFim.toISOString().slice(0,10)}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
