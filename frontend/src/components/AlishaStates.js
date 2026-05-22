/**
 * AlishaStates.js — Définitions d'états, palette Sensia
 */

export const STATES = [
  { id: 'idle',         label: 'Repos',         emoji: '😌', group: 'base'     },
  { id: 'thinking',     label: 'Réflexion',     emoji: '🤔', group: 'base'     },
  { id: 'speaking',     label: 'Parle',         emoji: '🗣️', group: 'base'     },
  { id: 'correct',      label: 'Correct',       emoji: '✅', group: 'feedback' },
  { id: 'wrong',        label: 'Erreur',        emoji: '💙', group: 'feedback' },
  { id: 'question',     label: 'Question',      emoji: '❓', group: 'base'     },
  { id: 'welcome',      label: 'Bienvenue',     emoji: '👋', group: 'base'     },
  { id: 'loading',      label: 'Chargement',    emoji: '⏳', group: 'system'   },
  { id: 'celebration',  label: 'Célébration',   emoji: '🎉', group: 'feedback' },
  { id: 'hint',         label: 'Indice',        emoji: '💡', group: 'base'     },
  { id: 'confused',     label: 'Confus',        emoji: '😕', group: 'base'     },
  { id: 'listening',    label: 'Écoute',        emoji: '👂', group: 'base'     },
  { id: 'typing',       label: 'Rédige',        emoji: '⌨️', group: 'base'     },
  { id: 'excited',      label: 'Excitée',       emoji: '🤩', group: 'feedback' },
  { id: 'focus',        label: 'Focus',         emoji: '🎯', group: 'base'     },
  { id: 'sleep',        label: 'Repos',         emoji: '😴', group: 'system'   },
  { id: 'networkError', label: 'Erreur réseau', emoji: '📡', group: 'system'   },
]

export const BUBBLES = {
  idle:        "Salut ! Je suis Alisha, ton assistante Sensia. On commence quand tu veux.",
  thinking:    "Hmm… laisse-moi trouver la meilleure façon d'expliquer ça.",
  speaking:    "Écoute bien — c'est un concept clé pour la suite.",
  correct:     "C'est ça ! Tu viens de faire une vraie connexion. Garde cet élan !",
  wrong:       "Pas encore — mais tu progresses. Regardons ça ensemble.",
  question:    "Question : prends ton temps, réfléchis bien.",
  welcome:     "Bienvenue ! On commence quand tu es prêt·e.",
  loading:     "Je prépare ta leçon personnalisée…",
  celebration: "INCROYABLE ! Tu viens de terminer le module. Bravo !",
  hint:        "Petit indice : pense à ce qui freine sans arrêter complètement.",
  confused:    "Je sens que quelque chose n'est pas clair — reformulons ensemble.",
  listening:   "Je t'écoute. Dis-moi ce que tu as compris, sans pression.",
  typing:      "Je rédige une explication adaptée à ton niveau…",
  excited:     "Attends — cette partie est vraiment fascinante !",
  focus:       "Mode concentration. On y va, toi et moi.",
  sleep:       "Tu es encore là ? Je reste disponible quand tu reviens.",
  networkError:"Connexion instable — ta progression est sauvegardée.",
}

// Accent couleur Sensia par état
export const STATE_ACCENT = {
  idle:        '#D4A853',
  thinking:    '#9B72D6',
  speaking:    '#D4A853',
  correct:     '#0D9373',
  wrong:       '#4A9EDB',
  question:    '#D4A853',
  welcome:     '#D4A853',
  loading:     '#9C7E6A',
  celebration: '#D4A853',
  hint:        '#D4A853',
  confused:    '#6B7FD6',
  listening:   '#D4A853',
  typing:      '#9B72D6',
  excited:     '#E845C8',
  focus:       '#D4A853',
  sleep:       '#8896B0',
  networkError:'#DB6A4A',
}
