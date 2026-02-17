"""
PDF Generator utilities using ReportLab
"""
from datetime import datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageBreak,
    KeepTogether,
    Flowable,
)

from app.utils.pdf_layout import create_document, build_pdf, branding_from_azienda


def generate_piano_uscita_pdf(animali_data, branding=None):
    """
    Genera PDF per piano uscita
    
    Args:
        animali_data: Lista di dizionari con informazioni animali e loro box/sede/azienda
                     Ogni elemento deve avere: auricolare, box_id, box_nome, box_codice,
                     stabilimento_nome, sede_nome, azienda_nome
    
    Returns:
        BytesIO object con il PDF
    """
    buffer = BytesIO()
    doc, branding_config = create_document(
        buffer,
        branding=branding,
        doc_kwargs={
            "pagesize": A4,
        },
    )
    branding_config.setdefault("report_title", "Piano uscita animali")
    branding_config.setdefault("report_subtitle", "Riepilogo box, stabilimenti e capi")
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.black,
        spaceAfter=12,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8,
        spaceBefore=12
    )
    
    # Contenuto
    story = []
    
    # Titolo
    story.append(Paragraph("PIANO USCITA ANIMALI", title_style))
    story.append(Paragraph(f"Data generazione: {datetime.now().strftime('%d/%m/%Y %H:%M')}", 
                          styles['Normal']))
    story.append(Spacer(1, 12*mm))
    
    # ========== PRIMA PAGINA: RIEPILOGO ==========
    
    # Raggruppa per box
    box_dict = {}
    for animale in animali_data:
        box_key = (animale.get('box_id'), animale.get('box_nome', 'N/A'), 
                  animale.get('box_codice', ''), animale.get('stabilimento_nome', 'N/A'),
                  animale.get('sede_nome', 'N/A'), animale.get('azienda_nome', 'N/A'))
        if box_key not in box_dict:
            box_dict[box_key] = []
        box_dict[box_key].append(animale.get('auricolare', 'N/A'))
    
    # Statistiche
    totale_animali = len(animali_data)
    sedi_coinvolte = set(a.get('sede_nome', 'N/A') for a in animali_data if a.get('sede_nome'))
    box_totali = len(box_dict)
    
    # Tabella riepilogo
    summary_data = [
        ['TOTALE ANIMALI', str(totale_animali)],
        ['SEDI COINVOLTE', ', '.join(sorted(sedi_coinvolte)) if sedi_coinvolte else 'N/A'],
        ['BOX TOTALI', str(box_totali)]
    ]
    
    summary_table = Table(summary_data, colWidths=[120*mm, 70*mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#4a4a4a')),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#e5e5e5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    story.append(Paragraph("RIEPILOGO", heading_style))
    story.append(summary_table)
    story.append(Spacer(1, 8*mm))
    
    # Dettaglio per box
    story.append(Paragraph("DETTAGLIO PER BOX", heading_style))
    
    # Tabella box
    box_data = [['Sede', 'Stabilimento', 'Box', 'Codice Box', 'Num. Capi']]
    
    for box_key, auricolari in sorted(box_dict.items(), key=lambda x: (x[0][4], x[0][3], x[0][1])):
        box_id, box_nome, box_codice, stab_nome, sede_nome, azienda_nome = box_key
        num_capi_box = len(auricolari)
        box_data.append([
            sede_nome,
            stab_nome,
            box_nome,
            box_codice,
            str(num_capi_box)
        ])
    
    box_table = Table(box_data, colWidths=[50*mm, 50*mm, 35*mm, 30*mm, 25*mm])
    box_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a4a4a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#666666')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f0f0')])
    ]))
    
    story.append(box_table)
    
    story.append(PageBreak())
    
    # ========== PAGINE SUCCESSIVE: DETTAGLIO PER STABILIMENTO ==========
    
    # Raggruppa box per stabilimento
    stabilimento_dict = {}
    for box_key, auricolari in box_dict.items():
        box_id, box_nome, box_codice, stab_nome, sede_nome, azienda_nome = box_key
        stab_key = (sede_nome, stab_nome, azienda_nome)
        
        if stab_key not in stabilimento_dict:
            stabilimento_dict[stab_key] = []
        
        stabilimento_dict[stab_key].append({
            'box_id': box_id,
            'box_nome': box_nome,
            'box_codice': box_codice,
            'auricolari': sorted(auricolari),
            'num_capi': len(auricolari)
        })
    
    # Stile compatto per auricolari
    compact_text_style = ParagraphStyle(
        'CompactText',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Courier-Bold',
        leading=14,
        textColor=colors.black
    )
    
    # Stili per auricolari
    auricolare_cell_style = ParagraphStyle(
        'AuricolareCell',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Courier',
        leading=10,
        alignment=TA_CENTER
    )
    
    # Funzione per formattare auricolare con ultime 4 cifre evidenziate
    def format_auricolare(auricolare):
        if len(auricolare) >= 4:
            parte_iniziale = auricolare[:-4]
            ultime_4 = auricolare[-4:]
        else:
            parte_iniziale = ''
            ultime_4 = auricolare
        return f'<font name="Courier" size="7" color="#666666">{parte_iniziale}</font><font name="Courier-Bold" size="10" color="#000000">{ultime_4}</font>'
    
    # Funzione helper per preparare dati box
    def prepare_box_data(box_info, cols_auricolari):
        """Prepara i dati per un box (header + auricolari organizzati in righe)"""
        box_nome = box_info['box_nome']
        box_codice = box_info['box_codice']
        auricolari = sorted(box_info['auricolari'])
        num_capi = box_info['num_capi']
        
        # Header box style
        header_style = ParagraphStyle(
            'BoxTableHeader',
            parent=styles['Normal'],
            fontSize=9,
            fontName='Helvetica-Bold',
            textColor=colors.white,
            alignment=TA_LEFT
        )
        
        # Crea righe di auricolari
        auricolari_rows = []
        row = []
        for i, auricolare in enumerate(auricolari):
            row.append(Paragraph(format_auricolare(auricolare), auricolare_cell_style))
            if len(row) == cols_auricolari or i == len(auricolari) - 1:
                # Completa la riga se necessario
                while len(row) < cols_auricolari:
                    row.append('')
                auricolari_rows.append(row)
                row = []
        
        # Se non ci sono auricolari
        if not auricolari_rows:
            auricolari_rows = [[''] * cols_auricolari]
        
        # Crea header con numero capi più evidente
        header_content = f"<b>{box_nome}</b> ({box_codice}) - <b>{num_capi}</b> capi"
        header_text = Paragraph(header_content, header_style)
        
        return {
            'header_text': header_text,
            'auricolari_rows': auricolari_rows,
            'num_rows': len(auricolari_rows),
            'num_capi': num_capi  # Mantieni anche per riferimento
        }
    
    # Genera pagina per ogni stabilimento
    page_width = doc.width  # Larghezza utile (pagina - margini)
    
    for idx, (stab_key, boxes_list) in enumerate(sorted(stabilimento_dict.items(), key=lambda x: (x[0][0], x[0][1])), 1):
        sede_nome, stab_nome, azienda_nome = stab_key
        
        # Intestazione stabilimento
        story.append(Paragraph(
            f"STABILIMENTO: {stab_nome}",
            heading_style
        ))
        story.append(Paragraph(
            f"Sede: {sede_nome}",
            styles['Normal']
        ))
        story.append(Spacer(1, 6*mm))
        
        # Ordinamento box per nome
        boxes_sorted = sorted(boxes_list, key=lambda x: x['box_nome'])
        
        # Layout dinamico: 2 box affiancati quando possibile
        boxes_per_row = 2
        num_righe = (len(boxes_sorted) + boxes_per_row - 1) // boxes_per_row
        
        # Calcola larghezza per ogni box (considerando spazio tra i box)
        spacing = 3*mm  # Spazio tra box affiancati
        box_width = (page_width - spacing) / boxes_per_row
        
        # Per ogni riga di box
        for row_idx in range(num_righe):
            riga_box = boxes_sorted[row_idx * boxes_per_row:(row_idx + 1) * boxes_per_row]
            
            # Prepara dati per ogni box della riga
            boxes_data = []
            max_rows = 0  # Numero massimo di righe tra tutti i box della riga
            
            for box_info in riga_box:
                num_capi = box_info['num_capi']
                # Calcola colonne ottimali per questo box
                if num_capi <= 12:
                    cols_auricolari = 3
                elif num_capi <= 24:
                    cols_auricolari = 4
                elif num_capi <= 40:
                    cols_auricolari = 5
                else:
                    cols_auricolari = 6
                
                box_data = prepare_box_data(box_info, cols_auricolari)
                boxes_data.append({
                    'data': box_data,
                    'cols': cols_auricolari
                })
                max_rows = max(max_rows, box_data['num_rows'])
            
            # Se c'è un solo box, usa larghezza completa
            if len(riga_box) == 1:
                box_data = boxes_data[0]['data']
                cols = boxes_data[0]['cols']
                
                # Crea tabella singola
                table_data = []
                # Header
                header_row = [box_data['header_text']]
                header_row.extend([''] * (cols - 1))
                table_data.append(header_row)
                # Auricolari
                table_data.extend(box_data['auricolari_rows'])
                
                col_widths = [box_width / cols] * cols
                row_table = Table(table_data, colWidths=col_widths)
                
                row_table.setStyle(TableStyle([
                    # Header
                    ('SPAN', (0, 0), (-1, 0)),
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a4a4a')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
                    ('TOPPADDING', (0, 0), (-1, 0), 5),
                    ('LEFTPADDING', (0, 0), (-1, 0), 6),
                    ('RIGHTPADDING', (0, 0), (-1, 0), 6),
                    # Auricolari
                    ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
                    ('TOPPADDING', (0, 1), (-1, -1), 3),
                    ('LEFTPADDING', (0, 1), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 1), (-1, -1), 3),
                    # Bordi
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#666666')),
                    ('INNERGRID', (0, 1), (-1, -1), 0.5, colors.HexColor('#cccccc')),
                    ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#333333')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                ]))
                
                story.append(row_table)
            else:
                # Due box affiancati - crea tabella combinata
                box1_data = boxes_data[0]['data']
                box1_cols = boxes_data[0]['cols']
                box2_data = boxes_data[1]['data']
                box2_cols = boxes_data[1]['cols']
                
                # Calcola numero totale di righe necessario
                total_rows = max(box1_data['num_rows'], box2_data['num_rows']) + 1  # +1 per header
                
                # Crea tabella combinata
                combined_data = []
                
                # Riga header combinata
                # Box 1: header + colonne per span, poi separatore, poi Box 2: header + colonne per span
                header_row = [box1_data['header_text']]  # Inizio header box1
                header_row.extend([''] * (box1_cols - 1))  # Celle per span (totale box1_cols)
                header_row.append('')  # Separatore tra box
                header_row.append(box2_data['header_text'])  # Inizio header box2
                header_row.extend([''] * (box2_cols - 1))  # Celle per span (totale box2_cols)
                combined_data.append(header_row)
                
                # Righe auricolari allineate
                for row_idx in range(total_rows - 1):
                    combined_row = []
                    
                    # Box 1
                    if row_idx < len(box1_data['auricolari_rows']):
                        combined_row.extend(box1_data['auricolari_rows'][row_idx])
                    else:
                        combined_row.extend([''] * box1_cols)
                    
                    combined_row.append('')  # Spazio tra box
                    
                    # Box 2
                    if row_idx < len(box2_data['auricolari_rows']):
                        combined_row.extend(box2_data['auricolari_rows'][row_idx])
                    else:
                        combined_row.extend([''] * box2_cols)
                    
                    combined_data.append(combined_row)
                
                # Calcola larghezze colonne
                # Usa box_width diretto per ogni box (già calcolato con spacing)
                box1_col_width = box_width / box1_cols
                box2_col_width = box_width / box2_cols
                spacing_width = spacing
                
                col_widths = [box1_col_width] * box1_cols + [spacing_width] + [box2_col_width] * box2_cols
                
                combined_table = Table(combined_data, colWidths=col_widths)
                combined_table.setStyle(TableStyle([
                    # Header box 1
                    ('SPAN', (0, 0), (box1_cols - 1, 0)),
                    ('BACKGROUND', (0, 0), (box1_cols - 1, 0), colors.HexColor('#4a4a4a')),
                    ('TEXTCOLOR', (0, 0), (box1_cols - 1, 0), colors.white),
                    # Header box 2
                    ('SPAN', (box1_cols + 1, 0), (box1_cols + box2_cols, 0)),
                    ('BACKGROUND', (box1_cols + 1, 0), (box1_cols + box2_cols, 0), colors.HexColor('#4a4a4a')),
                    ('TEXTCOLOR', (box1_cols + 1, 0), (box1_cols + box2_cols, 0), colors.white),
                    # Allineamenti header
                    ('ALIGN', (0, 0), (box1_cols - 1, 0), 'LEFT'),
                    ('ALIGN', (box1_cols + 1, 0), (box1_cols + box2_cols, 0), 'LEFT'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
                    ('TOPPADDING', (0, 0), (-1, 0), 5),
                    ('LEFTPADDING', (0, 0), (-1, 0), 6),
                    ('RIGHTPADDING', (0, 0), (-1, 0), 6),
                    # Auricolari
                    ('ALIGN', (0, 1), (box1_cols - 1, -1), 'CENTER'),
                    ('ALIGN', (box1_cols + 1, 1), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
                    ('TOPPADDING', (0, 1), (-1, -1), 3),
                    ('LEFTPADDING', (0, 1), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 1), (-1, -1), 3),
                    # Bordi
                    ('BOX', (0, 0), (box1_cols - 1, -1), 1, colors.HexColor('#666666')),
                    ('BOX', (box1_cols + 1, 0), (-1, -1), 1, colors.HexColor('#666666')),
                    ('INNERGRID', (0, 1), (box1_cols - 1, -1), 0.5, colors.HexColor('#cccccc')),
                    ('INNERGRID', (box1_cols + 1, 1), (-1, -1), 0.5, colors.HexColor('#cccccc')),
                    ('LINEBELOW', (0, 0), (box1_cols - 1, 0), 2, colors.HexColor('#333333')),
                    ('LINEBELOW', (box1_cols + 1, 0), (-1, 0), 2, colors.HexColor('#333333')),
                    # Background alternato
                    ('ROWBACKGROUNDS', (0, 1), (box1_cols - 1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                    ('ROWBACKGROUNDS', (box1_cols + 1, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                ]))
                
                story.append(combined_table)
            
            story.append(Spacer(1, 4*mm))
        
        # Aggiungi interruzione pagina se non è l'ultimo stabilimento
        if idx < len(stabilimento_dict):
            story.append(PageBreak())
    
    # Genera PDF
    build_pdf(doc, story, branding_config)
    buffer.seek(0)
    return buffer


def generate_report_allevamento_pdf(report_data: dict, branding=None):
    """
    Genera PDF per report allevamento con conteggi vendita animali
    
    Args:
        report_data: Dizionario con i dati del report calcolati da calculate_report_allevamento_data
        branding: Configurazione branding (logo, dati aziendali, etc.)
    
    Returns:
        BytesIO object con il PDF
    """
    buffer = BytesIO()
    doc, branding_config = create_document(
        buffer,
        branding=branding,
        doc_kwargs={
            "pagesize": A4,
        },
    )
    periodo_label = report_data.get('periodo_label') or report_data.get('data_uscita', 'N/A')
    branding_config.setdefault("report_title", "Report Allevamento")
    branding_config.setdefault("report_subtitle", f"Conteggi vendita animali - {periodo_label}")
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.black,
        spaceAfter=12,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8,
        spaceBefore=12
    )
    
    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#555555'),
        spaceAfter=6,
        spaceBefore=8
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.black,
        spaceAfter=4
    )
    
    # Contenuto
    story = []
    
    # Titolo
    story.append(Paragraph("REPORT ALLEVAMENTO", title_style))
    story.append(Paragraph(f"Periodo uscita: {periodo_label}", styles['Normal']))
    story.append(Spacer(1, 12*mm))
    
    # ========== PRIMA PAGINA: RIEPILOGO ==========
    
    # Verifica se ci sono animali di proprietà o soccida
    riepilogo_proprieta = report_data.get('riepilogo_proprieta', {})
    riepilogo_soccida = report_data.get('riepilogo_soccida', {})
    has_proprieta = riepilogo_proprieta.get('numero_capi', 0) > 0
    has_soccida = riepilogo_soccida.get('numero_capi', 0) > 0
    
    # Verifica tipo gestione acconti
    gestione_acconti = report_data.get('gestione_acconti', {})
    ha_acconti = report_data.get('ha_acconti', False)
    tipo_gestione = gestione_acconti.get('tipo', 'nessuno')
    is_automatico = tipo_gestione == 'automatico'
    
    # Stile uniforme per le tabelle della prima pagina
    # Colori allineati: verde per proprietà, arancione per soccida, verde footer per acconti
    table_header_color_proprieta = colors.HexColor('#5cb85c')  # Verde
    table_header_color_soccida = colors.HexColor('#4a4a4a')  # Grigio scuro
    table_header_color_acconti = colors.HexColor('#1B5E20')  # Verde footer
    table_bg_color = colors.HexColor('#f0f0f0')
    table_text_color = colors.white
    table_font_size = 10
    table_font_name_bold = 'Helvetica-Bold'
    table_font_name = 'Helvetica'
    table_col_width = [100*mm, 90*mm]
    table_padding = 6
    table_grid_color = colors.HexColor('#cccccc')
    
    # Mostra solo la sezione rilevante (proprietà o soccida, non entrambe)
    # Se ci sono animali di proprietà, mostra solo quella sezione
    if has_proprieta:
        story.append(Paragraph("ANIMALI DI PROPRIETÀ", heading_style))
        
        proprieta_data = [
            ['Numero Capi', str(riepilogo_proprieta.get('numero_capi', 0))],
            ['Peso Arrivo', f"{riepilogo_proprieta.get('peso_arrivo', 0):.2f} kg"],
            ['Valore Acquisto', f"€ {riepilogo_proprieta.get('valore_acquisto', 0):.2f}"],
            ['Peso Uscita', f"{riepilogo_proprieta.get('peso_uscita', 0):.2f} kg"],
            ['Valore Vendita', f"€ {riepilogo_proprieta.get('valore_vendita', 0):.2f}"],
            ['Differenza Peso', f"{riepilogo_proprieta.get('differenza_peso', 0):.2f} kg"],
        ]
        
        # Aggiungi decessi a carico se presenti
        decessi = report_data.get('decessi', {})
        valore_decessi_a_carico = decessi.get('valore_totale_a_carico', 0)
        pagamenti_ricevuti = decessi.get('pagamenti_ricevuti', 0)
        if valore_decessi_a_carico > 0 or pagamenti_ricevuti > 0:
            if valore_decessi_a_carico > 0:
                proprieta_data.append(['Decessi a carico', f"-€ {valore_decessi_a_carico:.2f}"])
            if pagamenti_ricevuti > 0:
                proprieta_data.append(['Pagamenti ricevuti', f"-€ {pagamenti_ricevuti:.2f}"])
        
        proprieta_data.append(['Differenza Valore', f"€ {riepilogo_proprieta.get('differenza_valore', 0):.2f}"])
        
        proprieta_table = Table(proprieta_data, colWidths=table_col_width)
        proprieta_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), table_header_color_proprieta),
            ('TEXTCOLOR', (0, 0), (0, -1), table_text_color),
            ('BACKGROUND', (1, 0), (1, -1), table_bg_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), table_font_name_bold),
            ('FONTNAME', (1, 0), (1, -1), table_font_name),
            ('FONTSIZE', (0, 0), (-1, -1), table_font_size),
            ('BOTTOMPADDING', (0, 0), (-1, -1), table_padding),
            ('TOPPADDING', (0, 0), (-1, -1), table_padding),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, table_grid_color),
        ]))
        
        story.append(proprieta_table)
        story.append(Spacer(1, 8*mm))
    
    # Riepilogo animali in soccida (solo se non ci sono animali di proprietà)
    elif has_soccida:
        story.append(Paragraph("ANIMALI IN SOCCIDA", heading_style))
        
        # Verifica se ci sono percentuali applicate in qualche contratto
        dettaglio_contratti = riepilogo_soccida.get('dettaglio_contratti', [])
        has_percentuali = any(
            c.get('percentuale_aggiunta_arrivo') or c.get('percentuale_sottrazione_uscita')
            for c in dettaglio_contratti
        )
        
        if has_percentuali:
            story.append(Paragraph(
                "<i>Nota: I pesi mostrati sono già stati modificati dalle percentuali di aggiunta/sottrazione definite nei contratti.</i>",
                styles['Normal']
            ))
            story.append(Spacer(1, 4*mm))
        
        # Riepilogo soccida - mostra solo info generali (dettagli nel contratto)
        soccida_data = [
            ['Numero Capi', str(riepilogo_soccida.get('numero_capi', 0))],
        ]
        
        # Aggiungi valore totale se presente (calcolato in base alla modalità di remunerazione)
        valore_totale_soccida = riepilogo_soccida.get('valore_totale', 0)
        if valore_totale_soccida > 0:
            soccida_data.append(['Valore Totale', f"€ {valore_totale_soccida:.2f}"])
        
        soccida_table = Table(soccida_data, colWidths=table_col_width)
        soccida_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), table_header_color_soccida),
            ('TEXTCOLOR', (0, 0), (0, -1), table_text_color),
            ('BACKGROUND', (1, 0), (1, -1), table_bg_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), table_font_name_bold),
            ('FONTNAME', (1, 0), (1, -1), table_font_name),
            ('FONTSIZE', (0, 0), (-1, -1), table_font_size),
            ('BOTTOMPADDING', (0, 0), (-1, -1), table_padding),
            ('TOPPADDING', (0, 0), (-1, -1), table_padding),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, table_grid_color),
        ]))
        
        story.append(soccida_table)
        story.append(Spacer(1, 8*mm))
        
    # ========== TABELLA ACCONTI (in linea con le altre, per tutte le gestioni) ==========
    if ha_acconti and gestione_acconti.get('importo_totale', 0) > 0:
        # Calcola il valore netto al netto dell'IVA
        valore_totale = 0
        if has_soccida:
            valore_totale = riepilogo_soccida.get('valore_totale', 0)
        elif has_proprieta:
            valore_totale = riepilogo_proprieta.get('valore_vendita', 0)
        
        importo_acconti = gestione_acconti.get('importo_totale', 0)
        netto_iva = valore_totale - importo_acconti
        
        # Prepara le informazioni in base al tipo di gestione
        tipo_label = {
            'automatico': 'Automatico',
            'manuale': 'Manuale',
            'movimenti_interi': 'Movimenti Prima Nota',
            'fatture_soccida': 'Fatture Soccida',
        }.get(tipo_gestione, tipo_gestione.capitalize())
        
        acconti_data = [
            ['Acconto Ricevuto', f"€ {importo_acconti:.2f}"],
            ['Totale - Acconto = Netto al netto IVA', f"€ {valore_totale:.2f} - € {importo_acconti:.2f} = € {netto_iva:.2f}"],
        ]
        
        # Aggiungi dettaglio in base al tipo (opzionale, per informazioni aggiuntive)
        dettaglio = gestione_acconti.get('dettaglio')
        if dettaglio:
            if tipo_gestione == 'manuale' and dettaglio.get('acconto_manuale'):
                acconti_data.insert(2, ['Acconto Manuale Inserito', f"€ {dettaglio.get('acconto_manuale', 0):.2f}"])
            elif tipo_gestione == 'movimenti_interi' and dettaglio.get('movimenti_selezionati'):
                movimenti_count = len(dettaglio.get('movimenti_selezionati', []))
                acconti_data.insert(2, ['Movimenti PN Selezionati', f"{movimenti_count} movimento/i"])
            elif tipo_gestione == 'fatture_soccida' and dettaglio.get('fatture_selezionate'):
                fatture_count = len(dettaglio.get('fatture_selezionate', []))
                acconti_data.insert(2, ['Fatture Selezionate', f"{fatture_count} fattura/e"])
        
        acconti_table = Table(acconti_data, colWidths=table_col_width)
        acconti_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), table_header_color_acconti),
            ('TEXTCOLOR', (0, 0), (0, -1), table_text_color),
            ('BACKGROUND', (1, 0), (1, -1), table_bg_color),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), table_font_name_bold),
            ('FONTNAME', (1, 0), (1, -1), table_font_name),
            ('FONTSIZE', (0, 0), (-1, -1), table_font_size),
            ('BOTTOMPADDING', (0, 0), (-1, -1), table_padding),
            ('TOPPADDING', (0, 0), (-1, -1), table_padding),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, table_grid_color),
        ]))
        
        story.append(acconti_table)
        story.append(Spacer(1, 8*mm))
    
    # Dettaglio per contratto (solo se soccida)
    if has_soccida:
        dettaglio_contratti = riepilogo_soccida.get('dettaglio_contratti', [])
        for contratto in dettaglio_contratti:
            story.append(Paragraph(
                f"CONTRATTO: {contratto.get('numero_contratto', 'N/A')} - {contratto.get('soccidante', 'N/A')}",
                heading_style
            ))
            
            modalita = contratto.get('modalita_remunerazione', 'N/A')
            contratto_data = [
                ['Numero Capi', str(contratto.get('numero_capi', 0))],
            ]
            
            # Aggiungi parametri specifici per modalità
            if modalita == 'prezzo_kg' and contratto.get('prezzo_per_kg'):
                contratto_data.append(['Prezzo per kg', f"€ {contratto.get('prezzo_per_kg', 0):.2f}"])
            elif modalita == 'quota_giornaliera' and contratto.get('quota_giornaliera'):
                contratto_data.append(['Quota giornaliera per capo', f"€ {contratto.get('quota_giornaliera', 0):.2f}"])
                contratto_data.append(['Giorni di gestione', str(contratto.get('giorni_gestione', 0))])
            elif modalita == 'percentuale' and contratto.get('percentuale_remunerazione'):
                contratto_data.append(['Percentuale remunerazione', f"{contratto.get('percentuale_remunerazione', 0):.2f}%"])
            elif modalita == 'ripartizione_utili':
                if contratto.get('percentuale_soccidante'):
                    contratto_data.append(['Percentuale soccidante', f"{contratto.get('percentuale_soccidante', 0):.2f}%"])
                if contratto.get('percentuale_riparto_base'):
                    contratto_data.append(['Percentuale riparto base soccidario', f"{contratto.get('percentuale_riparto_base', 0):.2f}%"])
            
            # Mostra pesi con calcoli sulla stessa riga se presenti percentuali
            percent_aggiunta = contratto.get('percentuale_aggiunta_arrivo')
            percent_sottrazione = contratto.get('percentuale_sottrazione_uscita')
            peso_arrivo_originale = contratto.get('peso_arrivo_originale_totale', 0)
            peso_uscita_originale = contratto.get('peso_uscita_originale_totale', 0)
            peso_arrivo_post = contratto.get('peso_arrivo_totale', 0)
            peso_uscita_post = contratto.get('peso_uscita_totale', 0)
            differenza_peso = contratto.get('differenza_peso_totale', 0)
            
            if percent_aggiunta and peso_arrivo_originale > 0:
                contratto_data.append([
                    'Peso Arrivo', 
                    f"{peso_arrivo_originale:.2f} kg + {percent_aggiunta:.2f}% = {peso_arrivo_post:.2f} kg"
                ])
            else:
                contratto_data.append(['Peso Arrivo', f"{peso_arrivo_post:.2f} kg"])
            
            if percent_sottrazione and peso_uscita_originale > 0:
                contratto_data.append([
                    'Peso Uscita', 
                    f"{peso_uscita_originale:.2f} kg - {percent_sottrazione:.2f}% = {peso_uscita_post:.2f} kg"
                ])
            else:
                contratto_data.append(['Peso Uscita', f"{peso_uscita_post:.2f} kg"])
            
            # Mostra differenza con calcolo esplicito (peso_uscita - peso_arrivo = differenza)
            if (percent_aggiunta or percent_sottrazione) and peso_arrivo_originale > 0 and peso_uscita_originale > 0:
                # Mostra il calcolo: peso_uscita_post - peso_arrivo_post = differenza
                calc_str = f"{peso_uscita_post:.2f} kg - {peso_arrivo_post:.2f} kg = {differenza_peso:.2f} kg"
                contratto_data.append(['Differenza Peso', calc_str])
            else:
                contratto_data.append(['Differenza Peso', f"{differenza_peso:.2f} kg"])
            
            # Valore totale rimosso dal dettaglio contratto (presente solo nel riepilogo)
            
            contratto_table = Table(contratto_data, colWidths=table_col_width)
            contratto_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), table_header_color_soccida),
                ('TEXTCOLOR', (0, 0), (0, -1), table_text_color),
                ('BACKGROUND', (1, 0), (1, -1), table_bg_color),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), table_font_name_bold),
                ('FONTNAME', (1, 0), (1, -1), table_font_name),
                ('FONTSIZE', (0, 0), (-1, -1), table_font_size),
                ('BOTTOMPADDING', (0, 0), (-1, -1), table_padding),
                ('TOPPADDING', (0, 0), (-1, -1), table_padding),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, table_grid_color),
            ]))
            
            story.append(contratto_table)
            story.append(Spacer(1, 8*mm))
            
            # Sezione Acconti Ricevuti (Soccida Monetizzata) - NON mostrare se ci sono acconti configurati, se è impostato "nessun acconto" o se non ci sono acconti
            if contratto.get('acconti_ricevuti') and not ha_acconti and tipo_gestione != 'nessuno':
                acconti = contratto['acconti_ricevuti']
                totale_acconti = acconti.get('totale_acconti', 0)
                acconti_per_partita = acconti.get('acconti_per_partita', {})
                
                # Verifica se ci sono effettivamente acconti da mostrare
                has_acconti_data = totale_acconti > 0 or any(
                    partita_data.get('movimenti', []) 
                    for partita_data in acconti_per_partita.values()
                )
                
                if has_acconti_data:
                    story.append(Paragraph("Acconti Ricevuti", subheading_style))
                    story.append(Spacer(1, 4*mm))
                    
                    acconti_data = [['Data', 'Importo', 'Partita', 'Acconto per Capo']]
                    
                    for partita_id, partita_data in acconti_per_partita.items():
                        for movimento in partita_data.get('movimenti', []):
                            acconto_per_capo = acconti.get('acconto_per_capo_per_partita', {}).get(partita_id, 0)
                            acconti_data.append([
                                movimento.get('data', 'N/A')[:10] if movimento.get('data') else 'N/A',
                                f"€ {movimento.get('importo', 0):.2f}",
                                f"Partita #{partita_id}",
                                f"€ {acconto_per_capo:.2f}" if acconto_per_capo > 0 else 'N/A',
                            ])
                    
                    if len(acconti_data) > 1:
                        acconti_table = Table(acconti_data, colWidths=[40*mm, 40*mm, 50*mm, 40*mm])
                        acconti_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
                            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                            ('FONTSIZE', (0, 0), (-1, 0), 9),
                            ('FONTSIZE', (0, 1), (-1, -1), 8),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                            ('TOPPADDING', (0, 0), (-1, -1), 4),
                            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
                        ]))
                        story.append(acconti_table)
                        
                        # Totale e saldo
                        totale_acconti = acconti.get('totale_acconti', 0)
                        saldo_finale = acconti.get('saldo_finale', 0)
                        valore_totale = contratto.get('valore_totale', 0)
                        
                        story.append(Spacer(1, 4*mm))
                        saldo_data = [
                            ['Totale Acconti Ricevuti', f"€ {totale_acconti:.2f}"],
                            ['Compenso Calcolato', f"€ {valore_totale:.2f}"],
                            ['Saldo Finale', f"€ {saldo_finale:.2f}"],
                        ]
                        saldo_table = Table(saldo_data, colWidths=[90*mm, 100*mm])
                        saldo_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0e0e0')),
                            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                            ('FONTSIZE', (0, 0), (-1, -1), 9),
                            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
                        ]))
                        story.append(saldo_table)
                        story.append(Spacer(1, 6*mm))
            
            # Sezione Fatture Emesse (Soccida con Fattura)
            if contratto.get('fatture_emesse'):
                fatture = contratto['fatture_emesse']
                story.append(Paragraph("Fatture Emesse", subheading_style))
                story.append(Spacer(1, 4*mm))
                
                fatture_data = [['Tipo', 'Numero', 'Data', 'Importo']]
                
                # Fatture acconto
                for fattura in fatture.get('fatture_acconto', []):
                    fatture_data.append([
                        'Acconto',
                        fattura.get('numero', 'N/A'),
                        fattura.get('data', 'N/A')[:10] if fattura.get('data') else 'N/A',
                        f"€ {fattura.get('importo', 0):.2f}",
                    ])
                
                # Fattura saldo
                if fatture.get('fattura_saldo'):
                    fattura_saldo = fatture['fattura_saldo']
                    fatture_data.append([
                        'Saldo',
                        fattura_saldo.get('numero', 'N/A'),
                        fattura_saldo.get('data', 'N/A')[:10] if fattura_saldo.get('data') else 'N/A',
                        f"€ {fattura_saldo.get('importo', 0):.2f}",
                    ])
                
                if len(fatture_data) > 1:
                    fatture_table = Table(fatture_data, colWidths=[40*mm, 50*mm, 40*mm, 50*mm])
                    fatture_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a90e2')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 9),
                        ('FONTSIZE', (0, 1), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
                    ]))
                    story.append(fatture_table)
                    
                    # Totale e verifica coerenza
                    totale_fatture = fatture.get('totale_fatture', 0)
                    verifica_coerenza = fatture.get('verifica_coerenza', False)
                    valore_totale = contratto.get('valore_totale', 0)
                    
                    story.append(Spacer(1, 4*mm))
                    verifica_data = [
                        ['Totale Fatture', f"€ {totale_fatture:.2f}"],
                        ['Compenso Calcolato', f"€ {valore_totale:.2f}"],
                        ['Verifica Coerenza', '✅ OK' if verifica_coerenza else '⚠️ Discrepanza'],
                    ]
                    verifica_table = Table(verifica_data, colWidths=[90*mm, 100*mm])
                    verifica_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0e0e0')),
                        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                        ('FONTSIZE', (0, 0), (-1, -1), 9),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
                    ]))
                    story.append(verifica_table)
                    story.append(Spacer(1, 6*mm))
            
            # Sezione Ripartizione Utili
            if contratto.get('ripartizione_utili'):
                ripartizione = contratto['ripartizione_utili']
                story.append(Paragraph("Ripartizione Utili", subheading_style))
                story.append(Spacer(1, 4*mm))
                
                ripartizione_data = [
                    ['Kg Accrescimento Totale', f"{ripartizione.get('kg_accrescimento_totale', 0):.2f} kg"],
                    ['Valore Totale', f"€ {ripartizione.get('valore_totale', 0):.2f}"],
                    ['Quota Soccidario', f"{ripartizione.get('quota_soccidario', 0):.2f}%"],
                    ['Scenario', ripartizione.get('scenario', 'N/A')],
                ]
                
                ripartizione_table = Table(ripartizione_data, colWidths=[90*mm, 100*mm])
                ripartizione_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0e0e0')),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
                ]))
                story.append(ripartizione_table)
                
                # Se vendita diretta: mostra fattura e incasso
                if ripartizione.get('scenario') == 'vendita_diretta':
                    story.append(Spacer(1, 4*mm))
                    if ripartizione.get('fattura_emessa'):
                        fattura = ripartizione['fattura_emessa']
                        story.append(Paragraph(
                            f"Fattura Emessa: {fattura.get('numero', 'N/A')} del {fattura.get('data', 'N/A')[:10] if fattura.get('data') else 'N/A'} - € {fattura.get('importo', 0):.2f}",
                            normal_style
                        ))
                    
                    if ripartizione.get('incasso_ricevuto'):
                        incasso = ripartizione['incasso_ricevuto']
                        story.append(Paragraph(
                            f"Incasso Ricevuto: {incasso.get('data', 'N/A')[:10] if incasso.get('data') else 'N/A'} - € {incasso.get('importo', 0):.2f}",
                            normal_style
                        ))
                
                # Se diventano proprietà: mostra nota
                elif ripartizione.get('scenario') == 'diventano_proprieta':
                    story.append(Spacer(1, 4*mm))
                    story.append(Paragraph(
                        "I capi sono diventati di proprietà. Nessun movimento contabile immediato.",
                        normal_style
                    ))
                    
                    if ripartizione.get('capi_diventati_proprieta'):
                        story.append(Spacer(1, 2*mm))
                        for capo in ripartizione['capi_diventati_proprieta']:
                            story.append(Paragraph(
                                f"Partita {capo.get('numero_partita', capo.get('id', 'N/A'))}: {capo.get('numero_capi', 0)} capi",
                                normal_style
                            ))
                
                story.append(Spacer(1, 6*mm))
    
    # ========== SECONDA PAGINA: RIEPILOGO E DETTAGLIO AURICOLARI ==========
    dettaglio_animali = report_data.get('dettaglio_animali', [])
    if dettaglio_animali:
        story.append(PageBreak())
        story.append(Paragraph("RIEPILOGO PER PARTITA DI INGRESSO", heading_style))
        story.append(Spacer(1, 8*mm))
        
        # Raggruppa animali per partita di ingresso originale (usando ID partita come chiave primaria)
        from collections import defaultdict
        partite_dict = defaultdict(lambda: {
            'codice_stalla': None,
            'data_arrivo': None,
            'numero_capi_arrivati': None,
            'animali_usciti': [],
            'peso_arrivo_totale': 0.0,
            'peso_uscita_totale': 0.0,
        })
        
        for animale in dettaglio_animali:
            # Usa ID partita di ingresso originale come chiave primaria, fallback su codice stalla
            partita_id = animale.get('partita_ingresso_originale_id')
            codice_stalla = animale.get('azienda_provenienza_originale', animale.get('azienda_provenienza', 'N/A'))
            data_arrivo_orig = animale.get('data_arrivo_originale', animale.get('data_arrivo', ''))
            
            # Usa partita_id come chiave se disponibile, altrimenti codice_stalla
            chiave = partita_id if partita_id is not None else codice_stalla
            
            if partite_dict[chiave]['codice_stalla'] is None:
                partite_dict[chiave]['codice_stalla'] = codice_stalla
                partite_dict[chiave]['data_arrivo'] = data_arrivo_orig
                # Usa numero_capi_partita_originale se disponibile
                num_capi = animale.get('numero_capi_partita_originale')
                if num_capi is not None:
                    partite_dict[chiave]['numero_capi_arrivati'] = num_capi
            
            # Aggiungi animale alla lista usciti
            auricolare = animale.get('auricolare', 'N/A')
            peso_arrivo = animale.get('peso_arrivo_originale', animale.get('peso_arrivo', 0))
            peso_uscita = animale.get('peso_uscita', 0)
            
            partite_dict[chiave]['animali_usciti'].append(auricolare)
            partite_dict[chiave]['peso_arrivo_totale'] += peso_arrivo
            partite_dict[chiave]['peso_uscita_totale'] += peso_uscita
        
        # Prepara tabella riepilogativa
        riepilogo_data = [['Codice Stalla', 'Data Arrivo', 'Capi Arrivati', 'Capi Usciti', 'Peso Medio Arrivo', 'Peso Medio Uscita']]
        
        for chiave, dati in sorted(partite_dict.items()):
            # Usa numero_capi_arrivati se disponibile, altrimenti usa numero di capi usciti come approssimazione
            num_arrivati = dati['numero_capi_arrivati'] if dati['numero_capi_arrivati'] is not None else len(dati['animali_usciti'])
            num_usciti = len(dati['animali_usciti'])
            
            # Calcola pesi medi
            peso_medio_arrivo = dati['peso_arrivo_totale'] / num_usciti if num_usciti > 0 else 0.0
            peso_medio_uscita = dati['peso_uscita_totale'] / num_usciti if num_usciti > 0 else 0.0
            
            # Formatta data arrivo
            data_arrivo_str = 'N/A'
            if dati['data_arrivo']:
                try:
                    from datetime import datetime, date as date_type
                    if isinstance(dati['data_arrivo'], str) and len(dati['data_arrivo']) == 10:
                        data_arrivo_obj = date_type.fromisoformat(dati['data_arrivo'])
                        data_arrivo_str = data_arrivo_obj.strftime('%d/%m/%Y')
                    else:
                        data_arrivo_str = datetime.fromisoformat(dati['data_arrivo'].replace('Z', '+00:00')).strftime('%d/%m/%Y')
                except Exception:
                    data_arrivo_str = str(dati['data_arrivo'])[:10] if dati['data_arrivo'] else 'N/A'
            
            riepilogo_data.append([
                codice_stalla[:30] if codice_stalla != 'N/A' else 'N/A',  # Limita lunghezza
                data_arrivo_str,
                str(num_arrivati),
                str(num_usciti),
                f"{peso_medio_arrivo:.2f} Kg",
                f"{peso_medio_uscita:.2f} Kg",
            ])
        
        # Crea tabella riepilogativa compatta - usa la stessa larghezza delle tabelle nella prima pagina
        # Le tabelle nella prima pagina usano 190mm totali (100mm + 90mm)
        # 6 colonne uguali: 190/6 = 31.67mm per colonna
        larghezza_totale_tabella = 190*mm  # Stessa larghezza delle tabelle nella prima pagina
        larghezza_colonna = larghezza_totale_tabella / 6
        riepilogo_table = Table(riepilogo_data, colWidths=[larghezza_colonna] * 6)
        riepilogo_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('LEFTPADDING', (0, 1), (-1, -1), 6),
            ('RIGHTPADDING', (0, 1), (-1, -1), 6),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Codice stalla
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),  # Data arrivo
            ('ALIGN', (2, 1), (2, -1), 'CENTER'),  # Capi arrivati
            ('ALIGN', (3, 1), (3, -1), 'CENTER'),  # Capi usciti
            ('ALIGN', (4, 1), (4, -1), 'RIGHT'),  # Peso medio arrivo
            ('ALIGN', (5, 1), (5, -1), 'RIGHT'),  # Peso medio uscita
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        
        story.append(riepilogo_table)
        story.append(Spacer(1, 12*mm))
        
        # Dettaglio auricolari in griglia
        story.append(Paragraph("DETTAGLIO AURICOLARI", heading_style))
        story.append(Spacer(1, 6*mm))
        
        # Raccogli tutti gli auricolari e ordina
        tutti_auricolari = sorted([animale.get('auricolare', 'N/A') for animale in dettaglio_animali])
        
        # Crea griglia di auricolari (6 colonne)
        num_colonne = 6
        auricolari_grid_data = []
        
        for i in range(0, len(tutti_auricolari), num_colonne):
            riga = tutti_auricolari[i:i+num_colonne]
            # Completa la riga con celle vuote se necessario
            while len(riga) < num_colonne:
                riga.append('')
            auricolari_grid_data.append(riga)
        
        # Crea tabella griglia con font monospaziato e piccolo - usa la stessa larghezza delle altre tabelle
        larghezza_totale_tabella = 190*mm  # Stessa larghezza delle tabelle nella prima pagina
        larghezza_colonna_auricolari = larghezza_totale_tabella / num_colonne
        auricolari_table = Table(auricolari_grid_data, colWidths=[larghezza_colonna_auricolari] * num_colonne)
        auricolari_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Courier'),  # Font monospaziato
            ('FONTSIZE', (0, 0), (-1, -1), 9),  # Font piccolo
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#e0e0e0')),
        ]))
        
        story.append(auricolari_table)
    
    # ========== PAGINA FINALE: DECESSI ==========
    decessi = report_data.get('decessi', {})
    decessi_dettaglio = decessi.get('dettaglio', [])
    if decessi_dettaglio:
        story.append(PageBreak())
        story.append(Paragraph("CAPI DECEDUTI", heading_style))
        story.append(Paragraph(
            f"Numero capi deceduti: {decessi.get('numero_capi', 0)}",
            styles['Normal']
        ))
        story.append(Spacer(1, 8*mm))
        
        # Tabella decessi
        decessi_table_data = [['Auricolare', 'Data Arrivo', 'Provenienza', 'Peso Arrivo', 'Data Decesso', 'Giorni', 'Valore', 'A Carico']]
        
        for decesso in decessi_dettaglio:
            data_arrivo = decesso.get('data_arrivo', '')
            if data_arrivo:
                try:
                    from datetime import datetime, date as date_type
                    if isinstance(data_arrivo, str) and len(data_arrivo) == 10:
                        data_arrivo_obj = date_type.fromisoformat(data_arrivo)
                        data_arrivo = data_arrivo_obj.strftime('%d/%m/%Y')
                    else:
                        data_arrivo = datetime.fromisoformat(data_arrivo.replace('Z', '+00:00')).strftime('%d/%m/%Y')
                except Exception:
                    data_arrivo = str(data_arrivo)[:10] if data_arrivo else 'N/A'
            
            data_decesso = decesso.get('data_decesso', '')
            if data_decesso:
                try:
                    from datetime import datetime, date as date_type
                    if isinstance(data_decesso, str) and len(data_decesso) == 10:
                        data_decesso_obj = date_type.fromisoformat(data_decesso)
                        data_decesso = data_decesso_obj.strftime('%d/%m/%Y')
                    else:
                        data_decesso = datetime.fromisoformat(data_decesso.replace('Z', '+00:00')).strftime('%d/%m/%Y')
                except Exception:
                    data_decesso = str(data_decesso)[:10] if data_decesso else 'N/A'
            
            a_carico = 'Sì' if decesso.get('a_carico', False) else 'No'
            
            decessi_table_data.append([
                decesso.get('auricolare', 'N/A'),
                data_arrivo or 'N/A',
                (decesso.get('azienda_provenienza', 'N/A') or 'N/A')[:20],
                f"{decesso.get('peso_arrivo', 0):.2f}",
                data_decesso or 'N/A',
                str(decesso.get('giorni_da_arrivo', 0)),
                f"€ {decesso.get('valore_capo', 0):.2f}",
                a_carico,
            ])
        
        # Aggiungi totale se ci sono decessi a carico
        valore_totale_a_carico = decessi.get('valore_totale_a_carico', 0)
        if valore_totale_a_carico > 0:
            decessi_table_data.append([
                '', '', '', '', '', '',
                f"<b>Totale a carico: -€ {valore_totale_a_carico:.2f}</b>",
                ''
            ])
        
        decessi_table = Table(decessi_table_data, colWidths=[25*mm, 20*mm, 23*mm, 22*mm, 25*mm, 15*mm, 20*mm, 15*mm], repeatRows=1)
        decessi_table.setStyle(TableStyle([
            # Header rosso scuro con testo bianco
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#8B0000')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
            ('TOPPADDING', (0, 1), (-1, -1), 4),
            ('LEFTPADDING', (0, 1), (-1, -1), 4),
            ('RIGHTPADDING', (0, 1), (-1, -1), 4),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Auricolare
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),  # Data arrivo
            ('ALIGN', (2, 1), (2, -1), 'LEFT'),  # Provenienza
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),  # Peso arrivo
            ('ALIGN', (4, 1), (4, -1), 'CENTER'),  # Data decesso
            ('ALIGN', (5, 1), (5, -1), 'CENTER'),  # Giorni
            ('ALIGN', (6, 1), (6, -1), 'RIGHT'),  # Valore
            ('ALIGN', (7, 1), (7, -1), 'CENTER'),  # A carico
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        
        story.append(decessi_table)
    
    # Genera PDF
    build_pdf(doc, story, branding_config)
    buffer.seek(0)
    return buffer


def generate_report_allevamento_per_partita_pdf(report_data: dict, branding=None):
    """
    Genera PDF del report allevamento con una pagina/sezione per ogni partita di ingresso.
    Stesso identico layout per ogni partita: status (arrivati/usciti/deceduti/presenti),
    dettaglio auricolari (presenti, usciti, deceduti), peso arrivo, acconto, peso uscita, destinazioni.
    """
    from datetime import date as date_type

    buffer = BytesIO()
    doc, branding_config = create_document(
        buffer,
        branding=branding,
        doc_kwargs={"pagesize": A4},
    )
    periodo_label = report_data.get("periodo_label") or report_data.get("data_uscita", "N/A")
    branding_config.setdefault("report_title", "Report Allevamento - Riepilogo per partita")
    branding_config.setdefault("report_subtitle", f"Periodo uscita: {periodo_label}")

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.black,
        spaceAfter=12,
        alignment=TA_CENTER,
    )
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#333333"),
        spaceAfter=8,
        spaceBefore=12,
    )
    subheading_style = ParagraphStyle(
        "CustomSubHeading",
        parent=styles["Heading3"],
        fontSize=12,
        textColor=colors.HexColor("#555555"),
        spaceAfter=6,
        spaceBefore=8,
    )

    table_header_color = colors.HexColor("#2d5016")
    table_bg = colors.HexColor("#f9f9f9")
    table_grid = colors.HexColor("#cccccc")
    larghezza_totale = 190 * mm

    story = []
    story.append(Paragraph("REPORT ALLEVAMENTO - RIEPILOGO PER PARTITA DI INGRESSO", title_style))
    story.append(Paragraph(f"Periodo uscita: {periodo_label}", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    riepilogo = report_data.get("riepilogo_per_partita") or []

    # ---------- PRIMA PAGINA: tabella unica (dati + conteggio + valore finale, senza dettaglio contratto) ----------
    if riepilogo:
        tot_capi_entrati = sum(p.get("numero_capi_arrivati", 0) or 0 for p in riepilogo)
        tot_capi_usciti = sum(p.get("numero_usciti", 0) or 0 for p in riepilogo)
        tot_capi_deceduti = sum(p.get("numero_deceduti", 0) or 0 for p in riepilogo)
        tot_peso_ing = sum(p.get("peso_arrivo_totale", 0) or 0 for p in riepilogo)
        tot_peso_iniziale = sum(p.get("peso_arrivo_totale_iniziale", 0) or 0 for p in riepilogo)
        tot_peso_deceduti = sum(p.get("peso_deceduti", 0) or 0 for p in riepilogo)
        tot_peso_usc = sum(p.get("peso_uscita_totale", 0) or 0 for p in riepilogo)
        tot_valore_ing = sum(p.get("valore_ingresso_totale", 0) or 0 for p in riepilogo)
        tot_valore_usc = sum(p.get("valore_uscita_totale", 0) or 0 for p in riepilogo)
        tot_acconto = sum(p.get("acconto_percepito", 0) or 0 for p in riepilogo)

        riepilogo_proprieta = report_data.get("riepilogo_proprieta", {})
        riepilogo_soccida = report_data.get("riepilogo_soccida", {})
        has_proprieta = (riepilogo_proprieta.get("numero_capi") or 0) > 0
        has_soccida = (riepilogo_soccida.get("numero_capi") or 0) > 0
        conteggio_valore = 0.0
        if has_proprieta:
            conteggio_valore = float(riepilogo_proprieta.get("differenza_valore", 0) or 0)
        elif has_soccida:
            conteggio_valore = float(riepilogo_soccida.get("valore_totale", 0) or 0)
        valore_finale = conteggio_valore - tot_acconto
        capi_con_peso_ing = tot_capi_entrati - tot_capi_deceduti

        # Operazioni su pesi e differenza peso
        dettaglio_soccida = riepilogo_soccida.get("dettaglio_contratti", [])
        # Peso ingresso: peso totale iniziale partite − peso capi deceduti
        peso_ingresso_cell = f"Peso totale iniziale: {tot_peso_iniziale:.2f} kg − Peso deceduti: {tot_peso_deceduti:.2f} kg = {tot_peso_ing:.2f} kg"
        peso_uscita_cell = f"{tot_peso_usc:.2f} kg"
        if has_soccida and dettaglio_soccida:
            orig_arrivo = sum(float(c.get("peso_arrivo_originale_totale", 0) or 0) for c in dettaglio_soccida)
            orig_uscita = sum(float(c.get("peso_uscita_originale_totale", 0) or 0) for c in dettaglio_soccida)
            net_arrivo = float(riepilogo_soccida.get("peso_arrivo", 0) or 0)
            net_uscita = float(riepilogo_soccida.get("peso_uscita", 0) or 0)
            pct_aggiunta = next((c.get("percentuale_aggiunta_arrivo") for c in dettaglio_soccida if c.get("percentuale_aggiunta_arrivo")), None)
            pct_sottrazione = next((c.get("percentuale_sottrazione_uscita") for c in dettaglio_soccida if c.get("percentuale_sottrazione_uscita")), None)
            if pct_aggiunta is not None and abs(orig_arrivo - net_arrivo) > 0.01:
                op_ing_soccida = f" Soccida (conteggio): {orig_arrivo:.2f} × (1 + {float(pct_aggiunta):.2f}%) = {net_arrivo:.2f} kg"
                peso_ingresso_cell = peso_ingresso_cell + op_ing_soccida
            if pct_sottrazione is not None and abs(orig_uscita - net_uscita) > 0.01:
                op_usc = f"Peso originale: {orig_uscita:.2f} kg × (1 − {float(pct_sottrazione):.2f}%) = {net_uscita:.2f} kg"
                peso_uscita_cell = f"{op_usc}. Totale partite: {tot_peso_usc:.2f} kg" if has_proprieta else op_usc
            elif has_soccida and not has_proprieta:
                peso_uscita_cell = f"{net_uscita:.2f} kg"

        # Riga differenza peso: operazione Peso uscita − Peso arrivo = ...
        differenza_peso_cell = "—"
        parts_diff = []
        if has_proprieta:
            pa = float(riepilogo_proprieta.get("peso_arrivo", 0) or 0)
            pu = float(riepilogo_proprieta.get("peso_uscita", 0) or 0)
            dp = float(riepilogo_proprieta.get("differenza_peso", 0) or 0)
            parts_diff.append(("Proprietà", pu, pa, dp))
        if has_soccida:
            pa = float(riepilogo_soccida.get("peso_arrivo", 0) or 0)
            pu = float(riepilogo_soccida.get("peso_uscita", 0) or 0)
            dp = float(riepilogo_soccida.get("differenza_peso", 0) or 0)
            parts_diff.append(("Soccida", pu, pa, dp))
        if len(parts_diff) == 1:
            _, pu, pa, dp = parts_diff[0]
            differenza_peso_cell = f"Peso uscita − Peso arrivo = {pu:.2f} − {pa:.2f} = {dp:.2f} kg"
        elif len(parts_diff) > 1:
            differenza_peso_cell = "Peso uscita − Peso arrivo = " + " | ".join(
                f"{label}: {pu:.2f} − {pa:.2f} = {dp:.2f} kg" for label, pu, pa, dp in parts_diff
            )

        # Formula del conteggio (solo operazioni con valori, senza etichette; per soccida prezzo_kg include differenza peso con %)
        formula_conteggio = "—"
        if has_proprieta:
            va = float(riepilogo_proprieta.get("valore_acquisto", 0) or 0)
            vv = float(riepilogo_proprieta.get("valore_vendita", 0) or 0)
            dv = float(riepilogo_proprieta.get("differenza_valore", 0) or 0)
            formula_conteggio = f"€ {vv:.2f} − € {va:.2f} = € {dv:.2f}"
        elif has_soccida:
            dettaglio = riepilogo_soccida.get("dettaglio_contratti", [])
            if dettaglio:
                c = dettaglio[0]
                mod = c.get("modalita_remunerazione") or ""
                vt = float(c.get("valore_totale", 0) or 0)
                nc = c.get("numero_capi", 0) or 0
                diff = float(c.get("differenza_peso_totale", 0) or 0)
                ppk = c.get("prezzo_per_kg")
                qg = c.get("quota_giornaliera")
                gg = c.get("giorni_gestione", 0) or 0
                pct = c.get("percentuale_remunerazione")
                if mod == "prezzo_kg" and ppk is not None:
                    # Includi calcolo differenza peso con % contratto (netti già calcolati sopra)
                    net_arr = float(riepilogo_soccida.get("peso_arrivo", 0) or 0)
                    net_usc = float(riepilogo_soccida.get("peso_uscita", 0) or 0)
                    orig_arr = sum(float(x.get("peso_arrivo_originale_totale", 0) or 0) for x in dettaglio_soccida)
                    orig_usc = sum(float(x.get("peso_uscita_originale_totale", 0) or 0) for x in dettaglio_soccida)
                    pct_agg = next((x.get("percentuale_aggiunta_arrivo") for x in dettaglio_soccida if x.get("percentuale_aggiunta_arrivo")), None)
                    pct_sottr = next((x.get("percentuale_sottrazione_uscita") for x in dettaglio_soccida if x.get("percentuale_sottrazione_uscita")), None)
                    parti = []
                    if pct_agg is not None and abs(orig_arr - net_arr) > 0.01:
                        parti.append(f"{orig_arr:.2f} × (1 + {float(pct_agg):.2f}%) = {net_arr:.2f} kg")
                    if pct_sottr is not None and abs(orig_usc - net_usc) > 0.01:
                        parti.append(f"{orig_usc:.2f} × (1 − {float(pct_sottr):.2f}%) = {net_usc:.2f} kg")
                    if parti:
                        formula_conteggio = ". ".join(parti) + f". {net_usc:.2f} − {net_arr:.2f} = {diff:.2f} kg. {diff:.2f} × € {float(ppk):.2f}/kg = € {vt:.2f}"
                    else:
                        formula_conteggio = f"{net_usc:.2f} − {net_arr:.2f} = {diff:.2f} kg. {diff:.2f} × € {float(ppk):.2f}/kg = € {vt:.2f}"
                elif mod == "quota_giornaliera" and qg is not None:
                    formula_conteggio = f"{nc} × {gg} × € {float(qg):.2f} = € {vt:.2f}"
                elif mod == "percentuale" and pct is not None:
                    formula_conteggio = f"× {float(pct):.2f}% = € {vt:.2f}"
                elif mod == "ripartizione_utili":
                    formula_conteggio = f"€ {vt:.2f}"
                else:
                    formula_conteggio = f"€ {vt:.2f}"
                if len(dettaglio) > 1:
                    vt_tot = float(riepilogo_soccida.get("valore_totale", 0) or 0)
                    formula_conteggio += f" (+ altri) = € {vt_tot:.2f}"
            else:
                formula_conteggio = f"€ {conteggio_valore:.2f}"
        formula_valore_finale = f"€ {conteggio_valore:.2f} − € {tot_acconto:.2f} = € {valore_finale:.2f}"

        story.append(Paragraph("Riepilogo (partite selezionate)", heading_style))
        story.append(Spacer(1, 4 * mm))
        col_w_label = 70 * mm
        col_w_valore = 120 * mm  # spazio per operazioni con valori
        small_style = ParagraphStyle("TableSmall", parent=styles["Normal"], fontSize=9)
        def _cell(s):
            return Paragraph(s, small_style) if ("Peso " in s or " − " in s) and len(s) > 35 else s
        totali_data = [
            ["Voce", "Valore"],
            ["Capi entrati", str(tot_capi_entrati)],
            ["Capi usciti", str(tot_capi_usciti)],
            ["Capi deceduti", str(tot_capi_deceduti)],
            ["Peso ingresso (kg)", _cell(peso_ingresso_cell)],
            ["Peso uscita (kg)", _cell(peso_uscita_cell)],
            ["Differenza peso (kg)", _cell(differenza_peso_cell)],
            ["Acconto totale (€)", f"€ {tot_acconto:.2f}"],
            ["Conteggio (€)", Paragraph(formula_conteggio, small_style)],
            ["Valore finale (€)", Paragraph(formula_valore_finale, small_style)],
        ]
        tab_tot = Table(totali_data, colWidths=[col_w_label, col_w_valore])
        tab_tot.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), table_header_color),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 1), (0, -1), table_header_color),
            ("TEXTCOLOR", (0, 1), (0, -1), colors.white),
            ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
            ("BACKGROUND", (1, 1), (1, -1), table_bg),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (1, 0), (1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, table_grid),
        ]))
        story.append(tab_tot)
        story.append(PageBreak())

    # ---------- PAGINE SUCCESSIVE: dettaglio per ogni partita ----------
    for idx, p in enumerate(riepilogo):
        if idx > 0:
            story.append(PageBreak())

        # Intestazione partita
        nome_stalla = (p.get("nome_stalla") or p.get("codice_stalla") or "N/A").strip()
        data_arrivo = p.get("data_arrivo") or "N/A"
        if data_arrivo and len(data_arrivo) >= 10:
            try:
                data_arrivo = date_type.fromisoformat(data_arrivo[:10]).strftime("%d/%m/%Y")
            except Exception:
                pass
        titolo_partita = f"Partita: {p.get('numero_partita', 'N/A')} - {data_arrivo} - {nome_stalla[:40]}"
        story.append(Paragraph(titolo_partita, heading_style))
        story.append(Spacer(1, 6 * mm))

        # Tabella status: Arrivati | Usciti | Deceduti | Presenti
        status_data = [
            ["Capi arrivati", "Capi usciti", "Capi deceduti", "Capi presenti"],
            [
                str(p.get("numero_capi_arrivati", 0)),
                str(p.get("numero_usciti", 0)),
                str(p.get("numero_deceduti", 0)),
                str(p.get("numero_presenti", 0)),
            ],
        ]
        col_w = larghezza_totale / 4
        status_table = Table(status_data, colWidths=[col_w] * 4)
        status_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), table_header_color),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, 1), (-1, 1), table_bg),
            ("GRID", (0, 0), (-1, -1), 0.5, table_grid),
        ]))
        story.append(status_table)
        story.append(Spacer(1, 6 * mm))

        # Peso arrivo, Acconto, Peso uscita (senza valore ingresso/uscita)
        dati_economici = [
            ["Peso arrivo totale", f"{p.get('peso_arrivo_totale', 0):.2f} kg"],
            ["Acconto percepito (partita)", f"€ {p.get('acconto_percepito', 0):.2f}"],
            ["Peso uscita (parziale/totale)", f"{p.get('peso_uscita_totale', 0):.2f} kg"],
        ]
        col_w2 = larghezza_totale / 2
        tab_dati = Table(dati_economici, colWidths=[col_w2] * 2)
        tab_dati.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), table_header_color),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("BACKGROUND", (1, 0), (1, -1), table_bg),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, table_grid),
        ]))
        story.append(tab_dati)
        story.append(Spacer(1, 6 * mm))

        # Destinazioni
        dest_list = p.get("destinazioni") or []
        if dest_list:
            story.append(Paragraph("Destinazioni uscite", subheading_style))
            dest_data = [["Destinazione", "N. Capi", "Peso totale (kg)"]]
            for d in dest_list:
                dest_data.append([
                    (d.get("destinazione") or "N/A")[:35],
                    str(d.get("numero_capi", 0)),
                    f"{d.get('peso_totale', 0):.2f}",
                ])
            cw = larghezza_totale / 3
            dest_table = Table(dest_data, colWidths=[cw * 1.5, cw * 0.75, cw * 0.75])
            dest_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), table_header_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("ALIGN", (2, 0), (2, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, table_bg]),
                ("GRID", (0, 0), (-1, -1), 0.5, table_grid),
            ]))
            story.append(dest_table)
            story.append(Spacer(1, 6 * mm))

        # Dettaglio auricolari: Presenti | Usciti | Deceduti (griglia 6 colonne per sezione)
        story.append(Paragraph("Dettaglio auricolari", subheading_style))
        story.append(Spacer(1, 4 * mm))

        num_col = 6
        col_w_aur = larghezza_totale / num_col

        for label, key in [("Presenti", "auricolari_presenti"), ("Usciti", "auricolari_usciti"), ("Deceduti", "auricolari_deceduti")]:
            auricolari = p.get(key) or []
            if not auricolari:
                story.append(Paragraph(f"{label}: —", styles["Normal"]))
            else:
                story.append(Paragraph(f"{label}:", styles["Normal"]))
                grid_data = []
                for i in range(0, len(auricolari), num_col):
                    riga = auricolari[i : i + num_col]
                    while len(riga) < num_col:
                        riga.append("")
                    grid_data.append(riga)
                t_aur = Table(grid_data, colWidths=[col_w_aur] * num_col)
                t_aur.setStyle(TableStyle([
                    ("FONTNAME", (0, 0), (-1, -1), "Courier"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e0e0e0")),
                ]))
                story.append(t_aur)
            story.append(Spacer(1, 4 * mm))

    build_pdf(doc, story, branding_config)
    buffer.seek(0)
    return buffer


def generate_prima_nota_dare_avere_pdf(report_data: dict, branding=None):
    """
    Genera PDF per report prima nota dare/avere per fornitore/cliente con layout orizzontale
    
    Args:
        report_data: Dizionario con i dati del report:
            - fornitore_cliente: dict con dati fornitore/cliente (nome, piva, cf, indirizzo, etc.)
            - movimenti: lista di movimenti con dare/avere
            - totale_dare: totale dare
            - totale_avere: totale avere
            - saldo: saldo finale
        branding: Configurazione branding (logo, dati aziendali, etc.)
    
    Returns:
        BytesIO object con il PDF
    """
    buffer = BytesIO()
    doc, branding_config = create_document(
        buffer,
        branding=branding,
        doc_kwargs={
            "pagesize": landscape(A4),
        },
    )
    branding_config.setdefault("report_title", "Report Prima Nota")
    branding_config.setdefault("report_subtitle", "Dare/Avere per Fornitore/Cliente")
    
    # Styles - fedeli al report allevamento
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.black,
        spaceAfter=12,
        alignment=TA_CENTER
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8,
        spaceBefore=12
    )
    
    subheading_style = ParagraphStyle(
        'CustomSubHeading',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#555555'),
        spaceAfter=6,
        spaceBefore=8
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.black,
        spaceAfter=4
    )
    
    # Contenuto
    story = []
    
    # Titolo
    story.append(Paragraph("REPORT PRIMA NOTA - DARE/AVERE", title_style))
    story.append(Spacer(1, 8*mm))
    
    # Dati Fornitore/Cliente
    fornitore_cliente = report_data.get('fornitore_cliente', {})
    if fornitore_cliente:
        story.append(Paragraph("DATI FORNITORE/CLIENTE", heading_style))
        
        dati_fornitore = []
        if fornitore_cliente.get('nome'):
            dati_fornitore.append(['Nome/Ragione Sociale', fornitore_cliente.get('nome', '')])
        if fornitore_cliente.get('piva'):
            dati_fornitore.append(['Partita IVA', fornitore_cliente.get('piva', '')])
        if fornitore_cliente.get('cf'):
            dati_fornitore.append(['Codice Fiscale', fornitore_cliente.get('cf', '')])
        if fornitore_cliente.get('indirizzo'):
            dati_fornitore.append(['Indirizzo', fornitore_cliente.get('indirizzo', '')])
        if fornitore_cliente.get('cap'):
            dati_fornitore.append(['CAP', fornitore_cliente.get('cap', '')])
        if fornitore_cliente.get('citta'):
            dati_fornitore.append(['Città', fornitore_cliente.get('citta', '')])
        if fornitore_cliente.get('provincia'):
            dati_fornitore.append(['Provincia', fornitore_cliente.get('provincia', '')])
        if fornitore_cliente.get('telefono'):
            dati_fornitore.append(['Telefono', fornitore_cliente.get('telefono', '')])
        if fornitore_cliente.get('email'):
            dati_fornitore.append(['Email', fornitore_cliente.get('email', '')])
        
        if dati_fornitore:
            fornitore_table = Table(dati_fornitore, colWidths=[60*mm, 120*mm])
            fornitore_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#2d5016')),  # Verde scuro come report allevamento
                ('TEXTCOLOR', (0, 0), (0, -1), colors.white),
                ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#f0f0f0')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
            ]))
            story.append(fornitore_table)
            story.append(Spacer(1, 12*mm))
    
    # Tabella Dare/Avere
    movimenti = report_data.get('movimenti', [])
    if movimenti:
        story.append(Paragraph("MOVIMENTI DARE/AVERE", heading_style))
        
        # Header tabella
        table_data = [['Data', 'Descrizione', 'Dare', 'Avere', 'Saldo']]
        
        saldo_cumulativo = 0
        for movimento in movimenti:
            data_mov = movimento.get('data', '')
            descrizione = movimento.get('descrizione', '')
            dare = movimento.get('dare', 0)
            avere = movimento.get('avere', 0)
            
            if dare > 0:
                saldo_cumulativo += dare
            else:
                saldo_cumulativo -= avere
            
            table_data.append([
                data_mov,
                descrizione[:60],  # Limita lunghezza descrizione
                f"€ {dare:.2f}" if dare > 0 else "",
                f"€ {avere:.2f}" if avere > 0 else "",
                f"€ {saldo_cumulativo:.2f}"
            ])
        
        # Aggiungi riga totali
        totale_dare = report_data.get('totale_dare', 0)
        totale_avere = report_data.get('totale_avere', 0)
        saldo_finale = report_data.get('saldo', 0)
        
        table_data.append([
            '',
            'TOTALE',
            f"€ {totale_dare:.2f}" if totale_dare > 0 else "",
            f"€ {totale_avere:.2f}" if totale_avere > 0 else "",
            f"€ {saldo_finale:.2f}"
        ])
        
        # Crea tabella con larghezza colonne ottimizzate per layout orizzontale
        dare_avere_table = Table(
            table_data, 
            colWidths=[25*mm, 80*mm, 30*mm, 30*mm, 30*mm],
            repeatRows=1
        )
        dare_avere_table.setStyle(TableStyle([
            # Header verde scuro con testo bianco (come report allevamento)
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d5016')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            # Body
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -2), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -2), 4),
            ('TOPPADDING', (0, 1), (-1, -2), 4),
            ('LEFTPADDING', (0, 1), (-1, -2), 4),
            ('RIGHTPADDING', (0, 1), (-1, -2), 4),
            ('ALIGN', (0, 1), (0, -2), 'LEFT'),  # Data
            ('ALIGN', (1, 1), (1, -2), 'LEFT'),  # Descrizione
            ('ALIGN', (2, 1), (2, -2), 'RIGHT'),  # Dare
            ('ALIGN', (3, 1), (3, -2), 'RIGHT'),  # Avere
            ('ALIGN', (4, 1), (4, -2), 'RIGHT'),  # Saldo
            # Riga totali
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 9),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f5e9')),
            ('BOTTOMPADDING', (0, -1), (-1, -1), 6),
            ('TOPPADDING', (0, -1), (-1, -1), 6),
            ('ALIGN', (2, -1), (4, -1), 'RIGHT'),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        
        story.append(dare_avere_table)
    
    # Genera PDF
    build_pdf(doc, story, branding_config)
    buffer.seek(0)
    return buffer

