"""
Main builder for the Diagnóstico Técnico PDF — Controle de Entregas CAROLDO.
Generates the body PDF (with TOC) using ReportLab.
The cover is generated separately as HTML → PDF via html2poster.js.
The two are merged with pypdf.
"""
import os, sys, hashlib, re, subprocess
from pathlib import Path

# Add pdf skill scripts to path
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, Flowable, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents

# ============ FONTS ============
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# ============ PALETTE ============
PAGE_BG       = colors.HexColor('#f5f6f6')
SECTION_BG    = colors.HexColor('#ecedee')
CARD_BG       = colors.HexColor('#ebeeef')
TABLE_STRIPE  = colors.HexColor('#e9ebec')
HEADER_FILL   = colors.HexColor('#40525b')
COVER_BLOCK   = colors.HexColor('#456270')
BORDER        = colors.HexColor('#b2bcc2')
ICON          = colors.HexColor('#3f7692')
ACCENT        = colors.HexColor('#296988')
ACCENT_2      = colors.HexColor('#559ec2')
TEXT_PRIMARY  = colors.HexColor('#17191a')
TEXT_MUTED    = colors.HexColor('#767d80')
SEM_SUCCESS   = colors.HexColor('#4d845f')
SEM_WARNING   = colors.HexColor('#907642')
SEM_ERROR     = colors.HexColor('#934038')
SEM_INFO      = colors.HexColor('#507eac')

# ============ STYLES ============
BODY_FONT = 'FreeSerif'
BODY_BOLD = 'FreeSerif-Bold'
BODY_ITALIC = 'FreeSerif-Italic'

styles = {
    'body': ParagraphStyle('Body', fontName=BODY_FONT, fontSize=10.5, leading=16,
        alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, firstLineIndent=14, spaceAfter=6),
    'body_ni': ParagraphStyle('BodyNI', fontName=BODY_FONT, fontSize=10.5, leading=16,
        alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, firstLineIndent=0, spaceAfter=6),
    'h1': ParagraphStyle('H1', fontName=BODY_BOLD, fontSize=20, leading=26,
        textColor=HEADER_FILL, alignment=TA_LEFT, spaceBefore=14, spaceAfter=12, keepWithNext=1),
    'h2': ParagraphStyle('H2', fontName=BODY_BOLD, fontSize=14, leading=20,
        textColor=ACCENT, alignment=TA_LEFT, spaceBefore=16, spaceAfter=8, keepWithNext=1),
    'h3': ParagraphStyle('H3', fontName=BODY_BOLD, fontSize=11.5, leading=16,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceBefore=10, spaceAfter=4, keepWithNext=1),
    'caption': ParagraphStyle('Cap', fontName=BODY_ITALIC, fontSize=9, leading=12,
        textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=12),
    'callout': ParagraphStyle('Call', fontName=BODY_FONT, fontSize=10, leading=15,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=10, rightIndent=10,
        backColor=CARD_BG, borderColor=ACCENT, borderWidth=0,
        borderPadding=10, spaceBefore=8, spaceAfter=8),
    'callout_warn': ParagraphStyle('CallW', fontName=BODY_FONT, fontSize=10, leading=15,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=10, rightIndent=10,
        backColor=colors.HexColor('#fdf6ec'), borderColor=SEM_WARNING, borderWidth=0,
        borderPadding=10, spaceBefore=8, spaceAfter=8),
    'toc_l0': ParagraphStyle('TOCL0', fontName=BODY_BOLD, fontSize=11, leading=18,
        textColor=TEXT_PRIMARY, leftIndent=0, spaceBefore=4, spaceAfter=2),
    'toc_l1': ParagraphStyle('TOCL1', fontName=BODY_FONT, fontSize=10, leading=16,
        textColor=TEXT_MUTED, leftIndent=18, spaceBefore=2, spaceAfter=2),
    'tc': ParagraphStyle('TC', fontName=BODY_FONT, fontSize=9, leading=12,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT),
    'tc_c': ParagraphStyle('TCC', fontName=BODY_FONT, fontSize=9, leading=12,
        textColor=TEXT_PRIMARY, alignment=TA_CENTER),
    'tc_b': ParagraphStyle('TCB', fontName=BODY_BOLD, fontSize=9, leading=12,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT),
    'th': ParagraphStyle('TH', fontName=BODY_BOLD, fontSize=9.5, leading=12,
        textColor=colors.white, alignment=TA_CENTER),
    'q': ParagraphStyle('Q', fontName=BODY_FONT, fontSize=10, leading=15,
        textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, leftIndent=18, rightIndent=10,
        spaceBefore=4, spaceAfter=6, bulletIndent=4),
}

# ============ TOC DOC TEMPLATE ============
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_page_furniture(canvas, doc):
    canvas.saveState()
    page_w, page_h = A4
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, page_h - 15*mm, page_w - 20*mm, page_h - 15*mm)
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(20*mm, page_h - 12*mm, "Diagnóstico Técnico · Controle de Entregas CAROLDO · Contrato 003/2025")
    canvas.line(20*mm, 15*mm, page_w - 20*mm, 15*mm)
    canvas.setFont('FreeSerif', 9)
    canvas.setFillColor(TEXT_PRIMARY)
    canvas.drawRightString(page_w - 20*mm, 10*mm, f"{doc.page}")
    canvas.setFont('FreeSerif-Italic', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(20*mm, 10*mm, "Z.ai · Julho 2026")
    canvas.restoreState()

# ============ HELPERS ============
def H(text, level=0):
    style = styles['h1'] if level == 0 else styles['h2'] if level == 1 else styles['h3']
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def P(text, style='body'):
    return Paragraph(text, styles[style])

def callout(text, kind='info'):
    style_name = {'info': 'callout', 'warn': 'callout_warn'}.get(kind, 'callout')
    return Paragraph(text, styles[style_name])

def make_table(data, col_widths=None, header=True, font_size=9):
    if col_widths is None:
        n = len(data[0])
        page_w = A4[0] - 40*mm
        col_widths = [page_w / n] * n
    wrapped = []
    for ri, row in enumerate(data):
        new_row = []
        for ci, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                new_row.append(cell)
            else:
                s = str(cell) if cell is not None else ""
                if ri == 0 and header:
                    new_row.append(Paragraph(s, styles['th']))
                else:
                    new_row.append(Paragraph(s, styles['tc']))
        wrapped.append(new_row)
    t = Table(wrapped, colWidths=col_widths, repeatRows=1 if header else 0)
    ts = [
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.25, BORDER),
    ]
    if header:
        ts.append(('BACKGROUND', (0,0), (-1,0), HEADER_FILL))
        ts.append(('TEXTCOLOR', (0,0), (-1,0), colors.white))
    for ri in range(1 if header else 0, len(data)):
        if (ri - (1 if header else 0)) % 2 == 1:
            ts.append(('BACKGROUND', (0,ri), (-1,ri), TABLE_STRIPE))
    t.setStyle(TableStyle(ts))
    return t

# Available width for tables
PAGE_W = A4[0] - 40*mm

# ============ STORY BUILD ============
story = []

# ---- TOC ----
toc = TableOfContents()
toc.levelStyles = [styles['toc_l0'], styles['toc_l1']]
story.append(Paragraph("Sumário", styles['h1']))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=4, spaceAfter=14))
story.append(toc)
story.append(PageBreak())

