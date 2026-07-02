"""Merge cover.pdf + body.pdf into the final deliverable."""
from pypdf import PdfReader, PdfWriter
import os

A4_W, A4_H = 595.28, 841.89

def normalize_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    # Force scaling if dimensions are off by more than 0.3pt
    if abs(w - A4_W) > 0.3 or abs(h - A4_H) > 0.3:
        page.scale_to(A4_W, A4_H)
    return page

cover_path = "/home/z/my-project/scripts/_cover.pdf"
body_path = "/home/z/my-project/scripts/_body.pdf"
final_path = "/home/z/my-project/download/Diagnostico_Checklists_CAROLDO.pdf"

cover = PdfReader(cover_path)
body = PdfReader(body_path)
writer = PdfWriter()

# Add cover (normalize to A4)
for page in cover.pages:
    writer.add_page(normalize_to_a4(page))

# Add body pages
for page in body.pages:
    writer.add_page(page)

# Set metadata
writer.add_metadata({
    "/Title": "Diagnóstico Técnico — Controle de Entregas CAROLDO (Contrato 003/2025)",
    "/Author": "Z.ai",
    "/Subject": "Análise das 20 abas do arquivo CHECKLISTS CAROLDO.xlsx e modelo de dados para aplicação futura",
    "/Creator": "Z.ai PDF Skill",
    "/Keywords": "CAROLDO, JIREH, Contrato 003/2025, Manutenção Predial, RS, EPI, Materiais, Uniformes, Documentos, Diagnóstico",
})

os.makedirs(os.path.dirname(final_path), exist_ok=True)
with open(final_path, "wb") as f:
    writer.write(f)

size = os.path.getsize(final_path)
total_pages = len(cover.pages) + len(body.pages)
print(f"✓ Final PDF: {final_path}")
print(f"  Size: {size:,} bytes ({size/1024:.1f} KB)")
print(f"  Pages: {total_pages} (1 cover + {len(body.pages)} body)")
