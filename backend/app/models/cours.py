from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy import DateTime
import uuid
from ..database import Base


class Matiere(Base):
    """
    Niveau 1 — La discipline enseignée.
    Ex : Informatique, classe 1ère F6/F4, lycée classique Ebolowa
    """
    __tablename__ = "matieres"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom         = Column(String, nullable=False)       # "Informatique"
    niveau      = Column(String, nullable=False)       # "Seconde", "Première", "Terminale"
    description = Column(Text, nullable=True)
    actif       = Column(Boolean, default=True)


class Module(Base):
    """
    Niveau 2 — Grand regroupement du programme officiel.
    Correspond aux modules numérotés dans le programme camerounais.
    Ex : Module 2 — Réseaux, Internet, Humanités Numériques, Algorithmique
    """
    __tablename__ = "modules"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    matiere_id  = Column(UUID(as_uuid=True), ForeignKey("matieres.id"), nullable=False)
    numero      = Column(Integer, nullable=False)      # 1, 2, 3...
    titre       = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    ordre       = Column(Integer, default=1)
    actif       = Column(Boolean, default=True)


class FamilleSituation(Base):
    """
    Niveau 3 — Famille de situations de vie (concept clé de l'APC).
    Regroupe les UA qui traitent du même contexte d'apprentissage.
    Ex : PROGRAMMATION, RÉSEAUX, BASES DE DONNÉES
    """
    __tablename__ = "familles_situations"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id   = Column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    titre       = Column(String, nullable=False)       # "PROGRAMMATION EN C"
    description = Column(Text, nullable=True)
    ordre       = Column(Integer, default=1)


class UniteApprentissage(Base):
    """
    Niveau 4 — Unité d'Apprentissage (UA) avec ses Unités d'Enseignement (UE).
    C'est le niveau de la leçon dans le programme APC camerounais.
    Ex : UA "Instructions de base" — UE 15 & 16
    """
    __tablename__ = "unites_apprentissage"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    famille_id      = Column(UUID(as_uuid=True), ForeignKey("familles_situations.id"), nullable=False)
    titre           = Column(String, nullable=False)
    reference_ue    = Column(String, nullable=True)    # "UE 15 & 16", "UE 19"
    competences     = Column(JSON, nullable=True)      # liste des compétences visées APC
    # Ex: ["Identifier les structures de contrôle",
    #      "Exécuter un algorithme ayant une structure alternative"]
    situation_probleme = Column(Text, nullable=True)   # la situation problème de la fiche
    prerequis       = Column(JSON, nullable=True)      # connaissances pré-requises
    duree_estimee   = Column(Integer, default=60)      # en minutes
    ordre           = Column(Integer, default=1)
    actif           = Column(Boolean, default=True)


class RessourcePedagogique(Base):
    """
    Niveau 5 — Ressource pédagogique liée à une UA.
    Peut être une leçon théorique, un TP, un QCM ou une vidéo.
    Correspond à la 'trace écrite' de la fiche de préparation.
    """
    __tablename__ = "ressources_pedagogiques"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ua_id       = Column(UUID(as_uuid=True), ForeignKey("unites_apprentissage.id"), nullable=False)
    titre       = Column(String, nullable=False)
    type        = Column(
        Enum("lecon", "tp", "resume", "video", name="ressource_type"),
        default="lecon"
    )
    contenu     = Column(Text, nullable=False)         # Markdown — la trace écrite
    points_cles = Column(JSON, nullable=True)          # résumé en bullet points
    ordre       = Column(Integer, default=1)


class Exercice(Base):
    """
    Niveau 5 (bis) — Exercice d'évaluation lié à une UA.
    Types : QCM, texte à trou, réponse libre.
    Inclut les indices à 3 niveaux pour le tuteur IA.
    """
    __tablename__ = "exercices"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ua_id               = Column(UUID(as_uuid=True), ForeignKey("unites_apprentissage.id"), nullable=False)
    titre               = Column(String, nullable=False)
    type                = Column(
        Enum("qcm", "texte_trou", "reponse_libre", name="exercice_type"),
        nullable=False
    )
    enonce              = Column(Text, nullable=False)
    options             = Column(JSON, nullable=True)      # liste pour QCM
    reponse_correcte    = Column(Text, nullable=False)
    explication         = Column(Text, nullable=True)      # affiché après réponse
    indice_1            = Column(Text, nullable=True)      # indice lexical
    indice_2            = Column(Text, nullable=True)      # indice procédural
    # indice 3 = généré par l'IA conversationnelle
    competence_evaluee  = Column(String, nullable=True)    # quelle compétence APC cet exercice évalue
    difficulte          = Column(Integer, default=1)       # 1=facile, 2=moyen, 3=difficile
    points              = Column(Integer, default=10)
    ordre               = Column(Integer, default=1)


class ProgressionApprenant(Base):
    """
    Niveau 6 — Suivi individuel de chaque apprenant.
    Enregistre l'avancement par UA et par exercice.
    """
    __tablename__ = "progressions"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ua_id           = Column(UUID(as_uuid=True), ForeignKey("unites_apprentissage.id"), nullable=True)
    exercice_id     = Column(UUID(as_uuid=True), ForeignKey("exercices.id"), nullable=True)
    statut          = Column(
        Enum("non_commence", "en_cours", "termine", name="statut_enum"),
        default="non_commence"
    )
    score           = Column(Integer, default=0)
    tentatives      = Column(Integer, default=0)
    reponse_donnee  = Column(Text, nullable=True)
    correct         = Column(Boolean, nullable=True)
    date_debut      = Column(DateTime(timezone=True), nullable=True)
    date_fin        = Column(DateTime(timezone=True), nullable=True)