"""
Shared PDF layout utilities for ReportLab reports.
Provides a consistent RegiFarm-branded header, footer and branding helpers.
"""
import logging
from copy import deepcopy
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.request import urlopen

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


logger = logging.getLogger(__name__)

CURRENT_FILE = Path(__file__).resolve()
PROJECT_ROOT = next((parent for parent in CURRENT_FILE.parents if parent.name == "RegiFarm-Pro"), CURRENT_FILE.parents[0])
# BACKEND_ROOT è la directory 'backend' (2 livelli sopra da app/utils/pdf_layout.py)
BACKEND_ROOT = CURRENT_FILE.parents[2] if len(CURRENT_FILE.parents) > 2 else None

# URL pubblico del logo RegiFarm su Supabase Storage (fallback per produzione)
# Il logo deve essere caricato in un bucket pubblico 'regifarm_assets' o simile
# Se SUPABASE_URL è configurato, costruiamo l'URL, altrimenti usiamo None
def _get_public_logo_url() -> Optional[str]:
    try:
        from app.core.config import settings
        if settings.SUPABASE_URL:
            # URL pubblico del logo in Supabase Storage
            # Formato: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
            return f"{settings.SUPABASE_URL}/storage/v1/object/public/regifarm_assets/RegiFarm_Logo.png"
    except Exception:
        pass
    return None

# Cerca il logo in diverse posizioni possibili (in ordine di priorità)
_logo_candidates = []
# 1. Nella root del progetto (sviluppo locale)
if PROJECT_ROOT and (PROJECT_ROOT / "RegiFarm_Logo.png").is_file():
    _logo_candidates.append(PROJECT_ROOT / "RegiFarm_Logo.png")
# 2. URL pubblico su Supabase Storage (produzione - prioritario)
public_logo_url = _get_public_logo_url()
if public_logo_url:
    _logo_candidates.append(public_logo_url)

DEFAULT_REGIFARM_LOGO_PATH = _logo_candidates[0] if _logo_candidates else None

# Log per debug
if not DEFAULT_REGIFARM_LOGO_PATH:
    logger.warning(
        f"RegiFarm logo non trovato. Cercato in: "
        f"PROJECT_ROOT={PROJECT_ROOT}, "
        f"SUPABASE_URL={public_logo_url if public_logo_url else 'non configurato'}"
    )
else:
    logger.info(f"RegiFarm logo trovato: {DEFAULT_REGIFARM_LOGO_PATH}")

DEFAULT_DOC_KWARGS = {
    "pagesize": A4,
    "leftMargin": 20 * mm,
    "rightMargin": 20 * mm,
}

DEFAULT_BRANDING: Dict[str, Any] = {
    "regifarm_name": "RegiFarm",
    "regifarm_tagline": "Gestionale professionale per l'allevamento",
    "regifarm_logo_path": str(DEFAULT_REGIFARM_LOGO_PATH) if DEFAULT_REGIFARM_LOGO_PATH else None,
    "report_title": "Report",
    "report_subtitle": "",
    "footer_text": "Documento generato con RegiFarm",
    "primary_color": colors.HexColor("#2E7D32"),
    "accent_color": colors.HexColor("#FFB300"),
    "text_color": colors.HexColor("#2C3E50"),
    "muted_text_color": colors.HexColor("#607D8B"),
    "header_bg_color": colors.white,
    "header_bar_color": colors.HexColor("#E0E0E0"),
    "footer_bg_color": colors.HexColor("#1B5E20"),
    "footer_wave_color": colors.HexColor("#2E7D32"),
    "company_name": "",
    "company_address": "",
    "company_contacts": "",
    "company_data": "",
    "company_logo_path": None,
    "company_logo_max_width": 60 * mm,
    "company_logo_max_height": 35 * mm,
    "header_height": 35 * mm,  # Ridotto da 35mm per evitare che si estenda oltre la linea
    "footer_height": 17 * mm,
    "show_page_number": True,
    "generated_at": None,
}