# ============ 1. SUMÁRIO EXECUTIVO ============
story.append(H("1. Sumário Executivo", level=0))
story.append(P(
    "Este documento apresenta o diagnóstico técnico do arquivo <b>CHECKLISTS CAROLDO.xlsx</b> "
    "(5,7 MB), que controla a entrega de materiais, EPIs, uniformes e documentos a terceirizados "
    "que atuam no <b>Contrato de Manutenção Predial 003/2025</b> firmado entre o Estado do Rio "
    "Grande do Sul (Secretaria da Casa Civil, Unidade de Manutenção) e a empresa CAROLDO. "
    "Em algumas assinaturas aparece também a empresa <b>JIREH</b> como representante, o que "
    "sugere a existência de subcontratação ou de uma relação triangular que precisa ser "
    "esclarecida antes da construção da futura aplicação."
))
story.append(P(
    "O arquivo contém <b>20 abas</b> organizadas em <b>4 grandes grupos funcionais</b>: "
    "(1) <b>Materiais por posto</b> — 7 abas, uma para cada função técnica (marceneiro, "
    "pedreiro, eletricista, pintor, instalador hidráulico, técnico de refrigeração e técnico "
    "de infraestrutura de redes); (2) <b>EPI por posto</b> — 9 abas, contemplando os mesmos "
    "postos anteriores mais supervisor e servente; (3) <b>Uniformes</b> — 3 abas (uma geral, "
    "uma específica para o colaborador Fabiano e outra para eletricistas); (4) <b>Documentos</b> "
    "— 1 aba única que controla a entrega da documentação contratual e legal de cada terceirizado."
))
story.append(P(
    "Foram identificados <b>11 terceirizados nominalmente</b> distribuídos pelos postos, "
    "com um catálogo aproximado de <b>280 itens únicos</b> (ferramentas, EPIs, uniformes e "
    "documentos) que devem ser entregues. A análise identificou <b>mais de 30 blocos sem "
    "nome de colaborador preenchido</b>, divergência contratual em uma das abas (marca "
    "003/2026 em vez de 003/2025), grafias diferentes para o mesmo colaborador em abas "
    "distintas, e a coluna <i>Imagem Ilustrativa</i> universalmente vazia. Estes achados "
    "evidenciam que a planilha atual, embora funcional, já está no limite da sua capacidade "
    "de controle — recomenda-se fortemente a evolução para uma aplicação web dedicada, cujo "
    "modelo de dados proposto compõe a Seção 8 deste relatório."
))

# ============ 2. VISÃO GERAL DO WORKBOOK ============
story.append(H("2. Visão Geral do Workbook", level=0))
story.append(P(
    "O arquivo segue um padrão de layout repetido em todas as 20 abas. Cada aba é estruturada "
    "em <b>cinco regiões verticais</b>: (i) cabeçalho institucional ocupando as linhas 1–12 "
    "(com o texto \"ESTADO DO RIO GRANDE DO SUL / SECRETARIA DA CASA CIVIL / UNIDADE DE "
    "MANUTENÇÃO / CONTRATO DE MANUTENÇÃO PREDIAL 003/2025 / CONTROLE DE ENTREGA DE ...\" "
    "mescladas em uma única célula longa); (ii) linha 13 ou 15 onde aparece o nome do "
    "colaborador (no grupo Materiais) ou o rótulo \"NOME DO COLABORADOR:\" seguido do nome "
    "(nos grupos EPI, Uniformes e Documentos); (iii) linha 15 ou 17/19 com o cabeçalho das "
    "colunas (Descrição, Uni., Imagem Ilustrativa, Data de entrega, Observação — ou variações); "
    "(iv) bloco de dados com os itens, iniciando em seguida; (v) rodapé com os campos "
    "\"FISCALIZAÇÃO TÉCNICA: ....\" e \"REPRESENTANTE [CAROLDO|JIREH]: ....\" e a nota "
    "legal de que as assinaturas serão requeridas após a entrega completa de todos os itens."
))
story.append(P(
    "Horizontalmente, cada aba contém de <b>1 a 5 blocos laterais</b> (cada bloco é um conjunto "
    "de colunas que cabe um checklist completo de um colaborador). Esta estratégia de "
    "layout permite que o fiscalização visualize dois (ou mais) terceirizados lado a lado na "
    "mesma aba, mas gera um problema estrutural: o número máximo de colaboradores por aba é "
    "fixo pelo layout inicial, e qualquer novo terceirizado exige duplicar colunas manualmente. "
    "Adicionalmente, cada item do checklist possui <b>quatro \"slots\" de data de entrega</b> "
    "(células mescladas verticalmente em pares de 2 linhas, totalizando 8 linhas por item), "
    "o que sugere uma expectativa de até quatro entregas/reposições por item ao longo do "
    "contrato — mas esta regra não está documentada nem é consistente: alguns itens têm apenas "
    "1 data preenchida, outros têm 2, 3 ou 4."
))

# Tabela de visão geral das 20 abas
overview_data = [
    ['#', 'Aba', 'Grupo', 'Blocos', 'Itens', 'Colaborador(es) identificado(s)'],
    ['1', 'MATERIAIS MARCENEIROS', 'Materiais', '2', '46', '(template) + Ivo Leandro'],
    ['2', 'MATERIAIS PEDREIROS', 'Materiais', '1', '35', '(somente template)'],
    ['3', 'MATERIAIS ELETRICISTAS', 'Materiais', '2', '39', '(2 templates; bloco 2 marca contrato 003/2026)'],
    ['4', 'MATERIAIS PINTORES', 'Materiais', '2', '25', 'Bloco 1 preenchido (sem nome); bloco 2 vazio'],
    ['5', 'MATERIAIS INST. HIDRÁULICOS', 'Materiais', '3', '43', 'Bloco 2 com 37 datas preenchidas (sem nome)'],
    ['6', 'MATERIAIS TÉC. REFRIGERAÇÃO', 'Materiais', '2', '48', 'Bloco 1 com 46 datas preenchidas (sem nome)'],
    ['7', 'MATERIAIS TÉC. INFRA. DE REDES', 'Materiais', '2', '25', 'Joel (bloco 1) + template (bloco 2)'],
    ['8', 'EPI SUPERVISOR', 'EPI', '1', '4', '(vazio)'],
    ['9', 'EPI MARCENEIRO', 'EPI', '5', '6', '(5 blocos vazios — layout prevê 5 marceneiros)'],
    ['10', 'EPI ELETRICISTA', 'EPI', '3', '7', 'Anderson Claiton Lopes da Cruz (bloco 1) + 2 vazios'],
    ['11', 'EPI SERVENTE', 'EPI', '2', '8', '(2 blocos vazios)'],
    ['12', 'EPI INST. HIDRÁULICO', 'EPI', '4', '7', '(4 blocos vazios — layout prevê 4 instaladores)'],
    ['13', 'EPI PEDREIRO', 'EPI', '2', '9', 'Andrea dos Santos Pavão (bloco 1) + 1 vazio'],
    ['14', 'EPI PINTOR', 'EPI', '2', '9', 'Gilberto Texeira da Rosa (bloco 2) + 1 vazio'],
    ['15', 'EPI TÉC. REFRIGERAÇÃO', 'EPI', '3', '6', 'Marcos Vinícius Machado (bloco 2) + 2 vazios'],
    ['16', 'EPI TÉC. INFRA. DE REDES', 'EPI', '2', '6', '(2 blocos vazios)'],
    ['17', 'UNIFORME', 'Uniforme', '4', '10', 'Ivo Leandro + Gilberto + Joel Turela + Andrea Santos'],
    ['18', 'UNIFORME FABIANO', 'Uniforme', '1', '10', 'Fabiano L. Alves (layout atípico, sem bloco lateral)'],
    ['19', 'UNIFORME ELETRICISTA', 'Uniforme', '2', '11', 'Dilmar Mendes (bloco 1) + \"ELÉTRICA\" como nome (bloco 2)'],
    ['20', 'DOCUMENTOS', 'Documentos', '4', '9', 'Rogerio Alves + José Fernando + Anderson Claiton + 1 vazio'],
]
col_w = [10*mm, 50*mm, 22*mm, 14*mm, 14*mm, 60*mm]
story.append(Spacer(1, 6))
story.append(make_table(overview_data, col_widths=col_w))
story.append(Paragraph("Tabela 1 — Visão geral das 20 abas do arquivo CHECKLISTS CAROLDO.xlsx", styles['caption']))

