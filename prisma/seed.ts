/**
 * Seed script — popula o banco com:
 * 1. Contrato 003/2026 (CAROLDO é a nova empresa contratada)
 * 2. Empresas CAROLDO e JIREH (JIREH mantida como subcontratada histórica)
 * 3. 9 postos (com cor de capacete)
 * 4. 4 categorias (Materiais, EPI, Uniforme, Documento)
 * 5. Itens por combinação categoria×posto (521 itens no total)
 * 6. 10 colaboradores identificados no Excel (com CPF placeholder)
 */
import { db } from '../src/lib/db'
import {
  POSTOS,
  CATEGORIAS,
  ITENS_POR_POSTO,
  COLABORADORES_INICIAIS,
} from './seed-data'

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // 1. Contrato
  const contrato = await db.contrato.upsert({
    where: { numero: '003/2026' },
    update: {},
    create: {
      numero: '003/2026',
      objeto: 'Manutenção Predial',
      dataAssinatura: new Date('2026-01-01'),
      vigenciaInicio: new Date('2026-01-01'),
      vigenciaFim: new Date('2027-12-31'),
    },
  })
  console.log(`✓ Contrato criado: ${contrato.numero}`)

  // 2. Empresas
  const caroldo = await db.empresa.upsert({
    where: { nome: 'CAROLDO' },
    update: {},
    create: {
      nome: 'CAROLDO',
      cnpj: null,
      papel: 'contratada_principal',
    },
  })
  const jireh = await db.empresa.upsert({
    where: { nome: 'JIREH' },
    update: {},
    create: {
      nome: 'JIREH',
      cnpj: null,
      papel: 'subcontratada',
    },
  })
  await db.empresaContrato.upsert({
    where: { empresaId_contratoId: { empresaId: caroldo.id, contratoId: contrato.id } },
    update: {},
    create: { empresaId: caroldo.id, contratoId: contrato.id, papel: 'contratada_principal' },
  })
  await db.empresaContrato.upsert({
    where: { empresaId_contratoId: { empresaId: jireh.id, contratoId: contrato.id } },
    update: {},
    create: { empresaId: jireh.id, contratoId: contrato.id, papel: 'subcontratada' },
  })
  console.log(`✓ Empresas: CAROLDO + JIREH`)

  // 3. Postos
  const postoMap: Record<string, string> = {}
  for (const p of POSTOS) {
    const posto = await db.posto.upsert({
      where: { nome: p.nome },
      update: { corCapacete: p.corCapacete || null },
      create: { nome: p.nome, corCapacete: p.corCapacete || null },
    })
    postoMap[p.nome] = posto.id
  }
  console.log(`✓ Postos: ${Object.keys(postoMap).length}`)

  // 4. Categorias
  const categoriaMap: Record<string, string> = {}
  for (const c of CATEGORIAS) {
    const cat = await db.categoria.upsert({
      where: { nome: c.nome },
      update: {},
      create: { nome: c.nome, descricao: c.descricao },
    })
    categoriaMap[c.nome] = cat.id
  }
  console.log(`✓ Categorias: ${Object.keys(categoriaMap).length}`)

  // 5. Itens por combinação categoria×posto
  let totalItens = 0
  let totalRelacoes = 0
  // Cache para evitar recriar itens iguais com mesma descrição na mesma categoria
  const itemCache: Record<string, string> = {}

  for (const [key, descricoes] of Object.entries(ITENS_POR_POSTO)) {
    const [categoria, postoNome] = key.split('__')
    const categoriaId = categoriaMap[categoria]
    const postoId = postoMap[postoNome]
    if (!categoriaId || !postoId) {
      console.warn(`  SKIP: categoria=${categoria} posto=${postoNome}`)
      continue
    }

    for (const descricao of descricoes) {
      // Cache key por (categoria + descrição) para reutilizar
      const cacheKey = `${categoria}__${descricao}`
      let itemId = itemCache[cacheKey]
      if (!itemId) {
        const item = await db.item.create({
          data: {
            categoriaId,
            descricao,
            unidade: '1',
            ativo: true,
          },
        })
        itemId = item.id
        itemCache[cacheKey] = itemId
        totalItens++
      }
      // Cria relação Item ↔ Posto
      try {
        await db.itemPosto.create({
          data: {
            itemId,
            postoId,
            quantidadeEsperada: 1,
            obrigatorio: true,
          },
        })
        totalRelacoes++
      } catch {
        // relação já existe (unique constraint) — ok
      }
    }
  }
  console.log(`✓ Itens únicos: ${totalItens}`)
  console.log(`✓ Relações item↔posto: ${totalRelacoes}`)

  // 6. Colaboradores iniciais
  let totalColabs = 0
  for (const c of COLABORADORES_INICIAIS) {
    // Normaliza CPF para apenas dígitos
    const cpfDigits = c.cpf.replace(/\D/g, '')
    const postoId = postoMap[c.posto]
    if (!postoId) {
      console.warn(`  SKIP colaborador: posto não encontrado: ${c.posto}`)
      continue
    }
    const exists = await db.colaborador.findUnique({ where: { cpf: cpfDigits } })
    if (exists) continue
    await db.colaborador.create({
      data: {
        cpf: cpfDigits,
        nomeCompleto: c.nomeCompleto,
        empresaId: caroldo.id,
        contratoId: contrato.id,
        postoId,
        dataAdmissao: new Date(c.dataAdmissao),
        dataDesligamento: c.dataDesligamento ? new Date(c.dataDesligamento) : null,
        ativo: true,
      },
    })
    totalColabs++
  }
  console.log(`✓ Colaboradores: ${totalColabs}`)

  console.log('\n✅ Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