def _resolve_candidate_paths(path_value: str) -> Tuple[Path, ...]:
    if not path_value:
        return tuple()

    candidates = []
    initial = Path(path_value).expanduser()
    if initial.is_file():
        candidates.append(initial)

    if PROJECT_ROOT:
        project_candidate = (PROJECT_ROOT / path_value).resolve()
        if project_candidate.is_file():
            candidates.append(project_candidate)

    backend_root = CURRENT_FILE.parents[2] if len(CURRENT_FILE.parents) > 2 else None
    if backend_root:
        backend_candidate = (backend_root / path_value).resolve()
        if backend_candidate.is_file():
            candidates.append(backend_candidate)
        # Cerca anche in backend/static/
        backend_static_candidate = (backend_root / "static" / path_value).resolve()
        if backend_static_candidate.is_file():
            candidates.append(backend_static_candidate)

    return tuple(dict.fromkeys(candidates))  # Remove duplicates preserving order


def _load_logo_reader(path_value: Optional[str]) -> Optional[ImageReader]:
    if not path_value:
        return None

    path_value = str(path_value).strip()

    if path_value.lower().startswith(("http://", "https://")):
        try:
            # Add timeout to prevent hanging
            from urllib.request import urlopen
            import socket
            socket.setdefaulttimeout(5)  # 5 second timeout
            with urlopen(path_value) as response:
                payload = response.read()
            socket.setdefaulttimeout(None)  # Reset timeout
            return ImageReader(BytesIO(payload))
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Errore caricamento logo da URL {path_value}: {e}")
            try:
                socket.setdefaulttimeout(None)  # Reset timeout in case of error
            except:
                pass
            return None

    for candidate in _resolve_candidate_paths(path_value):
        try:
            return ImageReader(str(candidate))
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Errore caricamento logo da path {candidate}: {e}")
            continue
    return None


def _scale_image(image_reader: ImageReader, max_width: float, max_height: float) -> Tuple[float, float]:
    width, height = image_reader.getSize()
    ratio = min(max_width / width, max_height / height)
    return width * ratio, height * ratio


def _draw_logo(canvas_obj, image_reader: ImageReader, x: float, y: float, width: float, height: float):
    canvas_obj.drawImage(
        image_reader,
        x,
        y,
        width=width,
        height=height,
        mask="auto",
        preserveAspectRatio=True,
    )


def _get_attr(source: Any, name: str, default: str = "") -> str:
    if source is None:
        return default
    if isinstance(source, dict):
        return str(source.get(name, default) or default)
    return str(getattr(source, name, default) or default)