story.append(P(
    "A tabela acima evidencia um padrão importante: a maior parte dos blocos está vazia ou "
    "apenas com o template de itens, indicando que o preenchimento real está muito aquém da "
    "capacidade instalada no layout. Em vários casos (Materiais Pintores, Materiais Inst. "
    "Hidráulicos, Materiais Téc. Refrigeração) existem datas de entrega preenchidas mas "
    "<b>sem o nome do colaborador</b> no campo apropriado — o que torna impossível auditar "
    "quem recebeu o quê. Esta é uma das principais inconsistências a serem resolvidas na "
    "futura aplicação."
))

story.append(PageBreak())

# ============ 3. GRUPO MATERIAIS ============
story.append(H("3. Grupo 1 — Materiais por Posto", level=0))
story.append(P(
    "Este grupo concentra as <b>7 abas</b> que controlam a entrega de ferramentas e materiais "
    "permanentes a cada posto técnico. Cada aba tem o mesmo cabeçalho de colunas: <i>Descrição "
    "do Material</i> (mesclada em 4 colunas), <i>Uni.</i> (sempre \"1\" — unidade), <i>Imagem "
    "Ilustrativa</i> (mesclada em 3 colunas, sempre vazia), <i>Data de Entrega</i> (mesclada "
    "em 3 colunas) e <i>Observação</i> (mesclada em 3 colunas). Os itens são ferramentas "
    "específicas do posto (plainas, chaves, alicates, furadeiras, esmerilhadeiras, etc.), "
    "descritos com riqueza de detalhes técnicos — o que é excelente para a fiscalização, mas "
    "cria um desafio de normalização para a futura base de dados."
))

story.append(H("3.1 MATERIAIS MARCENEIROS (46 itens)", level=1))
story.append(P(
    "Única aba de materiais com nome de colaborador preenchido: <b>Ivo Leandro</b> (bloco 2, "
    "colunas Q–AA). O bloco 1 (colunas A–K) está em branco e funciona como template. Os 46 "
    "itens incluem: caixa de ferramentas metálica, plaina elétrica profissional 82mm 700W "
    "220V, esquadro, nível de madeira 12\", prumo 500g, escala métrica de 2m, jogo de chaves "
    "de fenda (1/8×5, 3/16×6, 5/16×8), jogo de chaves Philips, jogo de chaves Allen Torkx "
    "T10–T50, alicate universal, alicate de corte, alicate de pressão, martelo de unha 27mm, "
    "martelo de orelha 1kg, serrote 24\", formão 6mm, formão 12mm, guia para serra circular, "
    "serra circular 1400W, furadeira de impacto 700W, esmerilhadeira angular 700W, serra "
    "tico-tico, lixadeira orbital, morsa 4\", sargiflex, entre outros. Quatro datas de entrega "
    "diferentes aparecem para o mesmo item (ex.: 03/12/2025, 12/03/2025, 07/04/2025, 05/05/2025), "
    "sugerindo reposições ou entregas fracionadas."
))

story.append(H("3.2 MATERIAIS PEDREIROS (35 itens)", level=1))
story.append(P(
    "Esta aba contém apenas <b>1 bloco</b> (colunas P–AC) e <b>nenhum colaborador cadastrado</b>. "
    "Funciona como um template puro, com os 35 itens do posto de pedreiro listados: colher de "
    "pedreiro n° 6 e n° 8, martelo unha/carpinteiro 29mm, prumo de aço carbono 2m, nível de "
    "madeira 12\", chave de fenda 5/16×6, serrote 24\", alicate universal, mangueira para nível "
    "10m, marreta 1kg, capa de chuva em nylon, desempenadeira lisa/dentada/PVC/com esponja, "
    "martelo de borracha 80mm, caixa para argamassa 20L, pá de concha, picareta, enxada larga, "
    "carrinho de mão tipo caçamba, régua de alumínio 2m, talhadeiras, trena 5m, esquadro, balde "
    "de pedreiro 10L, cortador de piso, furadeira de impacto 800W SDS-PLUS, martelo rompedor "
    "1600W, esmerilhadeira angular 700W, kit de discos e mármore 1500W. Não há nenhuma data de "
    "entrega preenchida — provavelmente o pedreiro ainda não foi alocado ou as entregas estão "
    "sendo registradas em outro arquivo. Observação: na célula CO12 há o texto espúrio \"zz\", "
    "provavelmente um erro de digitação."
))

story.append(H("3.3 MATERIAIS ELETRICISTAS (39 itens) — divergência contratual", level=1))
story.append(P(
    "Esta é a única aba com <b>divergência contratual</b>: o bloco 2 (colunas Q–AA) traz o "
    "cabeçalho \"CONTRATO DE MANUTENÇÃO PREDIAL <b>003/2026</b>\" e a etiqueta \"(NOVO)\" após "
    "o título \"ELETRICISTAS\", enquanto todas as demais 19 abas usam o contrato 003/2025. "
    "Isto pode indicar: (a) renovação contratual em curso, (b) erro de digitação ao montar "
    "a aba, ou (c) aditivo contratual específico para o posto de eletricista. É uma das "
    "perguntas-chave a esclarecer com a fiscalização antes de construir a aplicação. Nenhum "
    "colaborador está cadastrado em nenhum dos dois blocos, e nenhuma data de entrega foi "
    "preenchida — a aba está inteiramente em branco quanto a movimentação real."
))

story.append(H("3.4 MATERIAIS PINTORES (25 itens)", level=1))
story.append(P(
    "Aba com 2 blocos. Curiosamente, o <b>bloco 1</b> (colunas A–K) está <b>preenchido com "
    "todas as 25 datas de entrega (05/05/2025)</b> mas <b>sem nome de colaborador</b>. O bloco "
    "2 (colunas Q–AA) é um template vazio. Os itens incluem: caixa de ferramentas, espátulas "
    "n° 08 e n° 12, rolos de espuma n° 09 e n° 15, bandeja de plástico para rolo, escova de "
    "cerdas macias, trincha 2\" e 3\", rodo de pintura, lixa d'água n° 220 e 320, massa acrílica, "
    "fita crepe 25mm, compressor de ar 50L 2HP, pistola para pintura, lixadeira orbital, entre "
    "outros. O rodapé do bloco 2 traz a assinatura \"REPRESENTANTE JIREH\" (não CAROLDO), o que "
    "sugere que a empresa JIREH responde por este posto específico."
))

story.append(H("3.5 MATERIAIS INST. HIDRÁULICOS (43 itens)", level=1))
story.append(P(
    "Aba com <b>3 blocos laterais</b> (colunas A–K, P–Z, AG–AQ). O bloco 2 (colunas P–Z) está "
    "<b>preenchido com 37 das 43 datas de entrega (todas em 05/05/2025)</b> mas, novamente, "
    "<b>sem nome de colaborador</b>. Os 43 itens são ferramentas específicas de hidráulica: "
    "caixa de ferramentas, chaves grifo 14\"/18\"/24\"/36\", chave de corrente para tubos 5\", "
    "engraxateira manual, jogo de chaves combinadas 6–36mm, pá de corte, picareta, enxada, "
    "carrinho de mão, vassoura de piaçaba, pá de lixo, balde, dentre outras. Blocos 1 e 3 "
    "estão totalmente vazios (apenas template)."
))

story.append(H("3.6 MATERIAIS TÉC. REFRIGERAÇÃO (48 itens)", level=1))
story.append(P(
    "Aba com 2 blocos (colunas A–K e R–AB). O <b>bloco 1</b> está <b>preenchido com 46 das 48 "
    "datas de entrega</b>, todas entre 12/03/2025 e 21/03/2025, mas <b>sem nome de colaborador</b>. "
    "Os itens são voltados à manutenção de sistemas de refrigeração: caixa de ferramentas, bolsa "
    "tipo mala em lona, jogo de 8 chaves de fenda com isolamento 1000V, jogo de 8 chaves Philips "
    "com isolamento 1000V, chave Phillips/Fenda cotoco, alicates (universal, de corte, de pressão, "
    "bomba d'água), chave inglesa 10\", chave de boca 8x9 e 13x14, chaveAllen, soquetes, "
    "multímetro digital, alicate amperímetro, termômetro digital infravermelho, scanner de "
    "velocidade, balança para gás refrigerante até 50kg, bomba de vácuo 5 CFM, manômetros "
    "manifold 4 válvulas, mangueiras de serviço, cortador de tubo, curvador de tubo, "
    "expansor/alargador, solda oxigênio, maçarico, kit de brocas, saca-pino, etc."
))

