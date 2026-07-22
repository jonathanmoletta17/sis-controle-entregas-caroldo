/**
 * Renomeia, de forma idempotente, a empresa "CAROLDO" para "ORBIS".
 *
 * O commit que trocou o nome da empresa contratada mudou apenas textos fixos
 * da UI e o template do seed — nunca existiu um passo que atualizasse a linha
 * já gravada no banco. Bancos que não foram re-semeados após esse commit
 * continuam com uma empresa chamada "CAROLDO" (e colaboradores/vínculos
 * apontando pra ela), o que aparece em qualquer lugar que leia o nome da
 * empresa direto do banco — como o relatório do terceirizado.
 *
 * Uso:  DATABASE_URL=... bun scripts/renomear_empresa_caroldo_orbis.ts
 * Rode primeiro em LOCAL. É seguro rodar mais de uma vez (idempotente).
 */
import { db } from '../src/lib/db'

async function main() {
  const caroldo = await db.empresa.findUnique({ where: { nome: 'CAROLDO' } })
  if (!caroldo) {
    console.log('✓ Nenhuma empresa "CAROLDO" encontrada. Nada a fazer.')
    return
  }

  const orbis = await db.empresa.findUnique({ where: { nome: 'ORBIS' } })

  if (!orbis) {
    // Caso simples: só existe a linha antiga — renomeia no lugar, preserva o id
    // (nenhum vínculo de colaborador/contrato precisa mudar).
    await db.empresa.update({ where: { id: caroldo.id }, data: { nome: 'ORBIS' } })
    console.log(`✓ Empresa "CAROLDO" (${caroldo.id}) renomeada para "ORBIS".`)
    return
  }

  // Caso de duplicata: já existe uma linha "ORBIS" separada (ex.: seed rodou
  // de novo após o rename e criou uma nova empresa em vez de atualizar a
  // antiga). Migra os vínculos da "CAROLDO" para a "ORBIS" e remove a duplicata.
  console.log(`Duas empresas encontradas — "CAROLDO" (${caroldo.id}) e "ORBIS" (${orbis.id}). Migrando vínculos...`)

  const colaboradores = await db.colaborador.updateMany({
    where: { empresaId: caroldo.id },
    data: { empresaId: orbis.id },
  })
  console.log(`  ${colaboradores.count} colaborador(es) migrado(s) para "ORBIS".`)

  const contratosCaroldo = await db.empresaContrato.findMany({ where: { empresaId: caroldo.id } })
  for (const ec of contratosCaroldo) {
    const jaExiste = await db.empresaContrato.findUnique({
      where: { empresaId_contratoId: { empresaId: orbis.id, contratoId: ec.contratoId } },
    })
    if (jaExiste) {
      await db.empresaContrato.delete({ where: { id: ec.id } })
    } else {
      await db.empresaContrato.update({ where: { id: ec.id }, data: { empresaId: orbis.id } })
    }
  }

  await db.empresa.delete({ where: { id: caroldo.id } })
  console.log('✓ Duplicata "CAROLDO" removida. Todos os vínculos agora apontam para "ORBIS".')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
