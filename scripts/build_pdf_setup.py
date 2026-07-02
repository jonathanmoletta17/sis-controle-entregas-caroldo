"""
Build the body PDF for: Diagnóstico Técnico — Controle de Entregas CAROLDO
Uses ReportLab with TocDocTemplate for auto-generated Table of Contents.
"""
import os, sys, hashlib, re
from pathlib import Path

# Add pdf skill scripts to path for install_font_fallback
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, Flowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame

# ============ FONT REGISTRATION ============
# Portuguese-only document — Latin fonts suffice
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# ============ PALETTE (cold/institutional blue) ============
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

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ============ STYLES ============
BODY_FONT = 'FreeSerif'
BODY_BOLD = 'FreeSerif-Bold'

styles = {}

styles['body'] = ParagraphStyle(
    name='Body', fontName=BODY_FONT, fontSize=10.5, leading=16,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY,
    firstLineIndent=14, spaceAfter=6,
)

styles['body_noindent'] = ParagraphStyle(
    name='BodyNoIndent', parent=styles['body'],
    firstLineIndent=0,
)

styles['h1'] = ParagraphStyle(
    name='H1', fontName=BODY_BOLD, fontSize=20, leading=26,
    textColor=HEADER_FILL, alignment=TA_LEFT,
    spaceBefore=12, spaceAfter=12,
    keepWithNext=1,
)

styles['h2'] = ParagraphStyle(
    name='H2', fontName=BODY_BOLD, fontSize=14, leading=20,
    textColor=ACCENT, alignment=TA_LEFT,
    spaceBefore=16, spaceAfter=8,
    keepWithNext=1,
)

styles['h3'] = ParagraphStyle(
    name='H3', fontName=BODY_BOLD, fontSize=11.5, leading=16,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    spaceBefore=10, spaceAfter=4,
    keepWithNext=1,
)

styles['caption'] = ParagraphStyle(
    name='Caption', fontName='FreeSerif-Italic', fontSize=9, leading=12,
    textColor=TEXT_MUTED, alignment=TA_CENTER,
    spaceBefore=4, spaceAfter=12,
)

styles['callout'] = ParagraphStyle(
    name='Callout', fontName=BODY_FONT, fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
    leftIndent=12, rightIndent=12,
    backColor=CARD_BG, borderColor=ACCENT, borderWidth=0,
    borderPadding=10, spaceBefore=8, spaceAfter=8,
)

styles['toc_l0'] = ParagraphStyle(
    name='TOCL0', fontName=BODY_BOLD, fontSize=11, leading=18,
    textColor=TEXT_PRIMARY, leftIndent=0,
    spaceBefore=4, spaceAfter=2,
)
styles['toc_l1'] = ParagraphStyle(
    name='TOCL1', fontName=BODY_FONT, fontSize=10, leading=16,
    textColor=TEXT_MUTED, leftIndent=18,
    spaceBefore=2, spaceAfter=2,
)

styles['table_cell'] = ParagraphStyle(
    name='TableCell', fontName=BODY_FONT, fontSize=9, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
styles['table_cell_center'] = ParagraphStyle(
    name='TableCellC', parent=styles['table_cell'], alignment=TA_CENTER,
)
styles['table_header'] = ParagraphStyle(
    name='TableHeader', fontName=BODY_BOLD, fontSize=9.5, leading=12,
    textColor=colors.white, alignment=TA_CENTER,
)

# ============ DOC TEMPLATE WITH TOC ============
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# Page numbers and header/footer
def add_page_furniture(canvas, doc):
    canvas.saveState()
    page_w, page_h = A4
    # Top thin line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, page_h - 15*mm, page_w - 20*mm, page_h - 15*mm)
    # Header text (left)
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(20*mm, page_h - 12*mm, "Diagnóstico Técnico · Controle de Entregas CAROLDO · Contrato 003/2025")
    # Footer line
    canvas.line(20*mm, 15*mm, page_w - 20*mm, 15*mm)
    # Page number (right)
    canvas.setFont('FreeSerif', 9)
    canvas.setFillColor(TEXT_PRIMARY)
    canvas.drawRightString(page_w - 20*mm, 10*mm, f"{doc.page}")
    canvas.setFont('FreeSerif-Italic', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(20*mm, 10*mm, "Z.ai · Julho 2026")
    canvas.restoreState()

# ============ HELPERS ============
def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def make_table(data, col_widths=None, header=True, font_size=9, stripe=True):
    """Build a styled table from list-of-lists. Cells wrapped in Paragraph for proper wrapping."""
    if col_widths is None:
        # Equal widths
        n = len(data[0])
        page_w = A4[0] - 40*mm  # available width
        col_widths = [page_w / n] * n

    # Convert all cells to Paragraphs
    wrapped = []
    for ri, row in enumerate(data):
        new_row = []
        for ci, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                new_row.append(cell)
            else:
                s = str(cell) if cell is not None else ""
                if ri == 0 and header:
                    new_row.append(Paragraph(s, styles['table_header']))
                else:
                    new_row.append(Paragraph(s, styles['table_cell']))
        wrapped.append(new_row)

    t = Table(wrapped, colWidths=col_widths, repeatRows=1 if header else 0)
    ts = [
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LINEABOVE', (0,0), (-1,0), 0.5, HEADER_FILL),
        ('LINEBELOW', (0,-1), (-1,-1), 0.5, HEADER_FILL),
        ('LINEBELOW', (0,0), (-1,0), 0.5, HEADER_FILL),
    ]
    if header:
        ts.append(('BACKGROUND', (0,0), (-1,0), HEADER_FILL))
        ts.append(('TEXTCOLOR', (0,0), (-1,0), colors.white))
    if stripe:
        for ri in range(1 if header else 0, len(data)):
            if (ri - (1 if header else 0)) % 2 == 1:
                ts.append(('BACKGROUND', (0,ri), (-1,ri), TABLE_STRIPE))
    t.setStyle(TableStyle(ts))
    return t

def callout(text, color=None):
    """A small callout/note box."""
    bg = color if color else CARD_BG
    p = ParagraphStyle(
        name='CalloutInline', parent=styles['callout'],
        backColor=bg, borderColor=ACCENT, borderPadding=10,
    )
    return Paragraph(text, p)

print("Setup OK")