story.append(H("3.7 MATERIAIS TÉC. INFRA. DE REDES (25 itens)", level=1))
story.append(P(
    "Única aba de materiais com nome preenchido em <b>minúsculas (\"Joel\")</b> no bloco 1 "
    "(colunas A–K), com todas as 25 datas de entrega preenchidas (entre 04/07/2025 e 07/04/25). "
    "Os itens são específicos para infraestrutura de redes: caixa de ferramentas 50×20×21cm, "
    "bolsa tipo mala 16\", 8 chaves de fenda, 8 chaves Philips, arco de serra regulável 12\", "
    "fita métrica 5m, alicate de crimpagem RJ45/RJ12, alicate de corte diagonal, alicate "
    "universal, caneta detector de tensão, testador de cabo de rede, scanner de cabos, "
    "furadeira de impacto 700W, ponta broca 4/6/8/10mm, kit de ferramentas para rede, "
    "etc. O bloco 2 (colunas Q–AA) é um template vazio. O colaborador \"Joel\" muito "
    "provavelmente é a mesma pessoa que aparece como \"Joel Turela Tompsen\" na aba UNIFORME "
    "(bloco 3) — esta divergência de grafia é um dos problemas a corrigir na futura aplicação."
))

story.append(PageBreak())

# ============ 4. GRUPO EPI ============
story.append(H("4. Grupo 2 — EPI por Posto", level=0))
story.append(P(
    "O grupo EPI (Equipamentos de Proteção Individual) reúne <b>9 abas</b>, uma para cada "
    "posto (incluindo aqui o <b>Supervisor</b> e o <b>Servente de Obras</b>, que não aparecem "
    "no grupo Materiais). A estrutura das colunas é similar à do grupo Materiais: <i>Descrição "
    "EPI</i> (4 colunas mescladas), <i>Uni.</i>, <i>Imagem Ilustrativa</i> (3 colunas), "
    "<i>Data de entrega</i> (3 colunas) e <i>Observação</i> (3 colunas). O número de blocos "
    "laterais varia de 1 (EPI SUPERVISOR) a 5 (EPI MARCENEIRO), refletindo quantos "
    "colaboradores daquele posto o layout prevê."
))
story.append(P(
    "Um detalhe importante: <b>a cor do capacete é específica por posto</b> e está descrita "
    "no próprio item \"Capacete de Segurança, com jugular, na cor X\": amarelo para marceneiro, "
    "pintor e técnico de refrigeração; laranja para eletricista e técnico de redes; azul para "
    "pedreiro e instalador hidráulico; verde para servente. Esta codificação cromática por "
    "posto deve ser preservada na aplicação futura como um atributo de negócio (\"cor padrão "
    "do capacete por posto\") e não como parte livre da descrição do item."
))

epi_data = [
    ['Aba', 'Posto', 'Blocos', 'Itens', 'Cor do capacete', 'Colaborador(es)'],
    ['EPI SUPERVISOR', 'Supervisor', '1', '4', '—', '(vazio)'],
    ['EPI MARCENEIRO', 'Marceneiro', '5', '6', 'Amarelo', '(5 blocos vazios)'],
    ['EPI ELETRICISTA', 'Eletricista', '3', '7', 'Laranja', 'Anderson Claiton L. da Cruz (1) + 2 vazios'],
    ['EPI SERVENTE', 'Servente', '2', '8', 'Verde', '(2 blocos vazios)'],
    ['EPI INST. HIDRÁULICO', 'Inst. Hidráulico', '4', '7', 'Azul', '(4 blocos vazios)'],
    ['EPI PEDREIRO', 'Pedreiro', '2', '9', 'Azul', 'Andrea dos Santos Pavão (1) + 1 vazio'],
    ['EPI PINTOR', 'Pintor', '2', '9', 'Amarelo', 'Gilberto Texeira da Rosa (1) + 1 vazio'],
    ['EPI TÉC. REFRIGERAÇÃO', 'Téc. Refrigeração', '3', '6', 'Amarelo', 'Marcos Vinícius Machado (1) + 2 vazios'],
    ['EPI TÉC. INFRA. DE REDES', 'Téc. Redes', '2', '6', 'Laranja', '(2 blocos vazios)'],
]
story.append(Spacer(1, 6))
story.append(make_table(epi_data, col_widths=[44*mm, 28*mm, 14*mm, 12*mm, 22*mm, 50*mm]))
story.append(Paragraph("Tabela 2 — Visão consolidada das 9 abas do grupo EPI", styles['caption']))

story.append(P(
    "Os EPIs típicos por posto incluem: capacete de segurança com jugular (na cor do posto), "
    "óculos de segurança (incolor e/ou preto fumê), botina NR 10, luvas (vaqueta, tátil EN "
    "1149, borracha nitrílica, isolante até o antebraço NBR 16295 — só para eletricista), "
    "macacão para proteção química (só para pintor), cinto de segurança tipo paraquedista "
    "(para trabalhos em altura), protetor auricular tipo concha, máscara PFF2 e/ou semifacial "
    "com filtro (para pintor). O EPI SUPERVISOR tem apenas 4 itens, o EPI MARCENEIRO tem 6, "
    "e os demais variam entre 6 e 9 itens. A variabilidade reflete os riscos específicos de "
    "cada posto e deve ser parametrizada no banco de dados como um relacionamento N:N entre "
    "<i>Posto</i> e <i>Item EPI</i>."
))

story.append(PageBreak())

# ============ 5. GRUPO UNIFORMES ============
story.append(H("5. Grupo 3 — Uniformes", level=0))
story.append(P(
    "O grupo Uniformes tem <b>3 abas</b>. A aba principal <b>UNIFORME</b> concentra 4 blocos "
    "laterais (colunas A–K, M–W, Y–AI, AK–AU), cada um para um colaborador. As outras duas "
    "abas — <b>UNIFORME FABIANO</b> e <b>UNIFORME ELETRICISTA</b> — são fragmentos que não "
    "seguem exatamente o mesmo padrão de layout, o que indica que provavelmente foram criadas "
    "posteriormente para acomodar colaboradores que não cabiam na aba principal. A coluna "
    "<i>Assinatura</i> aparece aqui (não existe nos grupos Materiais/EPI), substituindo a "
    "coluna <i>Observação</i>. Os <b>10 itens padrão</b> do uniforme são: camisa polo manga "
    "curta, camiseta manga longa, camiseta manga curta, calça em brim pesado cinza, meia "
    "preta, botina de segurança microfibra com biqueira composite, bota de borracha PVC cano "
    "alto, jaleco operacional manga longa, moletom peludinho com emblema e jaqueta de inverno "
    "forrada com manta."
))

uni_data = [
    ['Aba', 'Blocos', 'Colaborador(es)', 'Status'],
    ['UNIFORME', '4', 'Ivo Leandro da Silva Vieira; Gilberto Texeira Da Rosa; Joel Turela Tompsen; Andrea santos pavao', 'Todos preenchidos (datas 03/12/2025 a 13/10/2025)'],
    ['UNIFORME FABIANO', '1 (atípico)', 'Fabiano L. Alves', 'Preenchido; layout começa na linha 2 (não na 1); sem blocos laterais'],
    ['UNIFORME ELETRICISTA', '2', 'Dilmar Mendes De Souza; "ELÉTRICA" (erro)', 'Bloco 1 preenchido; bloco 2 tem "ELÉTRICA" no campo de nome (deveria ser nome de pessoa)'],
]
story.append(Spacer(1, 6))
story.append(make_table(uni_data, col_widths=[42*mm, 16*mm, 65*mm, 47*mm]))
story.append(Paragraph("Tabela 3 — Visão das 3 abas do grupo Uniformes", styles['caption']))

