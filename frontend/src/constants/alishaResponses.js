/**
 * Bibliothèque de réponses diversifiées d'Alisha.
 * Chaque catégorie contient 8–12 variantes pour éviter la répétition.
 *
 * Utilisation :
 *   import { pickResponse } from '../constants/alishaResponses'
 *   const text = pickResponse('correct')
 *
 * pickResponse() garantit qu'on ne répète jamais deux fois de suite
 * la même phrase dans la même catégorie (anti-repeat par localStorage).
 */

const RESPONSES = {

  // ── Bonne réponse ─────────────────────────────────────────────────
  correct: [
    "Exactement ! Tu viens de faire la bonne connexion — garde cet élan.",
    "Bravo ! Cette réponse montre que tu as vraiment compris le concept.",
    "C'est ça ! On avance bien ensemble.",
    "Parfait. Tu consolides ta maîtrise, continue comme ça.",
    "Oui ! Et tu sais quoi ? La première fois qu'on comprend quelque chose, on ne l'oublie plus.",
    "Tu as trouvé ! Prends un instant pour noter mentalement ce raisonnement.",
    "Bien joué. Souviens-toi de ce pas que tu viens de faire.",
    "Correct ! Chaque bonne réponse construit ta confiance. Tu le mérites.",
    "C'est bon ! Je savais que tu allais y arriver.",
    "Bonne réponse — et en plus tu l'as trouvée rapidement. Impressionnant.",
  ],

  // ── Mauvaise réponse ──────────────────────────────────────────────
  wrong: [
    "Pas encore — mais ton raisonnement montre que tu cherches dans la bonne direction.",
    "Ce n'est pas la bonne réponse, mais l'erreur est une étape. Regardons pourquoi.",
    "Presque ! Un petit ajustement et tu y es. On reprend ensemble ?",
    "Ce n'est pas ça — mais tu n'as pas abandonné, et c'est ce qui compte.",
    "Pas tout à fait. Reformulons le problème différemment pour t'aider.",
    "Hmm, il manque quelque chose. Tu veux un indice ou on relit la leçon ?",
    "Faux pour l'instant — mais dans quelques instants tu vas comprendre pourquoi.",
    "Ce n'est pas la bonne réponse. Mais attention, se tromper, c'est déjà apprendre.",
    "Raté cette fois. Ne te décourage pas — les meilleurs élèves font des erreurs aussi.",
    "Non, pas ça. Mais ton effort est visible. On va décomposer ça ensemble.",
  ],

  // ── Indice (hint) ─────────────────────────────────────────────────
  hint: [
    "Voici un indice : pense à ce que tu as vu dans la leçon précédente.",
    "Petit coup de pouce : concentre-toi sur le terme clé de la question.",
    "Indice : essaie d'éliminer les réponses qui te semblent évidemment fausses.",
    "Je t'aide un peu : relis l'énoncé lentement, mot par mot.",
    "Indice Alisha : quelle est la définition du concept principal ici ?",
    "Tu es proche. Pense à l'exemple qu'on a vu ensemble tout à l'heure.",
    "Un indice : si tu devais expliquer ça à un camarade, par quoi commencerais-tu ?",
    "Regarde la structure de la question — elle contient souvent la clé de la réponse.",
    "Pense à la règle générale, pas à l'exception. L'exception viendra plus tard.",
    "Indice : ce que tu cherches a un lien direct avec le titre de cette leçon.",
  ],

  // ── Encouragement général ─────────────────────────────────────────
  encouragement: [
    "Tu fais de beaux progrès. Continue à ce rythme.",
    "Je vois ta progression — et elle est réelle. Ne l'oublie pas.",
    "Les moments difficiles font partie de l'apprentissage. Tu gères très bien.",
    "Tu es ici, tu travailles. C'est déjà une victoire sur la procrastination.",
    "Chaque exercice que tu termines, même avec erreurs, te rapproche du but.",
    "La persévérance est la compétence la plus importante. Et tu l'as.",
    "Tu n'es peut-être pas encore expert·e, mais tu n'es plus débutant·e. Remarque la différence.",
    "Respire. Prends le temps qu'il faut. Je suis là avec toi.",
    "Ce que tu apprends aujourd'hui sera utile toute ta vie. Ça vaut l'effort.",
    "Je crois en toi. Maintenant c'est à toi d'y croire aussi.",
    "Les grands résultats commencent par de petites sessions régulières comme celle-ci.",
    "Sérieusement, tu t'améliores. Même si ça ne se voit pas encore de l'extérieur.",
  ],

  // ── Accueil / Welcome ─────────────────────────────────────────────
  welcome: [
    "Bienvenue ! Je suis Alisha, ta tutrice. On commence quand tu es prêt·e.",
    "Content de te revoir ! Prêt·e pour une nouvelle session d'apprentissage ?",
    "Salut ! Tu es revenu·e, c'est super. On reprend où on s'était arrêtés ?",
    "Hello ! Nouvelle session, nouvelle chance de progresser. C'est parti !",
    "Bonjour ! J'ai préparé quelques exercices adaptés à ton niveau. Allons-y !",
    "Te revoilà ! Ton parcours avance bien — regardons ce qu'on fait aujourd'hui.",
    "Bonne arrivée ! Je suis prête à t'accompagner. Par quoi on commence ?",
    "Bienvenue dans ta session. Prends un instant pour te concentrer, puis on démarre.",
  ],

  // ── En train de réfléchir (thinking) ─────────────────────────────
  thinking: [
    "Laisse-moi réfléchir à la meilleure façon d'expliquer ça…",
    "Je prépare une explication adaptée à ton niveau…",
    "Hmm… voyons comment formuler ça clairement.",
    "Un instant, je cherche la meilleure approche pour toi.",
    "Je prépare ta prochaine étape…",
    "Je fais le point sur ta progression pour te proposer la suite idéale.",
    "Analyse en cours… je t'ai réservé quelque chose d'intéressant.",
  ],

  // ── Célébration fin de module ─────────────────────────────────────
  celebration: [
    "INCROYABLE ! Tu viens de terminer ce module. C'est une vraie victoire !",
    "Félicitations ! Tu as parcouru un long chemin depuis le début. Sois fier·ère de toi.",
    "Module terminé ! Chaque UA que tu maîtrises te rapproche de l'excellence.",
    "C'est fait ! Ce travail que tu as fourni, personne ne peut te l'enlever.",
    "Bravo, champion·ne ! Tu viens de prouver à toi-même que c'était possible.",
    "Waouh ! Ce module est derrière toi. Le prochain n'attend plus que toi.",
    "Magnifique travail. Prends un moment pour apprécier ce que tu as accompli.",
    "Module bouclé ! C'est exactement ce genre de persévérance qui fait la différence.",
  ],

  // ── Streak maintenu ───────────────────────────────────────────────
  streak: [
    "🔥 Tu gardes ta flamme ! Chaque jour compte dans ton apprentissage.",
    "Encore un jour de plus ! Ta régularité est impressionnante.",
    "Streak maintenu ! La constance, c'est ton super-pouvoir.",
    "Tu es là encore aujourd'hui. Cette habitude va tout changer pour toi.",
    "Bravo pour la régularité ! Les meilleurs apprenants font exactement ça.",
    "Jour après jour ! Cette discipline va payer, je te le promets.",
    "Tu n'as pas raté un seul jour. C'est du sérieux !",
    "Ta flamme brille encore ! Continue à alimenter cet élan.",
  ],

  // ── Maîtrise faible (BKT p < 0.40) ──────────────────────────────
  bkt_low: [
    "Ce concept est encore en construction pour toi — c'est normal à ce stade.",
    "On reviendra sur cette notion. Chaque révision l'ancre un peu plus.",
    "Pas encore maîtrisé, mais tu as déjà tenté. C'est le premier pas.",
    "Ce thème mérite plus de pratique. Je vais te proposer des exercices adaptés.",
    "Le BKT indique que cette compétence a besoin de renforcement. On s'y met ?",
    "Rien d'inquiétant — certains concepts demandent plus de temps. On y revient.",
  ],

  // ── Bonne progression BKT (p 0.70–0.94) ─────────────────────────
  bkt_progress: [
    "Tu es en bonne voie ! Encore quelques exercices et tu maîtrises ce concept.",
    "Ta maîtrise progresse vraiment bien sur cette compétence.",
    "Continue comme ça — tu es à deux pas de la maîtrise complète.",
    "Belle progression ! Le graphique de ta maîtrise monte régulièrement.",
    "Tu y es presque. Encore un effort et ce concept sera acquis.",
    "Solide progression ! Tu as franchi un palier important.",
  ],

  // ── Maîtrise atteinte (BKT p >= 0.95) ────────────────────────────
  bkt_mastered: [
    "Compétence maîtrisée ! C'est officiel — ton cerveau a intégré ce concept.",
    "Bravo ! Cette compétence est dans ta boîte à outils pour toujours.",
    "Maîtrise confirmée par le système. Tu peux passer à la suite en confiance.",
    "Excellent ! Cette unité d'apprentissage est derrière toi. Et ça se mérite.",
    "Compétence acquise ! Tu viens de débloquer un nouveau niveau.",
    "C'est maîtrisé ! Ce travail que tu as fourni, ça se voit dans les résultats.",
  ],

  // ── Pas d'activité (idle / inactif) ──────────────────────────────
  idle: [
    "Tu es encore là ? Je reste disponible quand tu veux reprendre.",
    "Prends le temps qu'il te faut. Je suis là dès que tu es prêt·e.",
    "Petit instant de pause ? C'est bien aussi. Reviens quand tu veux.",
    "Je t'attends. La session reprend dès que tu te sens prêt·e.",
    "Pas de pression. L'apprentissage a son propre rythme.",
    "Je suis là, tranquille. On reprend à ton signal.",
  ],

  // ── Demande d'explication ─────────────────────────────────────────
  reexplain: [
    "Bien sûr ! Laisse-moi reformuler ça différemment.",
    "Pas de problème — voici une autre approche pour expliquer ce concept.",
    "On reprend depuis le début avec des mots différents. Écoute bien.",
    "Bonne idée de demander ! Une deuxième explication ancre mieux la notion.",
    "Je t'explique ça autrement. Parfois il faut plusieurs angles pour vraiment comprendre.",
    "D'accord — nouvelle tentative d'explication, avec un exemple concret cette fois.",
  ],

  // ── Invitation à la réflexion / question ouverte ──────────────────
  question: [
    "Prends ton temps pour réfléchir avant de répondre. La précipitation est l'ennemi.",
    "Lis bien l'énoncé en entier avant de choisir. Les mots comptent.",
    "Question : qu'est-ce que tu comprends en premier en lisant ça ?",
    "Réfléchis — et si tu ne sais pas, élimine d'abord ce qui est faux.",
    "Prends un moment. Il n'y a pas de chrono ici.",
    "Tu as toutes les clés en toi. Fais confiance à ce que tu as appris.",
    "Analyse la question, décortique-la. La réponse est là, dedans.",
  ],
}

// ── Anti-repeat : mémorise la dernière réponse par catégorie ─────
const lastPicked = {}

/**
 * Retourne une réponse aléatoire de la catégorie demandée.
 * Garantit qu'on ne retombe pas deux fois de suite sur la même phrase.
 *
 * @param {keyof typeof RESPONSES} category
 * @param {Object} [opts]
 * @param {string} [opts.studentName]  - Prénom à injecter si la phrase contient {name}
 * @returns {string}
 */
export function pickResponse(category, { studentName } = {}) {
  const pool = RESPONSES[category]
  if (!pool || pool.length === 0) return ''

  let idx
  if (pool.length === 1) {
    idx = 0
  } else {
    const last = lastPicked[category] ?? -1
    do { idx = Math.floor(Math.random() * pool.length) } while (idx === last)
  }

  lastPicked[category] = idx
  let text = pool[idx]
  if (studentName) text = text.replace(/\{name\}/g, studentName)
  return text
}

/**
 * Retourne toutes les réponses d'une catégorie (utile pour les tests).
 */
export function allResponses(category) {
  return RESPONSES[category] ?? []
}

export default RESPONSES
