/**
 * Popula o campo imagemUrl dos itens no DB a partir do mapa
 * gerado pelo script Python (scripts/_imagem_map.json).
 *
 * Estratégia de matching:
 * - Para cada item no DB, buscar no mapa por descrição exata (após trim e normalização).
 * - Se não bater exato, tentar startsWith (primeiros 80 chars) — descrições no Excel podem ter
 *   mais texto do que no DB (que foi truncado em alguns casos) ou ter diferenças de espaçamento.
 */
import fs from 'fs'
import path from 'path'
import { db } from '../src/lib/db'

interface ImagemMap { [descricao: string]: string }

function normalize(s: string): string {
  return (s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ') // nbsp
}

async function main() {
  const mapPath = path.resolve(process.cwd(), 'scripts/_imagem_map.json')
  const raw = fs.readFileSync(mapPath, 'utf-8')
  const mapa: ImagemMap = JSON.parse(raw)

  console.log(`Mapa carregado: ${Object.keys(mapa).length} itens com imagem`)

  // Buscar todos os itens do DB
  const itens = await db.item.findMany({ select: { id: true, descricao: true, imagemUrl: true } })
  console.log(`Itens no DB: ${itens.length}`)

  // Construir índice normalizado do mapa
  const mapaNorm: { [k: string]: string } = {}
  for (const [desc, url] of Object.entries(mapa)) {
    mapaNorm[normalize(desc)] = url
  }

  let atualizados = 0
  let jaTinham = 0
  let semMatch = 0

  for (const item of itens) {
    if (item.imagemUrl) {
      jaTinham++
      continue
    }
    const descNorm = normalize(item.descricao)

    // 1. Match exato
    let url = mapaNorm[descNorm]

    // 2. Match por startsWith (primeiros 80 chars)
    if (!url) {
      const prefix = descNorm.slice(0, 80)
      for (const [k, v] of Object.entries(mapaNorm)) {
        if (normalize(k).startsWith(prefix) || prefix.startsWith(normalize(k).slice(0, 80))) {
          url = v
          break
        }
      }
    }

    // 3. Match por includes (substring)
    if (!url) {
      for (const [k, v] of Object.entries(mapaNorm)) {
        const kn = normalize(k)
        if (kn.length > 20 && (descNorm.includes(kn.slice(0, 40)) || kn.includes(descNorm.slice(0, 40)))) {
          url = v
          break
        }
      }
    }

    if (url) {
      await db.item.update({
        where: { id: item.id },
        data: { imagemUrl: url, imagemNome: url.split('/').pop() || null },
      })
      atualizados++
    } else {
      semMatch++
    }
  }

  console.log(`\n✓ Atualizados: ${atualizados}`)
  console.log(`✓ Já tinham imagem: ${jaTinham}`)
  console.log(`✓ Sem match no mapa: ${semMatch}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