story.append(P(
    "A aba <b>UNIFORME FABIANO</b> tem um layout atípico: o cabeçalho começa na linha 2 (não "
    "na linha 1 como as demais), o nome do colaborador está na linha 16 (\"Fabiano L. Alves\") "
    "e a aba não contém blocos laterais — apenas um único bloco de 11 colunas (A–K). Isto "
    "sugere que a aba foi criada às pressas, sem seguir o template padrão, possivelmente "
    "porque o Fabiano foi alocado depois do layout inicial da aba UNIFORME já estar cheio. "
    "Este é um forte indicador de que o modelo atual de \"blocos laterais fixos\" não está "
    "escalonando e precisa ser substituído por um modelo relacional na aplicação futura."
))

story.append(P(
    "A aba <b>UNIFORME ELETRICISTA</b> tem uma anomalia curiosa: no bloco 2 (colunas N–X), "
    "o campo \"NOME DO COLABORADOR:\" está preenchido com a palavra <b>\"ELÉTRICA\"</b> — "
    "claramente um erro, pois deveria ser o nome de uma pessoa. Provavelmente foi um "
    "lapso de digitação ou um placeholder esquecido. O bloco 2 tem todos os 11 itens "
    "listados mas nenhuma data de entrega preenchida. O bloco 1 (Dilmar Mendes De Souza) "
    "está parcialmente preenchido: 7 das 11 datas de entrega foram registradas, todas em "
    "06/10/2025."
))

story.append(PageBreak())

# ============ 6. GRUPO DOCUMENTOS ============
story.append(H("6. Grupo 4 — Documentos", level=0))
story.append(P(
    "A aba <b>DOCUMENTOS</b> é única no seu grupo e controla a entrega da documentação legal "
    "e contratual de cada terceirizado. Tem 4 blocos laterais (colunas A–K, M–W, Y–AI, AK–AU) "
    "e o cabeçalho institucional é ligeiramente diferente das demais abas: começa com dois "
    "espaços antes de \"ESTADO DO RIO GRANDE DO SUL\" (provavelmente um ajuste de indentação "
    "do template). Os <b>9 documentos</b> controlados são: (1) Cópia da folha dos posto de "
    "trabalho, (2) Cópia da carteira de trabalho, (3) Cópia do contrato, (4) Cópia do ASO "
    "(Atestado de Saúde Ocupacional), (5) Cópia da carteira de vacinação (COVID), (6) Cópia "
    "das Normas 05, 07, 10, 12, 13 e 14, (7) Cópia da NR-10 (para eletricistas), (8) Cópia "
    "do comprovante de residência, (9) Cópia do comprovante de escolaridade."
))

doc_data = [
    ['Bloco', 'Colaborador', 'Datas preenchidas', 'Observação'],
    ['1 (A–K)', '(vazio)', '0 de 9', 'Apenas template'],
    ['2 (M–W)', 'Rogerio Alves', '6 de 9 (todas em 03/12/2025)', '3 documentos ainda pendentes'],
    ['3 (Y–AI)', 'JOSÉ FERNANDO NEVES FALLER', '6 de 9 (todas em 06/10/2025)', '3 documentos ainda pendentes'],
    ['4 (AK–AU)', 'ANDERSON CLAITON LOPES DA CRUZ', '6 de 9 (todas em 11/03/2025)', '3 documentos ainda pendentes'],
]
story.append(Spacer(1, 6))
story.append(make_table(doc_data, col_widths=[22*mm, 50*mm, 40*mm, 58*mm]))
story.append(Paragraph("Tabela 4 — Distribuição dos blocos da aba DOCUMENTOS", styles['caption']))

story.append(P(
    "Um padrão claro: <b>quando os documentos são entregues, são entregues todos juntos</b> "
    "(no mesmo dia). Isto faz sentido porque os 9 documentos são requisitos admissionais e "
    "normalmente são solicitados em bloco ao RH da empresa contratada. Para 3 dos 4 "
    "colaboradores com entrega registrada, há 6 dos 9 documentos com data — provavelmente "
    "os outros 3 (escolaridade, comprovante de residência e um outro) ainda estão pendentes. "
    "A aba tem um rodapé diferente das demais: em vez de \"As assinaturas acima serão "
    "requeridas...\", diz \"<i>Os documentos listados acima são de responsabilidade da "
    "empresa contratada para fins de fiscalização</i>\" — enfatizando a responsabilidade "
    "documental da CAROLDO (ou JIREH) perante o Estado."
))

story.append(PageBreak())

# ============ 7. TERCEIRIZADOS IDENTIFICADOS ============
story.append(H("7. Terceirizados Identificados", level=0))
story.append(P(
    "A planilha atual <b>não tem uma aba ou seção dedicada ao cadastro de terceirizados</b> "
    "— os nomes aparecem espalhados pelos campos \"NOME DO COLABORADOR:\" em cada bloco "
    "lateral das abas. Esta falta de cadastro centralizado é a causa raiz de vários problemas: "
    "grafias divergentes para a mesma pessoa, impossibilidade de saber em quais postos uma "
    "pessoa atua, e a ausência de atributos críticos como CPF, matrícula, data de admissão, "
    "vínculo contratual (CAROLDO ou JIREH) etc. A futura aplicação deve resolver isto criando "
    "uma entidade <b>Colaborador</b> central, com chave única (CPF ou matrícula), à qual "
    "todas as entregas se referenciam."
))

pess_data = [
    ['#', 'Nome (como aparece)', 'Posto(s)', 'Aba(s) onde aparece', 'Observação'],
    ['1', 'Ivo Leandro da Silva Vieira', 'Marceneiro / Redes', 'MATERIAIS MARCENEIROS (\"Ivo Leandro\"); UNIFORME (bloco 1)', 'Grafia abreviada em Materiais'],
    ['2', 'Andrea dos Santos Pavão (ANDREA DOS SANTOS PAVÃO / Andrea santos pavao)', 'Pedreiro / Pintura(?)', 'EPI PEDREIRO (maiusculado); UNIFORME (bloco 4, minúsculas)', 'Mesma pessoa com 2 grafias'],
    ['3', 'Joel Turela Tompsen (\"Joel\")', 'Redes', 'MATERIAIS TÉC. INFRA. DE REDES (\"Joel\"); UNIFORME (bloco 3)', 'Nome completo só na aba Uniforme'],
    ['4', 'Gilberto Texeira Da Rosa (\"Gilberto Texeira d Rosa\")', 'Pintor', 'EPI PINTOR (bloco 2, grafia \"d Rosa\"); UNIFORME (bloco 2, \"Da Rosa\")', 'Grafia divergente no sobrenome'],
    ['5', 'Anderson Claiton Lopes da Cruz', 'Eletricista', 'EPI ELETRICISTA (bloco 1); DOCUMENTOS (bloco 4)', 'Maiúsculo em Documentos'],
    ['6', 'Dilmar Mendes De Souza', 'Eletricista', 'UNIFORME ELETRICISTA (bloco 1)', '—'],
    ['7', 'MARCOS VINICIUS MACHADO DA SILVA', 'Téc. Refrigeração', 'EPI TÉC. REFRIGERAÇÃO (bloco 2)', 'Maiúsculo'],
    ['8', 'Rogerio Alves', '(não especificado)', 'DOCUMENTOS (bloco 2)', '—'],
    ['9', 'JOSÉ FERNANDO NEVES FALLER', '(não especificado)', 'DOCUMENTOS (bloco 3)', '—'],
    ['10', 'Fabiano L. Alves', '(não especificado)', 'UNIFORME FABIANO (aba própria)', 'Aba isolada só para ele'],
    ['11', '— (não identificados em ~30 blocos)', 'Vários', 'EPI MARCENEIRO (5 blocos), INST. HIDRÁULICO (4 blocos), etc.', 'Vagas em aberto no layout'],
]
story.append(Spacer(1, 6))
story.append(make_table(pess_data, col_widths=[8*mm, 50*mm, 28*mm, 55*mm, 39*mm]))
story.append(Paragraph("Tabela 5 — Lista nominal consolidada dos terceirizados identificados", styles['caption']))

