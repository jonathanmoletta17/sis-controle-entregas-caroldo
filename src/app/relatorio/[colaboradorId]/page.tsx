'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RelatorioData {
  colaborador: {
    id: string
    nomeCompleto: string
    cpf: string
    dataAdmissao: string
    dataDesligamento: string | null
    motivoDesligamento: string | null
    ativo: boolean
    observacoes: string | null
    posto: { id: string; nome: string; corCapacete: string | null } | null
    empresa: { id: string; nome: string } | null
    contrato: { id: string; numero: string; objeto: string } | null
    mudancasPosto: Array<{
      id: string
      dataMudanca: string
      motivo: string | null
      postoAnterior: { nome: string } | null
      postoNovo: { nome: string } | null
    }>
  }
  porCategoria: Record<string, Array<{
    itemId: string
    descricao: string
    unidade: string
    imagemUrl: string | null
    entregue: boolean
    ultimaEntrega: string | null
    totalEntregas: number
  }>>
  estatisticas: {
    totalItens: number
    totalEntregues: number
    totalPendentes: number
    percentual: number
  }
  geradoEm: string
}

function formatCPF(cpf: string): string {
  const d = (cpf || '').replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatDate(date?: string | null): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function RelatorioPage({ params }: { params: Promise<{ colaboradorId: string }> }) {
  const [colaboradorId, setColaboradorId] = useState<string>('')
  const [data, setData] = useState<RelatorioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setColaboradorId(p.colaboradorId))
  }, [params])

  useEffect(() => {
    if (!colaboradorId) return
    setLoading(true)
    fetch(`/api/relatorios/${colaboradorId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [colaboradorId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-sm text-muted-foreground">Gerando relatório...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-md shadow p-6 max-w-md">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-center mb-2">Erro ao gerar relatório</h1>
          <p className="text-sm text-muted-foreground text-center">{error}</p>
          <Button variant="outline" className="w-full mt-4" onClick={() => typeof window !== 'undefined' && window.close()}>
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { colaborador: c, porCategoria, estatisticas: s, geradoEm } = data

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Barra de ações (não impressa) */}
      <div className="print:hidden bg-white border-b sticky top-0 z-10">
        <div className="max-w-[210mm] mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => typeof window !== 'undefined' && window.close()}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Fechar
          </Button>
          <div className="text-sm text-muted-foreground">
            Relatório gerado em {formatDate(geradoEm)} às {new Date(geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <Button onClick={() => typeof window !== 'undefined' && window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Página A4 */}
      <div className="relatorio-page max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none my-6 print:my-0 p-12 print:p-10">
        {/* Cabeçalho institucional */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-5">
            {/* Brasão do RS */}
            <div className="shrink-0">
              <img
                src="/brasao-rs.jpg"
                alt="Brasão do Estado do Rio Grande do Sul"
                className="w-[70px] h-[90px] object-contain"
              />
            </div>
            {/* Texto institucional */}
            <div className="text-center flex-1">
              <div className="text-[11pt] font-bold tracking-wide">ESTADO DO RIO GRANDE DO SUL</div>
              <div className="text-[11pt]">SECRETARIA DA CASA CIVIL</div>
              <div className="text-[11pt]">UNIDADE DE MANUTENÇÃO</div>
              <div className="text-[11pt] mt-1">CONTRATO DE MANUTENÇÃO PREDIAL {c.contrato?.numero || '—'}</div>
              <div className="text-[13pt] font-bold mt-3 underline">RELATÓRIO DE ENTREGAS DE MATERIAIS, EPI, UNIFORMES E DOCUMENTOS</div>
            </div>
            {/* Espaço simétrico ao brasão para centralizar o texto */}
            <div className="shrink-0 w-[70px]" />
          </div>
        </div>

        {/* Dados do colaborador */}
        <div className="mb-6">
          <h2 className="text-[12pt] font-bold mb-2 border-b border-gray-300 pb-1">Dados do terceirizado</h2>
          <table className="w-full text-[10pt]">
            <tbody>
              <tr>
                <td className="py-1 font-semibold w-[25%]">Nome completo:</td>
                <td className="py-1 w-[35%]">{c.nomeCompleto}</td>
                <td className="py-1 font-semibold w-[15%]">CPF:</td>
                <td className="py-1 w-[25%] font-mono">{formatCPF(c.cpf)}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Posto:</td>
                <td className="py-1">{c.posto?.nome || '—'}</td>
                <td className="py-1 font-semibold">Empresa:</td>
                <td className="py-1">{c.empresa?.nome || '—'}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Admissão:</td>
                <td className="py-1">{formatDate(c.dataAdmissao)}</td>
                <td className="py-1 font-semibold">Status:</td>
                <td className="py-1">
                  {c.ativo ? 'Ativo' : `Desligado em ${formatDate(c.dataDesligamento)}`}
                </td>
              </tr>
              {!c.ativo && c.motivoDesligamento && (
                <tr>
                  <td className="py-1 font-semibold align-top">Motivo do desligamento:</td>
                  <td className="py-1" colSpan={3}>{c.motivoDesligamento}</td>
                </tr>
              )}
              {c.observacoes && (
                <tr>
                  <td className="py-1 font-semibold align-top">Observações:</td>
                  <td className="py-1" colSpan={3}>{c.observacoes}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Estatísticas resumo */}
        <div className="mb-6 flex items-center justify-between border border-gray-300 rounded p-3 text-[10pt]">
          <div>
            <span className="font-semibold">Resumo do checklist:</span>{' '}
            <span className="text-emerald-700 font-bold">{s.totalEntregues} entregues</span>
            {' · '}
            <span className="text-amber-700 font-bold">{s.totalPendentes} pendentes</span>
            {' · '}
            <span>de {s.totalItens} itens esperados</span>
          </div>
          <div className="text-[14pt] font-bold">{s.percentual}% concluído</div>
        </div>

        {/* Tabelas por categoria */}
        {Object.entries(porCategoria).map(([categoria, itens]) => (
          <div key={categoria} className="mb-5">
            <h3 className="text-[11pt] font-bold mb-1.5 border-b border-gray-300 pb-0.5">
              {categoria} ({itens.length} {itens.length === 1 ? 'item' : 'itens'} — {itens.filter(i => i.entregue).length} entregues)
            </h3>
            <table className="w-full text-[9pt] border-collapse">
              <thead>
                <tr className="border-b border-gray-400 bg-gray-50">
                  <th className="py-1 px-1.5 text-left w-[5%]">Status</th>
                  <th className="py-1 px-1.5 text-left w-[8%]">Imagem</th>
                  <th className="py-1 px-1.5 text-left w-[60%]">Descrição do item</th>
                  <th className="py-1 px-1.5 text-center w-[8%]">Unid.</th>
                  <th className="py-1 px-1.5 text-left w-[19%]">Última entrega</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr key={item.itemId} className="border-b border-gray-200">
                    <td className="py-1 px-1.5 text-center text-[11pt]">
                      {item.entregue ? '✓' : '○'}
                    </td>
                    <td className="py-1 px-1.5">
                      {item.imagemUrl ? (
                        <img
                          src={item.imagemUrl}
                          alt=""
                          className="h-10 w-10 object-cover rounded border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded border bg-gray-100" />
                      )}
                    </td>
                    <td className="py-1 px-1.5">{item.descricao}</td>
                    <td className="py-1 px-1.5 text-center">{item.unidade}</td>
                    <td className="py-1 px-1.5">
                      {item.entregue ? (
                        <span>
                          {formatDate(item.ultimaEntrega)}
                          {item.totalEntregas > 1 && (
                            <span className="text-gray-500 text-[8pt]"> ({item.totalEntregas} entregas)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Histórico de mudanças de posto (se houver) */}
        {c.mudancasPosto.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[11pt] font-bold mb-1.5 border-b border-gray-300 pb-0.5">
              Histórico de mudanças de posto
            </h3>
            <table className="w-full text-[9pt] border-collapse">
              <thead>
                <tr className="border-b border-gray-400 bg-gray-50">
                  <th className="py-1 px-1.5 text-left w-[20%]">Data</th>
                  <th className="py-1 px-1.5 text-left w-[25%]">Posto anterior</th>
                  <th className="py-1 px-1.5 text-left w-[25%]">Novo posto</th>
                  <th className="py-1 px-1.5 text-left w-[30%]">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {c.mudancasPosto.map(m => (
                  <tr key={m.id} className="border-b border-gray-200">
                    <td className="py-1 px-1.5">{formatDate(m.dataMudanca)}</td>
                    <td className="py-1 px-1.5">{m.postoAnterior?.nome || '—'}</td>
                    <td className="py-1 px-1.5">{m.postoNovo?.nome || '—'}</td>
                    <td className="py-1 px-1.5 text-gray-700">{m.motivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Assinaturas */}
        <div className="mt-12 print:mt-16">
          <div className="grid grid-cols-2 gap-12 text-[10pt]">
            <div className="text-center">
              <div className="border-t border-black pt-1 mb-1" style={{ marginTop: '4rem' }} />
              <div className="font-semibold">Fiscalização Técnica</div>
              <div className="text-gray-600 text-[9pt]">Assinatura / Carimbo</div>
              <div className="mt-3 text-left">
                <div>Data: ____ / ____ / ______</div>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-black pt-1 mb-1" style={{ marginTop: '4rem' }} />
              <div className="font-semibold">Representante {c.empresa?.nome || 'da Empresa'}</div>
              <div className="text-gray-600 text-[9pt]">Assinatura / Carimbo</div>
              <div className="mt-3 text-left">
                <div>Data: ____ / ____ / ______</div>
              </div>
            </div>
          </div>
        </div>

        {/* Nota legal */}
        <div className="mt-10 pt-3 border-t border-gray-300 text-[8pt] text-gray-600 italic">
          <p>
            * As assinaturas acima serão requeridas após a entrega de todos os itens listados, garantindo e formalizando a entrega e regularização dos materiais, EPIs, uniformes e documentos ao terceirizado identificado neste relatório.
          </p>
          <p className="mt-1">
            Relatório gerado pelo Sistema de Controle de Entregas — CAROLDO · Contrato {c.contrato?.numero} · {new Date(geradoEm).toLocaleString('pt-BR')}.
          </p>
        </div>
      </div>

      {/* CSS de impressão */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .relatorio-page {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }
          tr { page-break-inside: avoid; }
          h3, h2 { page-break-after: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  )
}
