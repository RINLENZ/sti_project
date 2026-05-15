"""
Génération du bulletin de progression apprenant en PDF (ReportLab).
"""
import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Flowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ── Palette ──────────────────────────────────────────────────────────────────
BROWN      = HexColor('#7C5C3A')
BROWN_PALE = HexColor('#F5EDE4')
BROWN_DARK = HexColor('#5C3D1E')
GREEN      = HexColor('#059669')
GREEN_PALE = HexColor('#D1FAE5')
ORANGE     = HexColor('#D97706')
ORANGE_P   = HexColor('#FEF3C7')
RED        = HexColor('#EF4444')
RED_PALE   = HexColor('#FEE2E2')
GRAY       = HexColor('#6B7280')
GRAY_LIGHT = HexColor('#F3F4F6')
GRAY_PALE  = HexColor('#E5E7EB')
TEXT       = HexColor('#1C1917')
WHITE      = colors.white


def _mastery_color(pct: int) -> HexColor:
    if pct >= 80:
        return GREEN
    if pct >= 50:
        return ORANGE
    return RED


# ── Composant barre de progression ──────────────────────────────────────────
class ProgressBar(Flowable):
    def __init__(self, percentage: float, width: float = 110, height: float = 7):
        super().__init__()
        self.percentage = min(100.0, max(0.0, percentage))
        self.width      = width
        self.height     = height

    def wrap(self, avail_w, avail_h):
        return self.width, self.height + 2

    def draw(self):
        c = self.canv
        c.setFillColor(GRAY_PALE)
        c.roundRect(0, 0, self.width, self.height, 3, fill=1, stroke=0)
        fill_w = max(3, self.width * self.percentage / 100)
        c.setFillColor(_mastery_color(int(self.percentage)))
        c.roundRect(0, 0, fill_w, self.height, 3, fill=1, stroke=0)


# ── Styles texte ─────────────────────────────────────────────────────────────
def _styles():
    base = getSampleStyleSheet()
    def ps(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        'h1': ps('h1', fontSize=18, leading=22, textColor=WHITE, fontName='Helvetica-Bold', alignment=TA_LEFT),
        'h2': ps('h2', fontSize=10, leading=13, textColor=WHITE, fontName='Helvetica', alignment=TA_LEFT),
        'sec': ps('sec', fontSize=9, leading=11, textColor=BROWN, fontName='Helvetica-Bold',
                  textTransform='uppercase', letterSpacing=0.5, spaceBefore=4),
        'cell': ps('cell', fontSize=8.5, leading=11, textColor=TEXT, fontName='Helvetica'),
        'cell_b': ps('cell_b', fontSize=8.5, leading=11, textColor=TEXT, fontName='Helvetica-Bold'),
        'stat_n': ps('stat_n', fontSize=20, leading=24, textColor=BROWN, fontName='Helvetica-Bold', alignment=TA_CENTER),
        'stat_l': ps('stat_l', fontSize=8, leading=10, textColor=GRAY, fontName='Helvetica', alignment=TA_CENTER),
        'footer': ps('footer', fontSize=7.5, leading=10, textColor=GRAY, fontName='Helvetica', alignment=TA_CENTER),
        'info_l': ps('info_l', fontSize=8.5, leading=11, textColor=GRAY, fontName='Helvetica'),
        'info_v': ps('info_v', fontSize=8.5, leading=11, textColor=TEXT, fontName='Helvetica-Bold'),
        'pct': ps('pct', fontSize=8.5, leading=10, fontName='Helvetica-Bold', alignment=TA_RIGHT),
    }