story.append(P(
    "Recomenda-se que, na aplicação futura, o cadastro de cada terceirizado inclua no mínimo: "
    "<b>CPF</b> (chave única), <b>nome completo</b> (com normalização para evitar duplicação), "
    "<b>matrícula</b> na empresa contratada, <b>empresa</b> (CAROLDO ou JIREH), <b>posto</b> "
    "atribuído (com possibilidade de mudança de posto ao longo do tempo), <b>data de admissão "
    "no contrato</b>, <b>data de desligamento</b> (quando aplicável), e <b>documentos digitais</b> "
    "(ASO, carteira de vacinação, NR-10, etc.) com data de validade. Esta estrutura permite "
    "responder perguntas que hoje são impossíveis na planilha: \"quais terceirizados estão "
    "com ASO vencido?\", \"qual o histórico de entregas de EPI para o Ivo Leandro?\", \"quem "
    "está alocado no posto de Pedreiro hoje?\"."
))

story.append(PageBreak())

# ============ 8. INCONSISTÊNCIAS ============
story.append(H("8. Inconsistências e Lacunas Identificadas", level=0))
story.append(P(
    "A análise identou <b>10 categorias de inconsistências</b> no arquivo atual. Estas "
    "inconsistências não são meros detalhes estéticos — cada uma delas corresponde a um "
    "risco de auditoria ou a uma fragilidade de controle que deve ser resolvida na futura "
    "aplicação. Apresentamos a seguir cada categoria, com exemplos concretos:"
))

incon_data = [
    ['#', 'Categoria', 'Exemplos concretos', 'Impacto'],
    ['1', 'Divergência contratual', 'MATERIAIS ELETRICISTAS traz \"CONTRATO 003/2026 (NOVO)\" enquanto as 19 demais abas usam 003/2025', 'Indica renovação em curso, erro de digitação ou aditivo — precisa esclarecimento'],
    ['2', 'Divergência de empresa representante', 'MATERIAIS ELETRICISTAS e MATERIAIS PINTORES assinam como \"REPRESENTANTE JIREH\"; todas as demais como \"REPRESENTANTE CAROLDO\"', 'Sugere subcontratação da JIREH pela CAROLDO — vínculo contratual precisa ficar explícito'],
    ['3', 'Blocos sem nome de colaborador', '>30 blocos têm \"NOME DO COLABORADOR: ..............\" sem preenchimento', 'Layout prevê colaboradores que ainda não foram alocados — desconexão entre planejamento e execução'],
    ['4', 'Datas preenchidas sem nome', 'MATERIAIS PINTORES (bloco 1), MATERIAIS INST. HIDRÁULICOS (bloco 2), MATERIAIS TÉC. REFRIGERAÇÃO (bloco 1) — todos com datas de entrega preenchidas mas sem nome de quem recebeu', 'Impossível auditar quem recebeu o material — risco fiscal e legal'],
    ['5', 'Grafias divergentes para a mesma pessoa', 'Andrea dos Santos Pavão (EPI PEDREIRO) vs Andrea santos pavao (UNIFORME); Gilberto Texeira d Rosa vs Gilberto Texeira Da Rosa; Joel vs Joel Turela Tompsen; Ivo Leandro vs Ivo Leandro da Silva Vieira', 'Duplicação aparente de pessoas — dificulta históricos e relatórios'],
    ['6', 'Nome errado no campo de colaborador', 'UNIFORME ELETRICISTA bloco 2: \"ELÉTRICA\" como nome de colaborador (deveria ser nome de pessoa)', 'Erro de digitação ou placeholder esquecido'],
    ['7', 'Dado espúrio em célula fora de padrão', 'MATERIAIS PEDREIROS célula CO12 contém \"zz\"', 'Lixo em célula — provável erro de digitação durante a montagem do layout'],
    ['8', 'Coluna Imagem Ilustrativa universalmente vazia', 'Nenhuma das 20 abas tem qualquer imagem anexada nos >250 itens com essa coluna', 'Recurso previsto no layout mas nunca utilizado — deveria ter foto do item ou ser removido'],
    ['9', 'Formatos de data inconsistentes', 'Mesclagem de \"03/12/2025\", \"3/12/25\", \"5/5/25\", \"7/4/25\" e valores datetime como 2025-12-03', 'Difícil de processar programaticamente; risco de interpretação errada (dd/mm vs mm/dd)'],
    ['10', 'Quantidade variável de slots de data preenchidos por item', 'Cada item tem 4 slots mas alguns têm 1, 2, 3 ou 4 datas; não está claro quando se justifica preencher mais de uma', 'Regra de negócio implícita — precisa ser explicitada antes da aplicação'],
]
story.append(Spacer(1, 6))
story.append(make_table(incon_data, col_widths=[8*mm, 32*mm, 70*mm, 60*mm]))
story.append(Paragraph("Tabela 6 — Inconsistências e lacunas identificadas no arquivo atual", styles['caption']))

story.append(callout(
    "<b>Recomendação:</b> Antes de iniciar o desenvolvimento da aplicação, recomenda-se "
    "uma sessão de entrevistas com a fiscalização técnica e com o representante da CAROLDO "
    "para esclarecer as inconsistências #1, #2, #4 e #10 — estas têm impacto direto no "
    "modelo de dados. As inconsistências #3, #5, #6, #7, #8 e #9 são problemas operacionais "
    "que a própria aplicação resolverá por design.",
    kind='warn'
))

story.append(PageBreak())

# ============ 9. MODELO DE DADOS ============
story.append(H("9. Modelo de Dados Proposto para a Aplicação", level=0))
story.append(P(
    "Com base no mapeamento das 20 abas, propõe-se o modelo entidade-relacionamento abaixo "
    "para a futura aplicação. O modelo tem <b>9 entidades principais</b> e foi desenhado "
    "para resolver as inconsistências identificadas na Seção 8: centraliza o cadastro de "
    "colaboradores (resolvendo grafias divergentes), explicita o vínculo contratual "
    "(resolvendo a divergência CAROLDO vs JIREH), e transforma os \"4 slots de data\" em "
    "uma relação 1:N entre Item e Entrega (permitindo qualquer número de entregas/reposições)."
))

story.append(H("9.1 Entidades e relacionamentos", level=1))

