/**
 * Seed script — popula o banco com:
 * 1. Contrato 003/2026 (CAROLDO é a nova empresa contratada)
 * 2. Empresas CAROLDO e JIREH (JIREH mantida como subcontratada histórica)
 * 3. 9 postos (com cor de capacete)
 * 4. 4 categorias (Materiais, EPI, Uniforme, Documento)
 * 5. Itens por combinação categoria×posto (521 itens no total)
 * 6. 10 colaboradores identificados no Excel (com CPF placeholder)
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../src/lib/db'
import {
  POSTOS,
  CATEGORIAS,
  ITENS_POR_POSTO,
  COLABORADORES_INICIAIS,
} from './seed-data'

const ADMIN_EMAIL = 'jonathanmoletta17@gmail.com'
const ADMIN_NOME = 'Jonathan Moletta'

// Cria o usuário admin inicial (idempotente). Gera senha temporária aleatória
// apenas na primeira execução — imprime uma única vez no console.
async function seedUsuarioAdmin() {
  const existente = await db.usuario.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existente) {
    console.log('✓ Usuário admin já existe, pulando')
    return
  }
  const senhaTemporaria = crypto.randomBytes(9).toString('base64url')
  const senhaHash = await bcrypt.hash(senhaTemporaria, 10)
  await db.usuario.create({
    data: {
      email: ADMIN_EMAIL,
      nome: ADMIN_NOME,
      senhaHash,
      role: 'admin',
      ativo: true,
    },
  })
  console.log(`✓ Usuário admin criado: ${ADMIN_EMAIL}`)
  console.log(`  SENHA TEMPORÁRIA (anote agora, não será mostrada de novo): ${senhaTemporaria}`)
}

interface ImagemMap { [descricao: string]: string }

function normalizeDescricao(s: string): string {
  return (s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
}

// Vincula imagemUrl aos itens por match de descrição contra o mapa gerado do Excel original
async function popularImagensDosItens() {
  const mapPath = path.resolve(process.cwd(), 'scripts/_imagem_map.json')
  if (!fs.existsSync(mapPath)) {
    console.warn('  Mapa de imagens não encontrado, pulando vínculo de imagens.')
    return
  }
  const mapa: ImagemMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'))
  const mapaNorm: Record<string, string> = {}
  for (const [desc, url] of Object.entries(mapa)) {
    mapaNorm[normalizeDescricao(desc)] = url
  }

  const itens = await db.item.findMany({ select: { id: true, descricao: true, imagemUrl: true } })
  let atualizados = 0
  for (const item of itens) {
    if (item.imagemUrl) continue
    const descNorm = normalizeDescricao(item.descricao)

    let url = mapaNorm[descNorm]
    if (!url) {
      const prefix = descNorm.slice(0, 80)
      for (const [k, v] of Object.entries(mapaNorm)) {
        if (k.startsWith(prefix) || prefix.startsWith(k.slice(0, 80))) { url = v; break }
      }
    }
    if (!url) {
      for (const [k, v] of Object.entries(mapaNorm)) {
        if (k.length > 20 && (descNorm.includes(k.slice(0, 40)) || k.includes(descNorm.slice(0, 40)))) { url = v; break }
      }
    }
    if (url) {
      await db.item.update({
        where: { id: item.id },
        data: { imagemUrl: url, imagemNome: url.split('/').pop() || null },
      })
      atualizados++
    }
  }
  console.log(`✓ Imagens vinculadas: ${atualizados}/${itens.length}`)
}

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
        const existente = await db.item.findFirst({ where: { categoriaId, descricao } })
        if (existente) {
          itemId = existente.id
        } else {
          const item = await db.item.create({
            data: {
              categoriaId,
              descricao,
              unidade: '1',
              ativo: true,
            },
          })
          itemId = item.id
          totalItens++
        }
        itemCache[cacheKey] = itemId
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

  // 7. Vincular imagens aos itens (idempotente — pula itens que já têm imagemUrl)
  await popularImagensDosItens()

  // 8. Usuário admin inicial
  await seedUsuarioAdmin()

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