# ── Fonction principale ───────────────────────────────────────────────────────
def generate_bulletin(user, stats: dict, masteries: list[dict], epreuves: list[dict]) -> bytes:
    """
    Génère un bulletin PDF et retourne les bytes.

    Args:
        user       : objet User SQLAlchemy
        stats      : dict depuis get_stats_apprenant
        masteries  : [{ competence, p_mastery, nb_tentatives, nb_correct, ua_titre }]
        epreuves   : [{ titre, type_epreuve, score_total, submitted_at, statut }]
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=28*mm,  rightMargin=28*mm,
        topMargin=28*mm,   bottomMargin=22*mm,
        title=f"Bulletin — {user.prenom} {user.nom}",
        author="Plateforme STI",
    )

    S = _styles()
    W = doc.width
    story = []

    now_str = datetime.now(timezone.utc).strftime('%d/%m/%Y à %H:%M UTC')

    # ── En-tête coloré ───────────────────────────────────────────────────────
    header_data = [[
        Paragraph('BULLETIN DE PROGRESSION', S['h1']),
        Paragraph('Plateforme STI<br/>Système de Tutorat Intelligent', S['h2']),
    ]]
    header_table = Table(header_data, colWidths=[W * 0.6, W * 0.4])
    header_table.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), BROWN),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING',   (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 12),
        ('ALIGN',        (1, 0), (1, 0),  'RIGHT'),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8*mm))

    # ── Informations étudiant ────────────────────────────────────────────────
    niveau  = getattr(user, 'niveau_label', None) or '—'
    classe  = getattr(user, 'code_classe',  None) or '—'
    annee   = '2025-2026'

    info_data = [
        [Paragraph('Nom complet',     S['info_l']), Paragraph(f'{user.prenom} {user.nom}', S['info_v']),
         Paragraph('Niveau',          S['info_l']), Paragraph(niveau, S['info_v'])],
        [Paragraph('Email',           S['info_l']), Paragraph(user.email, S['info_v']),
         Paragraph('Classe',          S['info_l']), Paragraph(classe,  S['info_v'])],
        [Paragraph('Date du bulletin',S['info_l']), Paragraph(now_str, S['info_v']),
         Paragraph('Année scolaire',  S['info_l']), Paragraph(annee,   S['info_v'])],
    ]
    cw = [W * 0.18, W * 0.32, W * 0.18, W * 0.32]
    info_table = Table(info_data, colWidths=cw)
    info_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), BROWN_PALE),
        ('ROUNDEDCORNERS',[6, 6, 6, 6]),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 8*mm))

    # ── Statistiques globales ────────────────────────────────────────────────
    story.append(Paragraph('Statistiques globales', S['sec']))
    story.append(Spacer(1, 3*mm))

    p_moyen  = stats.get('p_mastery_moyen', 0)
    t_reuss  = stats.get('taux_reussite', 0)
    nb_sess  = stats.get('nb_sessions', 0)
    duree_m  = stats.get('duree_totale_minutes', 0)
    h, m     = divmod(duree_m, 60)
    duree_s  = f'{h}h {m:02d}min' if h else f'{m} min'
    nb_mais  = stats.get('nb_maitrisees', 0)
    nb_comp  = stats.get('nb_competences', 0)

    def stat_cell(valeur, label):
        return [Paragraph(valeur, S['stat_n']), Paragraph(label, S['stat_l'])]

    stat_data = [[
        stat_cell(f'{p_moyen} %', 'Maîtrise moyenne'),
        stat_cell(f'{t_reuss} %', 'Taux de réussite'),
        stat_cell(f'{nb_mais}/{nb_comp}', 'Compétences maîtrisées'),
        stat_cell(duree_s, "Temps d'apprentissage"),
        stat_cell(str(nb_sess), 'Sessions terminées'),
    ]]

    cw_stat = [W / 5] * 5
    stat_table = Table(stat_data, colWidths=cw_stat, rowHeights=None)
    stat_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), GRAY_LIGHT),
        ('GRID',          (0, 0), (-1, -1), 0.5, GRAY_PALE),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING',   (0, 0), (-1, -1), 4),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 4),
        ('ROUNDEDCORNERS',[4, 4, 4, 4]),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 8*mm))

    # ── Progression BKT par compétence ───────────────────────────────────────
    if masteries:
        story.append(Paragraph('Progression par compétence (BKT)', S['sec']))
        story.append(Spacer(1, 3*mm))

        bar_w = W * 0.38
        bkt_rows = [[
            Paragraph('Compétence', S['cell_b']),
            Paragraph('UA', S['cell_b']),
            Paragraph('Maîtrise', S['cell_b']),
            Paragraph('%', S['cell_b']),
            Paragraph('Essais', S['cell_b']),
        ]]
        for m in sorted(masteries, key=lambda x: -x['p_mastery']):
            pct = round(m['p_mastery'] * 100)
            c   = _mastery_color(pct)
            pct_p = Paragraph(f'<font color="#{c.hexval()[1:]}">{pct} %</font>', S['pct'])
            bkt_rows.append([
                Paragraph(m['competence'][:52], S['cell']),
                Paragraph((m.get('ua_titre') or '—')[:30], S['cell']),
                ProgressBar(pct, width=bar_w, height=7),
                pct_p,
                Paragraph(f"{m['nb_correct']}/{m['nb_tentatives']}", S['cell']),
            ])

        cw_bkt = [W * 0.28, W * 0.18, bar_w, W * 0.09, W * 0.08]
        bkt_table = Table(bkt_rows, colWidths=cw_bkt, repeatRows=1)
        bkt_table.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0),  BROWN),
            ('TEXTCOLOR',     (0, 0), (-1, 0),  WHITE),
            ('FONTNAME',      (0, 0), (-1, 0),  'Helvetica-Bold'),
            ('FONTSIZE',      (0, 0), (-1, 0),  8),
            ('ROWBACKGROUNDS',(0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
            ('LINEBELOW',     (0, 0), (-1, -1), 0.3, GRAY_PALE),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 6),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
            ('ROUNDEDCORNERS',[4, 4, 4, 4]),
        ]))
        story.append(bkt_table)
        story.append(Spacer(1, 8*mm))

    # ── Épreuves passées ─────────────────────────────────────────────────────
    if epreuves:
        story.append(Paragraph('Résultats aux épreuves', S['sec']))
        story.append(Spacer(1, 3*mm))

        TYPE_LABELS = {
            'sequence': 'Épreuve de séquence', 'examen': 'Examen',
            'devoir': 'Devoir surveillé',       'tp_note': 'TP noté',
        }

        ep_rows = [[
            Paragraph('Titre', S['cell_b']),
            Paragraph('Type', S['cell_b']),
            Paragraph('Date', S['cell_b']),
            Paragraph('Score', S['cell_b']),
            Paragraph('Statut', S['cell_b']),
        ]]
        for ep in epreuves:
            score = ep.get('score_total')
            score_str = f'{score:.1f}/20' if score is not None else '—'
            if score is not None:
                sc   = GREEN if score >= 12 else (ORANGE if score >= 10 else RED)
                score_p = Paragraph(f'<font color="#{sc.hexval()[1:]}">{score_str}</font>', S['pct'])
            else:
                score_p = Paragraph('—', S['cell'])

            date_str = '—'
            if ep.get('submitted_at'):
                try:
                    date_str = datetime.fromisoformat(ep['submitted_at']).strftime('%d/%m/%Y')
                except Exception:
                    pass

            statut_map = {'soumis': 'Soumis', 'corrige': 'Corrigé', 'en_cours': 'En cours'}
            ep_rows.append([
                Paragraph(ep.get('titre', '—')[:55], S['cell']),
                Paragraph(TYPE_LABELS.get(ep.get('type_epreuve', ''), '—'), S['cell']),
                Paragraph(date_str, S['cell']),
                score_p,
                Paragraph(statut_map.get(ep.get('statut', ''), ep.get('statut', '—')), S['cell']),
            ])

        cw_ep = [W * 0.36, W * 0.22, W * 0.14, W * 0.14, W * 0.14]
        ep_table = Table(ep_rows, colWidths=cw_ep, repeatRows=1)
        ep_table.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0),  BROWN),
            ('TEXTCOLOR',     (0, 0), (-1, 0),  WHITE),
            ('FONTNAME',      (0, 0), (-1, 0),  'Helvetica-Bold'),
            ('FONTSIZE',      (0, 0), (-1, 0),  8),
            ('ROWBACKGROUNDS',(0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
            ('LINEBELOW',     (0, 0), (-1, -1), 0.3, GRAY_PALE),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 6),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
            ('ALIGN',         (3, 0), (3, -1),  'RIGHT'),
            ('ROUNDEDCORNERS',[4, 4, 4, 4]),
        ]))
        story.append(ep_table)

    # ── Pied de page ─────────────────────────────────────────────────────────
    def footer_cb(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(GRAY)
        canvas.setFont('Helvetica', 7.5)
        footer_text = f'Bulletin généré le {now_str} · Plateforme STI – Tutorat Intelligent · Page {doc.page}'
        canvas.drawCentredString(A4[0] / 2, 14*mm, footer_text)
        canvas.restoreState()

    doc.build(story, onFirstPage=footer_cb, onLaterPages=footer_cb)
    buf.seek(0)
    return buf.read()