ent_data = [
    ['Entidade', 'Campos principais', 'Relacionamentos', 'Origem no Excel'],
    ['CONTRATO', 'id, número (003/2025, 003/2026), data_assinatura, vigência_inicio, vigência_fim, objeto', '1:N com EMPRESA_CONTRATADA; 1:N com COLABORADOR', 'Cabeçalho institucional das 20 abas (\"CONTRATO DE MANUTENÇÃO PREDIAL 003/2025\")'],
    ['EMPRESA', 'id, nome (CAROLDO, JIREH), CNPJ, papel (contratada_principal ou subcontratada)', 'N:N com CONTRATO (via EMPRESA_CONTRATO); 1:N com COLABORADOR', 'Rodapé das abas: \"REPRESENTANTE CAROLDO\" / \"REPRESENTANTE JIREH\"'],
    ['POSTO', 'id, nome (Marceneiro, Pedreiro, Eletricista, Pintor, Inst. Hidráulico, Téc. Refrigeração, Téc. Redes, Supervisor, Servente), cor_capacete', '1:N com COLABORADOR; 1:N com ITEM_POSTO', 'Nomes das abas (uma por posto) e descrição do item \"Capacete... na cor X\"'],
    ['COLABORADOR', 'id, CPF (único), nome_completo, matrícula, empresa_id, contrato_id, posto_id, data_admissao, data_desligamento, ativo', 'N:1 com EMPRESA; N:1 com CONTRATO; N:1 com POSTO; 1:N com ENTREGA; 1:N com ASSINATURA', 'Campo \"NOME DO COLABORADOR:\" em cada bloco lateral'],
    ['CATEGORIA', 'id, nome (Materiais, EPI, Uniforme, Documento), descrição', '1:N com ITEM', 'Grupo da aba (cada grupo controla uma categoria)'],
    ['ITEM', 'id, categoria_id, descricao_detalhada, unidade (\"1\"), cor_padrao (se aplicável), ativo', 'N:1 com CATEGORIA; N:N com POSTO (via ITEM_POSTO); 1:N com ENTREGA', 'Coluna \"Descrição Materiais/EPI/Uniforme/Documento\" + coluna \"Uni.\"'],
    ['ITEM_POSTO', 'id, item_id, posto_id, quantidade_esperada, obrigatorio (bool)', 'N:1 com ITEM; N:1 com POSTO', 'Combinação: items em uma aba = items esperados para aquele posto'],
    ['ENTREGA', 'id, colaborador_id, item_id, data_entrega, observacao, foto_url, registrado_por (usuario_id), criado_em', 'N:1 com COLABORADOR; N:1 com ITEM; N:1 com USUARIO', 'Coluna \"Data de entrega\" (cada um dos 4 slots vira 1 registro) + \"Observação\"'],
    ['ASSINATURA', 'id, colaborador_id (ou entrega_id), tipo (fiscalizacao_tecnica ou representante_empresa), empresa_id, usuario_id, data_hora, ip, geo_lat, geo_lon, hash_documento', 'N:1 com COLABORADOR; N:1 com USUARIO; N:1 com EMPRESA', 'Rodapé: \"FISCALIZAÇÃO TÉCNICA: ...\" / \"REPRESENTANTE CAROLDO: ...\"'],
]
story.append(Spacer(1, 6))
story.append(make_table(ent_data, col_widths=[24*mm, 50*mm, 45*mm, 51*mm]))
story.append(Paragraph("Tabela 7 — Modelo entidade-relacionamento proposto (9 entidades)", styles['caption']))

story.append(H("9.2 Cardinalidades principais", level=1))
story.append(P(
    "<b>CONTRATO 1:N EMPRESA</b> — Um contrato pode ter uma empresa contratada principal e "
    "eventuais subcontratadas (JIREH sob CAROLDO). <b>EMPRESA 1:N COLABORADOR</b> — Cada "
    "terceirizado é funcionário de uma empresa. <b>POSTO 1:N COLABORADOR</b> — Cada "
    "colaborador ocupa um posto por vez (mas pode mudar ao longo do tempo — histórico "
    "preservado). <b>POSTO N:N ITEM</b> (via ITEM_POSTO) — Cada posto tem um conjunto "
    "esperado de itens (ex.: Pedreiro tem 35 ferramentas + 9 EPIs + 10 uniformes + 9 "
    "documentos = 63 itens esperados). <b>COLABORADOR 1:N ENTREGA</b> — Um colaborador "
    "recebe múltiplas entregas ao longo do contrato. <b>ITEM 1:N ENTREGA</b> — Um item "
    "pode ser entregue múltiplas vezes ao mesmo colaborador (reposição). <b>ENTREGA 1:N "
    "ASSINATURA</b> — Cada entrega pode ter 2 assinaturas: fiscalização técnica + "
    "representante da empresa."
))

story.append(H("9.3 Mapeamento Excel → Aplicação", level=1))
story.append(P(
    "Cada \"bloco lateral\" de uma aba do Excel corresponde, no modelo proposto, a um "
    "conjunto de registros <b>ENTREGA</b> associados a um <b>COLABORADOR</b> específico "
    "(identificado pelo campo \"NOME DO COLABORADOR\"). As 4 células de data de entrega "
    "de um item viram até 4 registros ENTREGA (ou mais, se necessário). A coluna "
    "\"Imagem Ilustrativa\" do Excel deve ser substituída por um atributo <b>foto_url</b> "
    "em ENTREGA — ou seja, a foto deixa de ser uma imagem estática do item (que nunca foi "
    "preenchida) e passa a ser uma foto da entrega real, tirada no momento do registro. "
    "A coluna \"Observação\" vem como atributo livre em ENTREGA. O rodapé com "
    "\"FISCALIZAÇÃO TÉCNICA: ...\" e \"REPRESENTANTE [CAROLDO|JIREH]: ...\" transforma-se "
    "em dois registros ASSINATURA por entrega (ou por lote de entregas), com data/hora, "
    "usuário, IP e hash de autenticidade."
))

story.append(PageBreak())

# ============ 10. PERGUNTAS ============
story.append(H("10. Perguntas para Entender o Uso Atual", level=0))
story.append(P(
    "As perguntas abaixo estão organizadas em 5 blocos temáticos. Elas são essenciais para "
    "fechar a lacuna entre o que a planilha atual registra e o que a futura aplicação precisa "
    "controlar. Recomenda-se que sejam respondidas em conjunto pela fiscalização técnica, "
    "pelo representante da CAROLDO (e JIREH, se aplicável) e pelo gestor do contrato na "
    "Secretaria da Casa Civil."
))

story.append(H("10.1 Bloco A — Cadastro de Terceirizados", level=1))
questions_a = [
    "<b>A1.</b> Como é feito hoje, na planilha, o cadastro de um novo terceirizado? Quem decide em qual posto ele será alocado e qual bloco lateral da aba correspondente ele vai ocupar?",
    "<b>A2.</b> Existe um número de matrícula ou CPF associado a cada colaborador? Se sim, onde esse dado é guardado hoje (a planilha não tem nenhuma coluna para isso)?",
    "<b>A3.</b> Qual é o vínculo entre a CAROLDO e a JIREH? A JIREH é subcontratada da CAROLDO para os postos de eletricista e pintor, ou é uma empresa totalmente separada que responde diretamente ao Estado?",
    "<b>A4.</b> Quando um terceirizado é desligado do contrato (fim da obra, demissão, transferência), o que acontece com o bloco lateral dele na aba? É apagado? É mantido para histórico? Como o histórico de entregas fica rastreável?",
    "<b>A5.</b> Um mesmo colaborador pode atuar em mais de um posto ao longo do contrato (ex.: começou como servente, virou pedreiro)? Se sim, como isto é refletido hoje na planilha?",
]
for q in questions_a:
    story.append(Paragraph(q, styles['q'], bulletText='•'))

story.append(H("10.2 Bloco B — Periodicidade de Entregas", level=1))
questions_b = [
    "<b>B1.</b> Cada item na planilha tem <b>4 slots para data de entrega</b> (células mescladas verticalmente em pares). Estes 4 slots representam: (a) entregas trimestrais ao longo do ano, (b) reposições semestrais, (c) entregas fracionadas, (d) outra regra? Qual é a regra de negócio?",
    "<b>B2.</b> Para itens como EPI (botina, luva, capacete), existe uma política de reposição por desgaste (ex.: trocar a cada X meses) ou a reposição é por demanda (quando o colaborador comunicar defeito)?",
    "<b>B3.</b> Para o uniforme, a entrega é única (todos os itens de uma vez) ou escalonada (camisa polo agora, jaqueta de inverno só em maio)? Há padrão sazonal?",
    "<b>B4.</b> Quando um item tem 2 ou mais datas de entrega preenchidas (ex.: 12/03/2025 e 21/03/2025 para o mesmo item do mesmo colaborador), o que isto significa: reposição por perda, entrega fracionada, equipamento devolvido e reentregue?",
    "<b>B5.</b> Há prazo máximo entre a admissão do colaborador e a entrega dos EPIs/uniforme? E da documentação (ASO, carteira de vacinação)? Este prazo está em alguma norma ou contrato?",
]
for q in questions_b:
    story.append(Paragraph(q, styles['q'], bulletText='•'))