def branding_from_azienda(azienda: Any, logo_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Build branding details starting from an Azienda SQLAlchemy model or dict.
    """
    if not azienda:
        return {}

    indirizzo_parts = [
        _get_attr(azienda, "indirizzo"),
        _get_attr(azienda, "indirizzo_cap"),
        _get_attr(azienda, "indirizzo_comune"),
        _get_attr(azienda, "indirizzo_provincia"),
    ]
    indirizzo = ", ".join(part for part in indirizzo_parts if part)

    contacts_parts = [
        _get_attr(azienda, "telefono"),
        _get_attr(azienda, "email"),
        _get_attr(azienda, "pec"),
    ]
    contacts = " | ".join(part for part in contacts_parts if part)

    data_parts = [
        f"P.IVA {_get_attr(azienda, 'partita_iva')}" if _get_attr(azienda, "partita_iva") else "",
        f"CF {_get_attr(azienda, 'codice_fiscale')}" if _get_attr(azienda, "codice_fiscale") else "",
        f"REA {_get_attr(azienda, 'rea_numero')}" if _get_attr(azienda, "rea_numero") else "",
    ]
    company_data = " | ".join(part for part in data_parts if part)

    resolved_logo = (
        logo_path
        or _get_attr(azienda, "logo_public_url")
        or _get_attr(azienda, "logo_url")
        or _get_attr(azienda, "logo_storage_path")
        or _get_attr(azienda, "logo_path")
    )

    return {
        "company_name": _get_attr(azienda, "nome"),
        "company_address": indirizzo,
        "company_contacts": contacts,
        "company_data": company_data,
        "company_logo_path": resolved_logo or None,
    }


def prepare_branding(user_branding: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    branding = deepcopy(DEFAULT_BRANDING)
    if user_branding:
        for key, value in user_branding.items():
            if value is not None:
                branding[key] = value

    branding["generated_at"] = branding.get("generated_at") or datetime.now()
    branding["regifarm_logo"] = _load_logo_reader(branding.get("regifarm_logo_path"))
    branding["company_logo"] = _load_logo_reader(branding.get("company_logo_path"))
    return branding


def create_document(buffer: BytesIO, branding: Optional[Dict[str, Any]] = None, doc_kwargs: Optional[Dict[str, Any]] = None):
    branding_cfg = prepare_branding(branding)
    merged_kwargs = {**DEFAULT_DOC_KWARGS}
    if doc_kwargs:
        merged_kwargs.update(doc_kwargs)

    merged_kwargs.setdefault("topMargin", branding_cfg["header_height"] + 12 * mm)
    merged_kwargs.setdefault("bottomMargin", branding_cfg["footer_height"] + 10 * mm)

    doc = SimpleDocTemplate(buffer, **merged_kwargs)
    return doc, branding_cfg


def _wrap_text(text: str, max_width: float, canvas_obj, font_name: str, font_size: float) -> list:
    """Wrap text to fit within max_width. Uses efficient character-based estimation."""
    if not text:
        return []
    if max_width <= 0:
        return [text]
    
    try:
        # Use character-based estimation for better performance
        # Average character width is approximately 0.6 * font_size for Helvetica
        char_width = font_size * 0.6
        max_chars = int(max_width / char_width)
        
        if len(text) <= max_chars:
            return [text]
        
        words = text.split()
        if not words:
            return [text]
        
        lines = []
        current_line = []
        current_chars = 0
        
        for word in words:
            word_chars = len(word)
            space_chars = 1 if current_line else 0
            
            if current_chars + space_chars + word_chars <= max_chars:
                current_line.append(word)
                current_chars += space_chars + word_chars
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
                current_chars = word_chars
        
        if current_line:
            lines.append(" ".join(current_line))
        
        return lines if lines else [text]
    except Exception:
        # If anything goes wrong, return the text as a single line (truncated if too long)
        max_chars = int(max_width / (font_size * 0.6)) if max_width > 0 else 100
        return [text[:max_chars]] if len(text) > max_chars else [text]


def _draw_basic_header(canvas_obj, doc, branding: Dict[str, Any]):
    """Fallback header drawing in case of unexpected errors."""
    width, height = doc.pagesize
    top = height - 15 * mm
    left = doc.leftMargin

    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica-Bold", 13)
    canvas_obj.setFillColor(branding.get("text_color") or colors.black)
    company_name = branding.get("company_name") or "Azienda"
    canvas_obj.drawString(left, top, company_name)

    y = top - 12
    canvas_obj.setFont("Helvetica", 9)
    canvas_obj.setFillColor(branding.get("muted_text_color") or colors.gray)
    for line in (
        branding.get("company_address"),
        branding.get("company_contacts"),
        branding.get("company_data"),
    ):
        if line:
            canvas_obj.drawString(left, y, line[:120])
            y -= 10

    canvas_obj.restoreState()


def _draw_header(canvas_obj, doc, branding: Dict[str, Any]):
    width, height = doc.pagesize
    header_height = branding["header_height"]
    top_safe_margin = 8 * mm
    left_safe_margin = max(doc.leftMargin, 14 * mm)
    right_safe_margin = max(doc.rightMargin, 12 * mm)
    header_bottom = height - header_height

    canvas_obj.saveState()

    # Modern background panel with subtle gradient effect
    canvas_obj.setFillColor(branding["header_bg_color"])
    canvas_obj.rect(0, header_bottom, width, header_height, stroke=0, fill=1)

    # Modern accent bar - thinner and more elegant
    accent_bar_y = header_bottom + 1.5
    canvas_obj.setFillColor(branding["header_bar_color"])
    canvas_obj.rect(left_safe_margin, accent_bar_y, width - left_safe_margin - right_safe_margin, 1.0, stroke=0, fill=1)

    company_logo = branding.get("company_logo")
    has_logo = company_logo is not None

    # Collect company info lines (only non-empty ones)
    company_name = branding.get("company_name") or ""
    info_lines = [
        branding.get("company_address"),
        branding.get("company_contacts"),
        branding.get("company_data"),
    ]
    info_lines = [line for line in info_lines if line and line.strip()]

    # Modern typography settings
    text_offset_down = 4 * mm  # Abbassa il testo
    line_height_name = 13
    line_height_info = 10
    font_size_name = 14  # Leggermente più grande
    font_size_info = 9   # Leggermente più grande
    spacing_between_sections = 2  # Spazio tra nome e info

    try:
        if has_logo:
            # Layout with logo: logo left, company info next to logo (full width available)
            left_margin = left_safe_margin
            max_logo_width = min(branding["company_logo_max_width"], 50 * mm)
            max_logo_height = max(header_height - (top_safe_margin * 1.4), 14 * mm)

            c_logo_w, c_logo_h = _scale_image(
                company_logo,
                max_logo_width,
                max_logo_height,
            )
            logo_y = height - top_safe_margin - c_logo_h
            _draw_logo(canvas_obj, company_logo, left_margin, logo_y, c_logo_w, c_logo_h)

            # Company info block (right next to logo, using all remaining space)
            info_left = left_margin + c_logo_w + 14  # Più spazio dal logo
            info_width = max(width - info_left - right_safe_margin, 40 * mm)
            # Abbassa il testo rispetto al logo
            info_top = height - top_safe_margin - text_offset_down

            if company_name:
                # Modern bold company name
                canvas_obj.setFont("Helvetica-Bold", font_size_name)
                canvas_obj.setFillColor(colors.black)
                name_lines = _wrap_text(company_name, info_width, canvas_obj, "Helvetica-Bold", font_size_name)
                if name_lines:
                    for line in name_lines:
                        if line:
                            canvas_obj.drawString(info_left, info_top, line)
                            info_top -= line_height_name
                else:
                    canvas_obj.drawString(info_left, info_top, company_name[:100])
                    info_top -= line_height_name

            # Spacing between name and info
            if company_name and info_lines:
                info_top -= spacing_between_sections

            if info_lines:
                # Modern lighter info text
                canvas_obj.setFont("Helvetica", font_size_info)
                canvas_obj.setFillColor(colors.black)
                for idx, line in enumerate(info_lines):
                    wrapped_lines = _wrap_text(line, info_width, canvas_obj, "Helvetica", font_size_info)
                    if wrapped_lines:
                        for wrapped_line in wrapped_lines:
                            if wrapped_line:
                                canvas_obj.drawString(info_left, info_top, wrapped_line)
                                info_top -= line_height_info
                    else:
                        canvas_obj.drawString(info_left, info_top, line[:100])
                        info_top -= line_height_info
                    # Add small spacing between info lines
                    if idx < len(info_lines) - 1:
                        info_top -= 1

        else:
            # Layout without logo: company info centered (full width available)
            info_width = width - left_safe_margin - right_safe_margin
            center_x = width / 2
            # Abbassa il testo
            info_top = height - top_safe_margin - text_offset_down

            if company_name:
                # Modern bold company name
                canvas_obj.setFont("Helvetica-Bold", font_size_name)
                canvas_obj.setFillColor(colors.black)
                name_lines = _wrap_text(company_name, info_width, canvas_obj, "Helvetica-Bold", font_size_name)
                if name_lines:
                    for line in name_lines:
                        if line:
                            canvas_obj.drawCentredString(center_x, info_top, line)
                            info_top -= line_height_name
                else:
                    canvas_obj.drawCentredString(center_x, info_top, company_name[:100])
                    info_top -= line_height_name

            # Spacing between name and info
            if company_name and info_lines:
                info_top -= spacing_between_sections

            if info_lines:
                # Modern lighter info text
                canvas_obj.setFont("Helvetica", font_size_info)
                canvas_obj.setFillColor(colors.black)
                for idx, line in enumerate(info_lines):
                    wrapped_lines = _wrap_text(line, info_width, canvas_obj, "Helvetica", font_size_info)
                    if wrapped_lines:
                        for wrapped_line in wrapped_lines:
                            if wrapped_line:
                                canvas_obj.drawCentredString(center_x, info_top, wrapped_line)
                                info_top -= line_height_info
                    else:
                        canvas_obj.drawCentredString(center_x, info_top, line[:100])
                        info_top -= line_height_info
                    # Add small spacing between info lines
                    if idx < len(info_lines) - 1:
                        info_top -= 1

    except Exception as exc:
        logger.error("Errore durante il disegno dell'header PDF: %s", exc, exc_info=True)
        _draw_basic_header(canvas_obj, doc, branding)

    canvas_obj.restoreState()


def _draw_footer(canvas_obj, doc, branding: Dict[str, Any]):
    width, _ = doc.pagesize
    footer_height = branding["footer_height"]
    canvas_obj.saveState()

    # Layer 1 - darker base wave
    path = canvas_obj.beginPath()
    path.moveTo(0, 0)
    path.lineTo(0, footer_height * 0.55)
    path.curveTo(
        width * 0.18,
        footer_height * 1.1,
        width * 0.38,
        footer_height * 0.2,
        width * 0.58,
        footer_height * 0.75,
    )
    path.curveTo(
        width * 0.78,
        footer_height * 1.2,
        width * 0.92,
        footer_height * 0.35,
        width,
        footer_height * 0.9,
    )
    path.lineTo(width, 0)
    path.close()
    canvas_obj.setFillColor(branding["footer_bg_color"])
    canvas_obj.drawPath(path, stroke=0, fill=1)

    # Layer 2 - lighter wave offset
    path2 = canvas_obj.beginPath()
    path2.moveTo(0, 0)
    path2.lineTo(0, footer_height * 0.25)
    path2.curveTo(
        width * 0.12,
        footer_height * 0.65,
        width * 0.32,
        footer_height * 0.1,
        width * 0.52,
        footer_height * 0.4,
    )
    path2.curveTo(
        width * 0.72,
        footer_height * 0.75,
        width * 0.94,
        footer_height * 0.15,
        width,
        footer_height * 0.45,
    )
    path2.lineTo(width, 0)
    path2.close()
    canvas_obj.setFillColor(branding["footer_wave_color"])
    canvas_obj.drawPath(path2, stroke=0, fill=1)

    # White badge with RegiFarm logo
    badge_radius = min(footer_height / 1.8, 10)
    badge_center_x = doc.leftMargin + badge_radius
    badge_center_y = footer_height / 2
    canvas_obj.setFillColor(colors.white)
    canvas_obj.circle(badge_center_x, badge_center_y, badge_radius, stroke=0, fill=1)

    regifarm_logo = branding.get("regifarm_logo")
    if regifarm_logo:
        max_logo_size = badge_radius * 1.8
        logo_w, logo_h = _scale_image(regifarm_logo, max_logo_size, max_logo_size)
        _draw_logo(
            canvas_obj,
            regifarm_logo,
            badge_center_x - logo_w / 2,
            badge_center_y - logo_h / 2,
            logo_w,
            logo_h,
        )

    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica", 8.5)
    footer_text = branding.get("footer_text") or "Documento generato con RegiFarm"
    timestamp = branding["generated_at"].strftime("%d/%m/%Y %H:%M")
    text_y = badge_center_y - 4 - (5 * mm)
    canvas_obj.drawCentredString(width / 2, text_y, f"{footer_text} - {timestamp}")

    if branding.get("show_page_number", True):
        canvas_obj.setFont("Helvetica-Bold", 8.5)
        canvas_obj.drawRightString(width - doc.rightMargin, text_y, f"Pagina {canvas_obj.getPageNumber()}")

    canvas_obj.restoreState()


def _draw_page_frame(canvas_obj, doc, branding: Dict[str, Any]):
    _draw_header(canvas_obj, doc, branding)
    _draw_footer(canvas_obj, doc, branding)


def build_pdf(doc, story, branding: Dict[str, Any]):
    def _on_page(canvas_obj, doc_obj):
        _draw_page_frame(canvas_obj, doc_obj, branding)

    doc.build(
        story,
        onFirstPage=_on_page,
        onLaterPages=_on_page,
    )


def generate_pdf(story, branding: Optional[Dict[str, Any]] = None, doc_kwargs: Optional[Dict[str, Any]] = None):
    """
    Convenience helper: build a full PDF returning the BytesIO buffer.
    """
    buffer = BytesIO()
    doc, branding_cfg = create_document(buffer, branding=branding, doc_kwargs=doc_kwargs)
    build_pdf(doc, story, branding_cfg)
    buffer.seek(0)
    return buffer


def generate_layout_preview_pdf(branding: Optional[Dict[str, Any]] = None):
    """
    Generate a placeholder PDF that showcases the global layout without business data.
    """
    styles = getSampleStyleSheet()
    intro_style = ParagraphStyle(
        "Intro",
        parent=styles["BodyText"],
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#37474F"),
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#1B5E20"),
        spaceAfter=6,
    )
    placeholder_style = ParagraphStyle(
        "Placeholder",
        parent=styles["BodyText"],
        backColor=colors.HexColor("#F1F8E9"),
        borderPadding=8,
        leading=18,
    )

    story = [
        Spacer(1, 8 * mm),
        Paragraph("Anteprima Layout Report", styles["Heading1"]),
        Paragraph(
            "Questo documento mostra l'aspetto dell'intestazione e del piè di pagina RegiFarm. "
            "Le informazioni sull'azienda e sul gestionale vengono compilate automaticamente in base ai dati presenti nel profilo.",
            intro_style,
        ),
        Spacer(1, 6 * mm),
        Paragraph("Sezione Contenuti Principali", section_title),
        Paragraph(
            "Qui verranno posizionate le tabelle o i paragrafi specifici del report. "
            "Il layout mantiene margini bilanciati per lasciare spazio all'intestazione e al piè di pagina.",
            intro_style,
        ),
        Spacer(1, 8 * mm),
    ]

    table_data = [
        ["Colonna 1", "Colonna 2", "Colonna 3", "Colonna 4"],
        ["Dato di esempio", "Valore 1", "Valore 2", "Valore 3"],
        ["Altro dato", "Valore 4", "Valore 5", "Valore 6"],
    ]
    table = Table(
        table_data,
        colWidths=[50 * mm, 35 * mm, 35 * mm, 35 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2E7D32")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAFAFA")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BDBDBD")),
            ]
        )
    )
    story.extend([table, Spacer(1, 10 * mm)])

    story.append(
        Paragraph(
            "Placeholder per paragrafi aggiuntivi o note importanti del report.",
            placeholder_style,
        )
    )

    return generate_pdf(story, branding=branding)