def generate_ddt_emesso_pdf(ddt_data, branding=None):
    """
    Genera PDF per Documento di Trasporto (DDT) emesso
    
    Args:
        ddt_data: Dizionario o oggetto DdtEmesso con i dati del DDT
        branding: Configurazione branding (logo, dati aziendali, etc.)
    
    Returns:
        BytesIO object con il PDF
    """
    buffer = BytesIO()
    # Usa i margini di default da pdf_layout (definiti dall'header)
    # Riduce il topMargin per il DDT per avvicinare il contenuto all'header
    from .pdf_layout import prepare_branding
    branding_cfg = prepare_branding(branding)
    header_height = branding_cfg.get("header_height", 35 * mm)
    doc, branding_config = create_document(
        buffer,
        branding=branding,
        doc_kwargs={
            "pagesize": A4,
            "topMargin": header_height + 4 * mm,  # Ridotto da 12mm a 4mm per DDT
        },
    )
    branding_config.setdefault("report_title", "DOCUMENTO DI TRASPORTO")
    branding_config.setdefault("report_subtitle", "")
    
    # Preferisci Arial (se registrabile), altrimenti Helvetica (sempre disponibile in ReportLab)
    def _get_ddt_font_pair():
        registered = set(pdfmetrics.getRegisteredFontNames() or [])
        if "Arial" in registered and "Arial-Bold" in registered:
            return "Arial", "Arial-Bold"

        # Candidati comuni (macOS / Linux). Se non presenti, fallback a Helvetica.
        arial_candidates = (
            "/Library/Fonts/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
            "/usr/share/fonts/truetype/msttcorefonts/arial.ttf",
            "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
        )
        arial_bold_candidates = (
            "/Library/Fonts/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf",
            "/usr/share/fonts/truetype/msttcorefonts/arialbd.ttf",
            "/usr/share/fonts/truetype/msttcorefonts/Arialbd.ttf",
        )

        arial_path = next((p for p in arial_candidates if p and __import__("os").path.isfile(p)), None)
        arial_bold_path = next((p for p in arial_bold_candidates if p and __import__("os").path.isfile(p)), None)

        if arial_path and arial_bold_path:
            try:
                if "Arial" not in registered:
                    pdfmetrics.registerFont(TTFont("Arial", arial_path))
                if "Arial-Bold" not in registered:
                    pdfmetrics.registerFont(TTFont("Arial-Bold", arial_bold_path))
                return "Arial", "Arial-Bold"
            except Exception:
                pass

        return "Helvetica", "Helvetica-Bold"

    font_regular, font_bold = _get_ddt_font_pair()
    body_font_size = 9
    section_title_font_size = 10

    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DDTTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.black,
        spaceAfter=1,  # Interlinea minima per avvicinare i riferimenti legali
        spaceBefore=0,  # Nessuno spazio prima per spostarlo più in alto
        alignment=TA_CENTER
    )
    
    normal_style = ParagraphStyle(
        'DDTNormal',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=body_font_size,
        textColor=colors.black,
        spaceAfter=3,
        leading=11,
    )
    
    label_style = ParagraphStyle(
        'DDTLabel',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=section_title_font_size,
        textColor=colors.HexColor('#333333'),
        spaceAfter=2
    )
    
    # Stile per destinatario (più grande e visibile)
    destinatario_title_style = ParagraphStyle(
        'DDTDestinatarioTitle',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=section_title_font_size,
        textColor=colors.black,
        spaceAfter=1
    )
    
    # Stile per vettore (secondario, interlinea ridotta)
    vettore_style = ParagraphStyle(
        'DDTVettore',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=body_font_size,
        textColor=colors.HexColor('#555555'),
        spaceAfter=1,
        leading=10,
    )
    
    # Stile per riferimenti legali (piccolo e discreto, interlinea minima)
    legal_style = ParagraphStyle(
        'DDTLegal',
        parent=styles['Normal'],
        fontSize=6,
        textColor=colors.HexColor('#999999'),
        spaceAfter=0,
        spaceBefore=0,
        leading=7,
        alignment=TA_CENTER
    )
    
    # Estrai dati (supporta sia dict che oggetto)
    if hasattr(ddt_data, '__dict__'):
        ddt = ddt_data
    else:
        ddt = type('DDT', (), ddt_data)()
    
    # Contenuto
    story = []
    
    # Titolo (spostato più in alto, ridotto spazio prima)
    story.append(Paragraph("DOCUMENTO DI TRASPORTO", title_style))
    
    # Riferimenti legali (piccoli, subito sotto il titolo, interlinea minima)
    legal_refs = "D.P.R. 472/1996 - D.Lgs. 231/2007 - Art. 1, c. 2, D.Lgs. 127/2015"
    story.append(Paragraph(legal_refs, legal_style))
    story.append(Spacer(1, 4 * mm))
    
    # Destinatario come lettera (posizionato a destra ma allineato a sinistra)
    destinatario_style = ParagraphStyle(
        'DDTDestinatario',
        parent=normal_style,
        fontSize=body_font_size,
        textColor=colors.black,
        alignment=TA_LEFT,
        spaceAfter=2
    )
    
    # Funzione per capitalizzare correttamente (title case: ogni parola con prima maiuscola)
    def capitalize_name(name):
        if not name:
            return name
        # Usa title case: ogni parola con prima lettera maiuscola
        return name.title()
    
    # Funzione per formattare luogo_destinazione: via con title(), provincia in MAIUSCOLO
    def format_luogo_destinazione(luogo):
        if not luogo:
            return luogo
        # Cerca la provincia tra parentesi alla fine (es. "(RM)", "(MI)")
        import re
        # Pattern per trovare (PROVINCIA) alla fine
        pattern = r'\s*\(([A-Z]{2,3})\)\s*$'
        match = re.search(pattern, luogo, re.IGNORECASE)
        
        if match:
            # Estrai la parte principale e la provincia
            provincia = match.group(1).upper()  # Provincia in MAIUSCOLO
            parte_principale = luogo[:match.start()].strip()  # Tutto prima della provincia
            # Applica title() alla parte principale
            parte_formattata = parte_principale.title()
            # Ricostruisci con provincia in MAIUSCOLO
            return f"{parte_formattata} ({provincia})"
        else:
            # Se non c'è provincia tra parentesi, applica solo title()
            return luogo.title()
    
    # Costruisci il blocco destinatario con titolo DESTINATARIO
    destinatario_lines = [f"<font size='{section_title_font_size}'><b>DESTINATARIO</b></font>"]
    if ddt.destinatario_nome:
        nome_capitalized = capitalize_name(ddt.destinatario_nome)
        destinatario_lines.append(f"<font size='{body_font_size}'><b>{nome_capitalized}</b></font>")
    if ddt.destinatario_indirizzo:
        destinatario_lines.append(capitalize_name(ddt.destinatario_indirizzo))
    if ddt.destinatario_cap and ddt.destinatario_comune:
        comune_capitalized = capitalize_name(ddt.destinatario_comune)
        comune_prov = f"{ddt.destinatario_cap} {comune_capitalized}"
        if ddt.destinatario_provincia:
            comune_prov += f" ({ddt.destinatario_provincia.upper()})"
        destinatario_lines.append(comune_prov)
    if ddt.destinatario_piva:
        destinatario_lines.append(f"P.IVA: {ddt.destinatario_piva}")
    if ddt.destinatario_cf:
        destinatario_lines.append(f"CF: {ddt.destinatario_cf}")
    
    # Unisci tutte le righe con <br/> per formattare come lettera
    destinatario_text = "<br/>".join(destinatario_lines)

    # D.D.T. n. ... e data (a capo) affiancati al destinatario (stessa altezza)
    data_str = ddt.data.strftime('%d/%m/%Y') if hasattr(ddt.data, 'strftime') else str(ddt.data)
    ddt_info_text = (
        f"<font size='{section_title_font_size}'><b>D.D.T. n. {ddt.numero or 'N/A'}</b></font><br/>"
        f"<font size='{section_title_font_size}'><b>del {data_str}</b></font>"
    )
    ddt_info_style = ParagraphStyle(
        "DDTInfo",
        parent=normal_style,
        fontName=font_bold,
        fontSize=section_title_font_size,
        leading=11,
        spaceAfter=0,
        alignment=TA_LEFT,
    )

    available_width = doc.width
    ddt_dest_table = Table(
        [[Paragraph(ddt_info_text, ddt_info_style), Paragraph(destinatario_text, destinatario_style)]],
        colWidths=[available_width * 0.5, available_width * 0.5],
    )
    ddt_dest_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(ddt_dest_table)
    story.append(Spacer(1, 2 * mm))
    
    # Luogo di destinazione e Causale trasporto affiancati 50/50
    available_width = doc.width
    col_width = available_width / 2  # Due colonne uguali
    
    # Colonna sinistra: Causale trasporto
    causale_text = ""
    if ddt.causale_trasporto:
        causale_text = (
            f"<font size='{section_title_font_size}'><b>CAUSALE DEL TRASPORTO</b></font><br/>"
            f"<font size='{body_font_size}'>{capitalize_name(ddt.causale_trasporto)}</font>"
        )
    else:
        causale_text = (
            f"<font size='{section_title_font_size}'><b>CAUSALE DEL TRASPORTO</b></font><br/>"
            f"<font size='{body_font_size}'>-</font>"
        )
    
    # Colonna destra: Luogo di destinazione
    luogo_text = ""
    if ddt.luogo_destinazione:
        luogo_text = (
            f"<font size='{section_title_font_size}'><b>LUOGO DI DESTINAZIONE</b></font><br/>"
            f"<font size='{body_font_size}'>{format_luogo_destinazione(ddt.luogo_destinazione)}</font>"
        )
    else:
        luogo_text = (
            f"<font size='{section_title_font_size}'><b>LUOGO DI DESTINAZIONE</b></font><br/>"
            f"<font size='{body_font_size}'>-</font>"
        )
    
    causale_luogo_table = Table([
        [Paragraph(causale_text, normal_style), Paragraph(luogo_text, normal_style)]
    ], colWidths=[col_width, col_width])
    causale_luogo_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(causale_luogo_table)
    
    # Leggermente più aria tra testo e tabella
    story.append(Spacer(1, 3 * mm))
    
    # Tabella articoli/beni (sempre presente, con minimo 10 righe vuote)
    articoli = ddt.articoli if ddt.articoli else []
    articoli_data = [['DESCRIZIONE', 'U.M.', 'Q.tà']]
    
    # Aggiungi gli articoli esistenti
    for articolo in articoli:
        if isinstance(articolo, dict):
            descrizione = articolo.get('descrizione', '')
            uom = articolo.get('unita_misura', '')
            quantita = articolo.get('quantita', 0)
            if isinstance(quantita, (int, float)):
                quantita_str = f"{quantita:.3f}".rstrip('0').rstrip('.')
            else:
                quantita_str = str(quantita)
            articoli_data.append([descrizione, uom, quantita_str])
    
    # Aggiungi righe vuote fino a raggiungere almeno 10 righe totali (escluso header)
    num_righe_vuote = max(10 - len(articoli_data) + 1, 0)  # +1 perché header è già presente
    for _ in range(num_righe_vuote):
        articoli_data.append(['', '', ''])
    
    # Calcola larghezze colonne: 70% descrizione, 15% UM, 15% Q.tà
    available_width = doc.width
    desc_width = available_width * 0.70
    uom_width = available_width * 0.15
    qty_width = available_width * 0.15
    
    articoli_table = Table(articoli_data, colWidths=[desc_width, uom_width, qty_width])
    articoli_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a4a4a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTNAME', (0, 1), (-1, -1), font_regular),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),  # Ridotto da 6
        ('TOPPADDING', (0, 0), (-1, -1), 4),  # Ridotto da 6
        ('LEFTPADDING', (0, 0), (-1, -1), 4),  # Ridotto da 6
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),  # Ridotto da 6
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),  # Bordi più sottili (0.5 invece di 1)
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        # Arrotondamento angoli esterni (usando LINEJOIN per effetto visivo)
        ('LINEJOIN', (0, 0), (-1, -1), 1),  # 1 = round join
    ]))
    story.append(articoli_table)
    story.append(Spacer(1, 3 * mm))
    
    # Sezione trasporto, data ritiro e vettore in 2 colonne
    # Colonna sinistra: Trasporto a mezzo e Data ritiro
    left_col_parts = []
    
    # Trasporto a mezzo (titolo in MAIUSCOLO, valore a capo)
    trasporto_value = ""
    if ddt.trasporto_a_mezzo:
        if ddt.trasporto_a_mezzo == 'mittente':
            trasporto_value = "Mittente"
        elif ddt.trasporto_a_mezzo == 'vettore':
            trasporto_value = "Vettore"
        elif ddt.trasporto_a_mezzo == 'destinatario':
            trasporto_value = "Destinatario"
    
    left_col_parts.append(
        f"<font size='{section_title_font_size}'><b>TRASPORTO A MEZZO</b></font><br/>"
        f"<font size='{body_font_size}'>{trasporto_value if trasporto_value else '-'}</font>"
    )
    
    # Data ritiro (sotto trasporto a mezzo, titolo in MAIUSCOLO, valore a capo)
    if ddt.data_ritiro:
        data_ritiro_str = ddt.data_ritiro.strftime('%d/%m/%Y') if hasattr(ddt.data_ritiro, 'strftime') else str(ddt.data_ritiro)
        left_col_parts.append(
            f"<font size='{section_title_font_size}'><b>DATA E ORA RITIRO</b></font><br/>"
            f"<font size='{body_font_size}'>{data_ritiro_str}</font>"
        )
    else:
        left_col_parts.append(
            f"<font size='{section_title_font_size}'><b>DATA E ORA RITIRO</b></font><br/>"
            f"<font size='{body_font_size}'>-</font>"
        )
    
    # Colonna destra: Vettore (sempre presente il titolo)
    right_col_parts = []
    right_col_parts.append(f"<font size='{section_title_font_size}'><b>VETTORE</b></font>")
    
    # Dati vettore (solo se trasporto a mezzo è vettore)
    if ddt.trasporto_a_mezzo == 'vettore' and getattr(ddt, 'vettore_ragione_sociale', None):
        vettore_info = []
        if getattr(ddt, 'vettore_ragione_sociale', None):
            vettore_info.append(f"Ragione Sociale: {capitalize_name(ddt.vettore_ragione_sociale)}")
        if getattr(ddt, 'vettore_sede_legale', None):
            vettore_info.append(f"Sede Legale: {capitalize_name(ddt.vettore_sede_legale)}")
        if getattr(ddt, 'vettore_partita_iva', None):
            vettore_info.append(f"P.IVA: {ddt.vettore_partita_iva}")
        if getattr(ddt, 'vettore_licenza', None):
            vettore_info.append(f"Licenza: {capitalize_name(ddt.vettore_licenza)}")
        if getattr(ddt, 'vettore_targhe', None):
            vettore_info.append(f"Targhe: {capitalize_name(ddt.vettore_targhe)}")
        if getattr(ddt, 'vettore_autista', None):
            vettore_info.append(f"Autista: {capitalize_name(ddt.vettore_autista)}")
        
        if vettore_info:
            vettore_text = "<br/>".join(vettore_info)
            right_col_parts.append(f"<font size='{body_font_size}'><i>{vettore_text}</i></font>")
        else:
            right_col_parts.append(f"<font size='{body_font_size}'>-</font>")
    else:
        right_col_parts.append(f"<font size='{body_font_size}'>-</font>")
    
    # Crea tabella a 2 colonne
    left_text = "<br/><br/>".join(left_col_parts)
    right_text = "<br/>".join(right_col_parts)
    
    left_paragraph = Paragraph(left_text, normal_style)
    right_paragraph = Paragraph(right_text, normal_style)
    
    # Calcola larghezze colonne basandosi sulla larghezza disponibile del documento
    available_width = doc.width  # Larghezza disponibile (già meno margini)
    col_width = available_width / 2  # Due colonne uguali
    
    trasporto_data_table = Table([
        [left_paragraph, right_paragraph]
    ], colWidths=[col_width, col_width])
    trasporto_data_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),  # Ridotto da 4
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),  # Ridotto da 4
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),  # Ridotto da 4
        ('TOPPADDING', (0, 0), (-1, -1), 2),  # Ridotto da 4
    ]))
    story.append(trasporto_data_table)
    story.append(Spacer(1, 2*mm))  # Ridotto da 4mm
    
    # Aspetto dei beni (allineato alla colonna sinistra come DATA RITIRO)
    if ddt.aspetto_beni:
        aspetto_text = (
            f"<font size='{section_title_font_size}'><b>ASPETTO DEI BENI</b></font><br/>"
            f"<font size='{body_font_size}'>{capitalize_name(ddt.aspetto_beni)}</font>"
        )
    else:
        aspetto_text = (
            f"<font size='{section_title_font_size}'><b>ASPETTO DEI BENI</b></font><br/>"
            f"<font size='{body_font_size}'>-</font>"
        )
    
    aspetto_table = Table([
        [Paragraph(aspetto_text, normal_style), '']
    ], colWidths=[col_width, col_width])
    aspetto_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(aspetto_table)
    story.append(Spacer(1, 2*mm))  # Ridotto da 4mm
    
    # Annotazioni (allineato alla colonna sinistra come DATA RITIRO)
    if ddt.annotazioni:
        annotazioni_text = (
            f"<font size='{section_title_font_size}'><b>ANNOTAZIONI</b></font><br/>"
            f"<font size='{body_font_size}'>{capitalize_name(ddt.annotazioni)}</font>"
        )
    else:
        annotazioni_text = (
            f"<font size='{section_title_font_size}'><b>ANNOTAZIONI</b></font><br/>"
            f"<font size='{body_font_size}'>-</font>"
        )
    
    annotazioni_table = Table([
        [Paragraph(annotazioni_text, normal_style), '']
    ], colWidths=[col_width, col_width])
    annotazioni_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(annotazioni_table)
    story.append(Spacer(1, 2*mm))  # Ridotto da 4mm
    
    # Firma (tre righe) - testo allineato a sinistra
    firma_style = ParagraphStyle(
        'DDTFirma',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=body_font_size,
        textColor=colors.black,
        alignment=TA_LEFT,
        spaceAfter=0,
        leading=11,
    )
    
    # Calcola larghezze colonne basandosi sulla larghezza disponibile del documento
    available_width = doc.width  # Larghezza disponibile (già meno margini)
    col_width = available_width / 3  # Tre colonne uguali
    
    firma_data = [
        [Paragraph("FIRMA MITTENTE", firma_style), Paragraph("FIRMA VETTORE", firma_style), Paragraph("FIRMA DESTINATARIO", firma_style)]
    ]
    firma_table = Table(firma_data, colWidths=[col_width, col_width, col_width])
    firma_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), font_regular),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 30),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#666666')),
    ]))

    # Spingi le firme a fondo pagina (attaccate al footer, ma senza sovrapposizione)
    class _FillRemainingSpace(Flowable):
        def __init__(self, bottom_flowable, gap=0):
            super().__init__()
            self._bottom = bottom_flowable
            self._gap = gap
            self._height = 0

        def wrap(self, availWidth, availHeight):
            try:
                _, bottom_h = self._bottom.wrap(availWidth, availHeight)
            except Exception:
                bottom_h = 0
            self._height = max(0, availHeight - bottom_h - self._gap)
            return (availWidth, self._height)

        def draw(self):
            # Nessun disegno: è solo spazio verticale "elastico"
            return

    story.append(_FillRemainingSpace(firma_table, gap=1.5 * mm))
    story.append(firma_table)
    
    # Genera PDF
    build_pdf(doc, story, branding_config)
    buffer.seek(0)
    return buffer