story.append(H("10.3 Bloco C — Itens e Postos", level=1))
questions_c = [
    "<b>C1.</b> A lista de itens por posto (46 para marceneiro, 35 para pedreiro, 39 para eletricista, etc.) é <b>fixa no contrato 003/2025</b> ou pode ser alterada durante a vigência? Se pode, quem tem autoridade para incluir/excluir itens?",
    "<b>C2.</b> As descrições dos itens são muito detalhadas (ex.: \"Plaina elétrica profissional 82mm, 700W, 220v, com lâmina e saco coletor\"). Estas descrições são vinculativas do ponto de vista de fiscalização, ou serve qualquer plaina equivalente?",
    "<b>C3.</b> Quando um item precisa ser substituído por um equivalente de outra marca/modelo, como isto é registrado hoje? A coluna \"Observação\" é usada para isso?",
    "<b>C4.</b> A coluna \"Imagem Ilustrativa\" está universalmente vazia. Ela foi concebida para ter uma foto <b>do item esperado</b> (catálogo de referência) ou uma foto <b>do item entregue</b> (comprovação de entrega)? A aplicação futura deve ter ambos?",
]
for q in questions_c:
    story.append(Paragraph(q, styles['q'], bulletText='•'))

story.append(H("10.4 Bloco D — Assinaturas e Fluxo de Aprovação", level=1))
questions_d = [
    "<b>D1.</b> O rodapé de cada bloco tem dois campos de assinatura: \"FISCALIZAÇÃO TÉCNICA\" e \"REPRESENTANTE [CAROLDO|JIREH]\". <b>Quem assina primeiro</b>? A fiscalização técnica confirma que recebeu, ou o representante da empresa confirma que entregou?",
    "<b>D2.</b> Qual é o <b>prazo</b> entre a última entrega de um bloco (todos os itens entregues) e o momento em que as assinaturas são colocadas? É imediato, ou há um ciclo de fechamento (mensal, trimestral)?",
    "<b>D3.</b> A nota no rodapé diz que as assinaturas \"serão requeridas assim que <b>TODOS</b> os materiais listados tenham sido entregues\". Isto significa que enquanto houver 1 item pendente, ninguém assina? Ou há assinaturas parciais por etapa?",
    "<b>D4.</b> A assinatura é <b>digital</b> (certificado digital, assinatura eletrônica) ou <b>física</b> (caneta na folha impressa)? Se física, onde as folhas assinadas são arquivadas hoje?",
]
for q in questions_d:
    story.append(Paragraph(q, styles['q'], bulletText='•'))

story.append(H("10.5 Bloco E — Aplicação Futura", level=1))
questions_e = [
    "<b>E1.</b> Quais <b>perfis de usuário</b> a aplicação deve ter? Sugestão inicial: Administrador (gestor do contrato na Secretaria), Fiscalização Técnica (em campo), Representante da Empresa (CAROLDO/JIREH), e Consulta (auditoria externa). Confirma?",
    "<b>E2.</b> A aplicação deve ter <b>versão mobile</b> para uso em campo (registro de entrega com foto e assinatura digital no celular do fiscal)? Ou será exclusivamente desktop, com o campo preenchendo em papel e digitando depois?",
    "<b>E3.</b> É desejável que a aplicação emita <b>alertas automáticos</b> (ex.: \"ASO do Ivo Leandro vence em 30 dias\", \"EPI do Joel não foi entregue há 6 meses\")? Se sim, por e-mail, SMS, ou só dentro do sistema?",
    "<b>E4.</b> A aplicação deve permitir <b>exportar relatórios em PDF/Excel</b> no mesmo layout da planilha atual (para compatibilidade com auditorias externas)? Ou pode ter um layout próprio, desde que os dados estejam completos?",
    "<b>E5.</b> Há previsão de <b>integração</b> com outros sistemas do Estado do RS (sistema de contratos, sistema de RH, sistema de patrimônio)? Se sim, quais?",
]
for q in questions_e:
    story.append(Paragraph(q, styles['q'], bulletText='•'))

story.append(PageBreak())

# ============ 11. PRÓXIMOS PASSOS ============
story.append(H("11. Próximos Passos", level=0))
story.append(P(
    "Com base no diagnóstico apresentado, recomenda-se a construção da aplicação em "
    "<b>3 fases incrementais</b>, cada uma entregando valor por si só e preparando o "
    "terreno para a próxima."
))

story.append(H("Fase 1 — MVP (4 a 6 semanas)", level=1))
story.append(P(
    "Cadastro centralizado de <b>Colaboradores</b> (com CPF, matrícula, empresa, posto, "
    "datas de admissão/desligamento); cadastro de <b>Itens</b> por categoria (Materiais, "
    "EPI, Uniforme, Documento) com a relação N:N <i>Item–Posto</i>; registro de "
    "<b>Entregas</b> com data, observação e referência ao colaborador+item; telas de "
    "listagem e busca (\"o que já foi entregue ao Ivo Leandro?\"). Esta fase já elimina "
    "as inconsistências de grafia divergente, blocos sem nome, e dados espúrios como "
    "\"ELÉTRICA\" ou \"zz\". Migração do histórico atual da planilha para a nova base."
))

story.append(H("Fase 2 — Assinatura Digital e Relatórios (3 a 4 semanas)", level=1))
story.append(P(
    "Implementação do módulo de <b>Assinatura Digital</b> (fiscalização técnica + "
    "representante da empresa) com captura de data/hora, IP, geolocalização (opcional) e "
    "hash de autenticidade. Geração de <b>Relatórios em PDF</b> no formato atual da "
    "planilha (para compatibilidade com auditorias externas) e em formatos resumidos "
    "(dashboards de pendências, compliance por colaborador, etc.)."
))

story.append(H("Fase 3 — Mobile de Campo e Alertas (4 a 6 semanas)", level=1))
story.append(P(
    "Versão <b>mobile-first</b> (PWA ou app nativo) para uso da fiscalização técnica em "
    "campo: registro de entrega com <b>foto do item entregue</b>, captura de assinatura "
    "digital na tela do celular, leitura de QR Code no crachá do colaborador para "
    "identificação rápida. Sistema de <b>alertas automáticos</b> (ASO vencendo, EPI não "
    "entregue há X meses, documento pendente) por e-mail e dentro do sistema. Dashboard "
    "gerencial para o gestor do contrato na Secretaria."
))

story.append(Spacer(1, 12))
story.append(callout(
    "<b>Para destravar a Fase 1</b>, é essencial responder previamente às perguntas dos "
    "Blocos A (cadastro de terceirizados) e B (periodicidade de entregas) da Seção 10. "
    "As respostas destes dois blocos definem o schema de banco de dados e a UX do "
    "registro de entregas. As perguntas dos Blocos C, D e E podem ser respondidas em "
    "paralelo, pois afetam fases posteriores."
))

story.append(Spacer(1, 8))
story.append(P(
    "Após o recebimento das respostas, o próximo passo é a elaboração do <b>documento de "
    "requisitos funcionais e não funcionais</b> da aplicação, seguido do desenho técnico "
    "(arquitetura, stack, schema de banco de dados detalhado) e do início do "
    "desenvolvimento da Fase 1."
))

# ============ BUILD ============
output_path = "/home/z/my-project/scripts/_body.pdf"
doc = TocDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=22*mm, bottomMargin=22*mm,
    title="Diagnóstico Técnico — Controle de Entregas CAROLDO",
    author="Z.ai",
    subject="Análise das 20 abas do arquivo CHECKLISTS CAROLDO.xlsx e modelo para aplicação futura",
    creator="Z.ai PDF Skill (ReportLab)",
)
doc.multiBuild(story, onFirstPage=add_page_furniture, onLaterPages=add_page_furniture)
print(f"BODY PDF generated: {output_path}")
print(f"  size: {os.path.getsize(output_path):,} bytes")
