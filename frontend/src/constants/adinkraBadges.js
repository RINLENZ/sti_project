/**
 * Définition des 10 badges thématiques Adinkra.
 * Les conditions humaines sont affichées à l'utilisateur.
 * La logique de déverrouillage réelle est côté serveur (/api/gamification/award-xp).
 *
 * NOTE (étape 5.2) : le champ `symbole` (emoji) n'est plus le rendu principal.
 * Le frontend utilise désormais <AdinkraSymbol id={badge.id} /> (vrais SVG
 * vectoriels, voir src/components/adinkra/AdinkraSymbols.jsx). L'emoji est
 * conservé en fallback (anciens écrans, accessibilité de secours).
 */

export const ADINKRA_BADGES = [
  {
    id:          'nyame_nti',
    nom:         'Nyame Nti',
    symbole:     '🌟',
    couleur:     '#D4A853',
    description: 'Par la grâce — premier exercice réussi.',
    condition:   '1 exercice réussi',
    signification: 'Nyame Nti signifie "par la grâce de Dieu". Chaque voyage commence par un premier pas.',
    xp_reward:   50,
  },
  {
    id:          'sankofa',
    nom:         'Sankofa',
    symbole:     '🦅',
    couleur:     '#C4865A',
    description: 'Revenir pour apprendre encore — 3 sessions complétées.',
    condition:   '3 sessions complètes',
    signification: '"On peut revenir en arrière pour avancer." Compléter 3 sessions montre ta volonté de revenir apprendre.',
    xp_reward:   100,
  },
  {
    id:          'gye_nyame',
    nom:         'Gye Nyame',
    symbole:     '✨',
    couleur:     '#8B5CF6',
    description: 'Persévérance absolue — 5 jours consécutifs.',
    condition:   '5 jours consécutifs',
    signification: '"Sauf Dieu" — rien n\'est impossible à qui persévère. 5 jours de suite, c\'est une discipline réelle.',
    xp_reward:   200,
  },
  {
    id:          'akoma',
    nom:         'Akoma',
    symbole:     '❤️',
    couleur:     '#DC2626',
    description: 'Patience et endurance — 10 sessions sans abandonner.',
    condition:   '10 sessions complètes',
    signification: 'Akoma, le cœur, symbolise la patience et la tolérance. 10 sessions montrent que tu ne renonces pas.',
    xp_reward:   300,
  },
  {
    id:          'dwennimmen',
    nom:         'Dwennimmen',
    symbole:     '🦁',
    couleur:     '#6B3A2A',
    description: 'Force et humilité — 100 exercices tentés.',
    condition:   '100 exercices tentés',
    signification: 'Les cornes du bélier symbolisent la force dans l\'humilité. Tenter 100 exercices, même imparfaits, demande du courage.',
    xp_reward:   400,
  },
  {
    id:          'aya',
    nom:         'Aya',
    symbole:     '🌿',
    couleur:     '#0D9373',
    description: 'Endurance indestructible — 300 minutes cumulées.',
    condition:   '300 minutes d\'apprentissage',
    signification: 'La fougère Aya pousse partout et ne meurt pas. 5 heures d\'apprentissage cumulées, c\'est indestructible.',
    xp_reward:   350,
  },
  {
    id:          'bese_saka',
    nom:         'Bese Saka',
    symbole:     '💎',
    couleur:     '#0D9373',
    description: 'Abondance de savoir — 5 compétences maîtrisées.',
    condition:   '5 compétences à 95%+ BKT',
    signification: 'Le sac de noix de cola symbolise l\'abondance et la communauté. Maîtriser 5 compétences, c\'est bâtir une fondation solide.',
    xp_reward:   500,
  },
  {
    id:          'kramo_bone',
    nom:         'Kramo Bone',
    symbole:     '🎯',
    couleur:     '#2563EB',
    description: 'Excellence confirmée — 95% de réussite sur 10+ exercices.',
    condition:   '95% de réussite (min. 10 exercices)',
    signification: 'Kramo Bone rappelle de distinguer le vrai du faux. Atteindre 95% de précision montre une maîtrise authentique.',
    xp_reward:   450,
  },
  {
    id:          'sunsum',
    nom:         'Sunsum',
    symbole:     '🌙',
    couleur:     '#8B5CF6',
    description: 'Esprit en éveil — une session avec engagement ≥ 80%.',
    condition:   'Session avec engagement ≥ 80%',
    signification: 'Sunsum, l\'esprit ou l\'âme, représente la présence totale. Une session à 80%+ d\'engagement, c\'est être vraiment là.',
    xp_reward:   250,
  },
  {
    id:          'adinkrahene',
    nom:         'Adinkrahene',
    symbole:     '👑',
    couleur:     '#D4A853',
    description: 'Chef de tous les symboles — les 9 autres badges débloqués.',
    condition:   'Tous les 9 autres badges',
    signification: 'Adinkrahene, "chef des symboles Adinkra", représente la grandeur et le leadership. Tu les as tous.',
    xp_reward:   1000,
  },
]

/** Map id → badge pour accès O(1) */
export const BADGES_BY_ID = Object.fromEntries(
  ADINKRA_BADGES.map(b => [b.id, b])
)

export default ADINKRA_BADGES
