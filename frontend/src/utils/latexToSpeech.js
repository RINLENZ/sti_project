/**
 * Convertit une expression LaTeX/KaTeX en texte français lisible à voix haute.
 * Conçu pour les maths, physique et chimie du lycée camerounais (Terminale).
 *
 * Usage :
 *   import { latexToFrench } from './latexToSpeech'
 *   latexToFrench('\\frac{x^2+1}{x-3}')  // → "x au carré plus 1, sur x moins 3"
 */

// ── Lettres grecques ─────────────────────────────────────────────────
const GREEK = {
  '\\alpha': 'alpha', '\\beta': 'bêta', '\\gamma': 'gamma',
  '\\delta': 'delta', '\\Delta': 'delta', '\\epsilon': 'epsilon',
  '\\varepsilon': 'epsilon', '\\zeta': 'zêta', '\\eta': 'êta',
  '\\theta': 'thêta', '\\Theta': 'thêta', '\\iota': 'iota',
  '\\kappa': 'kappa', '\\lambda': 'lambda', '\\Lambda': 'lambda',
  '\\mu': 'mu', '\\nu': 'nu', '\\xi': 'xi', '\\Xi': 'xi',
  '\\pi': 'pi', '\\Pi': 'pi', '\\rho': 'rho', '\\sigma': 'sigma',
  '\\Sigma': 'sigma', '\\tau': 'tau', '\\upsilon': 'upsilon',
  '\\phi': 'phi', '\\Phi': 'phi', '\\chi': 'chi', '\\psi': 'psi',
  '\\Psi': 'psi', '\\omega': 'oméga', '\\Omega': 'oméga',
}

// ── Symboles simples ─────────────────────────────────────────────────
const SYMBOLS = {
  '\\infty':  'l\'infini',
  '\\approx': 'environ',
  '\\neq':    'différent de',
  '\\ne':     'différent de',
  '\\leq':    'inférieur ou égal à',
  '\\le':     'inférieur ou égal à',
  '\\geq':    'supérieur ou égal à',
  '\\ge':     'supérieur ou égal à',
  '\\lt':     'inférieur à',
  '\\gt':     'supérieur à',
  '\\pm':     'plus ou moins',
  '\\mp':     'moins ou plus',
  '\\times':  'fois',
  '\\cdot':   'fois',
  '\\div':    'divisé par',
  '\\forall': 'pour tout',
  '\\exists': 'il existe',
  '\\in':     'appartient à',
  '\\notin':  'n\'appartient pas à',
  '\\subset': 'inclus dans',
  '\\cup':    'union',
  '\\cap':    'intersection',
  '\\emptyset':'l\'ensemble vide',
  '\\varnothing': 'l\'ensemble vide',
  '\\to':     'vers',
  '\\rightarrow': 'vers',
  '\\Rightarrow': 'implique',
  '\\Leftrightarrow': 'équivaut à',
  '\\leftrightarrow': 'équivaut à',
  '\\iff':    'si et seulement si',
  '\\equiv':  'est équivalent à',
  '\\sim':    'est similaire à',
  '\\propto': 'est proportionnel à',
  '\\nabla':  'nabla',
  '\\partial':'dérivée partielle de',
  '\\prime':  'prime',
  '\\degree': 'degrés',
  '\\circ':   'degrés',
  '\\%':      'pourcent',
  '\\ldots':  'et ainsi de suite',
  '\\cdots':  'et ainsi de suite',
}

// ── Fonctions mathématiques ──────────────────────────────────────────
const FUNCTIONS = {
  '\\sin': 'sinus', '\\cos': 'cosinus', '\\tan': 'tangente',
  '\\arcsin': 'arc sinus', '\\arccos': 'arc cosinus', '\\arctan': 'arc tangente',
  '\\sinh': 'sinus hyperbolique', '\\cosh': 'cosinus hyperbolique', '\\tanh': 'tangente hyperbolique',
  '\\ln': 'logarithme népérien', '\\log': 'logarithme', '\\exp': 'exponentielle',
  '\\det': 'déterminant', '\\dim': 'dimension', '\\ker': 'noyau', '\\Im': 'partie imaginaire',
  '\\Re': 'partie réelle', '\\arg': 'argument', '\\max': 'maximum', '\\min': 'minimum',
  '\\lim': 'limite', '\\inf': 'infimum', '\\sup': 'supremum',
  '\\gcd': 'PGCD', '\\lcm': 'PPCM', '\\mod': 'modulo',
}

// ── Exposants spéciaux ───────────────────────────────────────────────
function ordinalFr(n) {
  if (n === '1') return 'premier'
  if (n === '2') return 'au carré'
  if (n === '3') return 'au cube'
  const num = parseInt(n, 10)
  if (!isNaN(num)) return `à la puissance ${num}`
  return `à la puissance ${n}`
}

// ── Extraction d'un groupe LaTeX { ... } ────────────────────────────
// Retourne [contenu, indexFin]
function extractGroup(str, start) {
  if (str[start] !== '{') {
    // Char unique
    return [str[start] || '', start + 1]
  }
  let depth = 0, i = start
  while (i < str.length) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) return [str.slice(start + 1, i), i + 1]
    }
    i++
  }
  return [str.slice(start + 1), str.length]
}

// ── Convertisseur principal ──────────────────────────────────────────
export function latexToFrench(input) {
  if (!input) return ''
  let s = String(input).trim()

  // Supprimer les délimiteurs de bloc $$ ... $$
  s = s.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim()

  // Traitement itératif des commandes LaTeX
  let result = ''
  let i = 0

  while (i < s.length) {
    // Commande LaTeX : \commande
    if (s[i] === '\\') {
      // Chercher le nom de la commande
      let j = i + 1
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      const cmd = s.slice(i, j)

      // Grec
      if (GREEK[cmd]) { result += ' ' + GREEK[cmd]; i = j; continue }
      // Symboles
      if (SYMBOLS[cmd]) { result += ' ' + SYMBOLS[cmd]; i = j; continue }
      // Fonctions
      if (FUNCTIONS[cmd]) { result += ' ' + FUNCTIONS[cmd]; i = j; continue }

      // Commandes structurelles
      if (cmd === '\\frac') {
        const [num, j2] = extractGroup(s, j)
        const [den, j3] = extractGroup(s, j2)
        result += ` ${latexToFrench(num)} sur ${latexToFrench(den)}`
        i = j3; continue
      }
      if (cmd === '\\sqrt') {
        // Vérifier si c'est \sqrt[n]{x}
        let jj = j
        if (s[jj] === '[') {
          const end = s.indexOf(']', jj)
          const n = s.slice(jj + 1, end)
          jj = end + 1
          const [arg, jj2] = extractGroup(s, jj)
          result += ` racine ${ordinalFr(n)}ième de ${latexToFrench(arg)}`
          i = jj2; continue
        }
        const [arg, j2] = extractGroup(s, jj)
        result += ` racine carrée de ${latexToFrench(arg)}`
        i = j2; continue
      }
      if (cmd === '\\int') {
        // \int_{a}^{b}
        let jj = j, lower = '', upper = ''
        if (s[jj] === '_') { const [l, jj2] = extractGroup(s, jj + 1); lower = l; jj = jj2 }
        if (s[jj] === '^') { const [u, jj2] = extractGroup(s, jj + 1); upper = u; jj = jj2 }
        result += ` intégrale${lower ? ` de ${latexToFrench(lower)}` : ''}${upper ? ` à ${latexToFrench(upper)}` : ''} de`
        i = jj; continue
      }
      if (cmd === '\\sum') {
        let jj = j, lower = '', upper = ''
        if (s[jj] === '_') { const [l, jj2] = extractGroup(s, jj + 1); lower = l; jj = jj2 }
        if (s[jj] === '^') { const [u, jj2] = extractGroup(s, jj + 1); upper = u; jj = jj2 }
        result += ` somme${lower ? ` de ${latexToFrench(lower)}` : ''}${upper ? ` à ${latexToFrench(upper)}` : ''}`
        i = jj; continue
      }
      if (cmd === '\\prod') {
        let jj = j, lower = '', upper = ''
        if (s[jj] === '_') { const [l, jj2] = extractGroup(s, jj + 1); lower = l; jj = jj2 }
        if (s[jj] === '^') { const [u, jj2] = extractGroup(s, jj + 1); upper = u; jj = jj2 }
        result += ` produit${lower ? ` de ${latexToFrench(lower)}` : ''}${upper ? ` à ${latexToFrench(upper)}` : ''}`
        i = jj; continue
      }
      if (cmd === '\\lim') {
        let jj = j
        if (s[jj] === '_') { const [l, jj2] = extractGroup(s, jj + 1); result += ` limite quand ${latexToFrench(l)}`; jj = jj2 }
        else result += ' limite'
        i = jj; continue
      }
      if (cmd === '\\overrightarrow' || cmd === '\\vec') {
        const [arg, j2] = extractGroup(s, j)
        result += ` vecteur ${latexToFrench(arg)}`
        i = j2; continue
      }
      if (cmd === '\\overline') {
        const [arg, j2] = extractGroup(s, j)
        result += ` barre de ${latexToFrench(arg)}`
        i = j2; continue
      }
      if (cmd === '\\hat' || cmd === '\\widehat') {
        const [arg, j2] = extractGroup(s, j)
        result += ` chapeau ${latexToFrench(arg)}`
        i = j2; continue
      }
      if (cmd === '\\left' || cmd === '\\right' || cmd === '\\big'
          || cmd === '\\Big' || cmd === '\\bigg' || cmd === '\\Bigg') {
        // Skip sizing commands, garder le symbole suivant
        i = j; continue
      }
      if (cmd === '\\text' || cmd === '\\textbf' || cmd === '\\textrm' || cmd === '\\mathrm') {
        const [arg, j2] = extractGroup(s, j)
        result += ' ' + arg
        i = j2; continue
      }
      if (cmd === '\\begin' || cmd === '\\end') {
        // Skip \begin{...} \end{...} (matrices, environments)
        const [, j2] = extractGroup(s, j)
        i = j2; continue
      }
      if (cmd === '\\\\') { result += ', '; i = j; continue }
      if (cmd === '\\,') { i = j; continue }  // thin space
      if (cmd === '\\;') { i = j; continue }  // medium space
      if (cmd === '\\!') { i = j; continue }  // negative space
      if (cmd === '\\quad' || cmd === '\\qquad') { i = j; continue }

      // Commande inconnue → skip la commande, garder le reste
      i = j; continue
    }

    // Exposant : x^{n} ou x^n
    if (s[i] === '^') {
      const [exp, j] = extractGroup(s, i + 1)
      const fr = latexToFrench(exp)
      // Cas spéciaux
      if (fr === '-1') result += ' inverse'
      else if (fr === '0') result += ' puissance zéro'
      else result += ' ' + ordinalFr(fr)
      i = j; continue
    }

    // Indice : x_{n} ou x_n
    if (s[i] === '_') {
      const [sub, j] = extractGroup(s, i + 1)
      const fr = latexToFrench(sub)
      result += ' indice ' + fr
      i = j; continue
    }

    // Groupes { ... } → lire le contenu
    if (s[i] === '{') {
      const [inner, j] = extractGroup(s, i)
      result += ' ' + latexToFrench(inner)
      i = j; continue
    }
    if (s[i] === '}') { i++; continue }

    // Parenthèses, crochets
    if (s[i] === '(') { result += ', '; i++; continue }
    if (s[i] === ')') { result += ','; i++; continue }
    if (s[i] === '[') { result += ', '; i++; continue }
    if (s[i] === ']') { result += ','; i++; continue }

    // Opérateurs de base
    if (s[i] === '+') { result += ' plus'; i++; continue }
    if (s[i] === '-') { result += ' moins'; i++; continue }
    if (s[i] === '*') { result += ' fois'; i++; continue }
    if (s[i] === '/') { result += ' sur'; i++; continue }
    if (s[i] === '=') { result += ' égal'; i++; continue }
    if (s[i] === '<') { result += ' inférieur à'; i++; continue }
    if (s[i] === '>') { result += ' supérieur à'; i++; continue }
    if (s[i] === '|') { result += ' valeur absolue de'; i++; continue }
    if (s[i] === ',') { result += ' virgule'; i++; continue }

    // Caractère normal → garder
    result += s[i]; i++
  }

  // Nettoyage final
  return result
    .replace(/\s+/g, ' ')
    .replace(/ ([,;.!?])/g, '$1')
    .trim()
}

/**
 * Convertit un tableau de blocs RichContent en texte lisible à voix haute.
 * Gère les types : titre, texte, alerte, tableau, markdown, image.
 */
export function blocksToSpeech(blocks) {
  if (!blocks?.length) return ''
  const parts = []

  for (const block of blocks) {
    switch (block.type) {
      case 'titre': {
        const pause = block.niveau === 'h1' ? '... ' : '. '
        parts.push(pause + block.valeur + '.')
        break
      }
      case 'texte': {
        // Retirer les formules LaTeX inline $...$ et les remplacer par leur version orale
        const spoken = block.valeur.replace(/\$([^$]+)\$/g, (_, latex) => ' ' + latexToFrench(latex))
        parts.push(spoken)
        break
      }
      case 'alerte': {
        const prefix = {
          info: 'Information :',
          warning: 'Attention :',
          success: 'Bon à savoir :',
          danger: 'Important :',
        }[block.style] || 'Note :'
        parts.push(prefix + ' ' + block.valeur)
        break
      }
      case 'tableau': {
        const headers = block.entetes?.join(', ') || ''
        const nbRows  = block.lignes?.length || 0
        parts.push(`Tableau${headers ? ` avec les colonnes ${headers}` : ''}, ${nbRows} ligne${nbRows > 1 ? 's' : ''}.`)
        // Lire les lignes si peu nombreuses
        if (nbRows <= 5 && block.lignes) {
          for (const row of block.lignes) {
            parts.push(row.join(' : '))
          }
        }
        break
      }
      case 'image': {
        if (block.legende || block.alt) {
          parts.push(`Illustration : ${block.legende || block.alt}.`)
        }
        break
      }
      case 'markdown': {
        // Retirer la syntaxe Markdown et LaTeX
        const cleaned = block.valeur
          // Formules display $$...$$
          .replace(/\$\$([^$]+)\$\$/g, (_, latex) => latexToFrench(latex))
          // Formules inline $...$
          .replace(/\$([^$\n]+)\$/g, (_, latex) => ' ' + latexToFrench(latex))
          // Titres
          .replace(/^#{1,6}\s+/gm, '')
          // Bold, italic
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          // Code inline
          .replace(/`[^`]+`/g, '')
          // Blocs code
          .replace(/```[\s\S]*?```/g, '')
          // Liens
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          // Images
          .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
          // Listes → virgule
          .replace(/^[-*]\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '')
          // Lignes vides multiples → pause
          .replace(/\n{2,}/g, '. ')
          .replace(/\n/g, ' ')
        parts.push(cleaned)
        break
      }
      default: break
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Découpe un texte long en segments prononçables (~180 chars max, sur les phrases).
 * Utilisé pour la lecture séquentielle par useAlishaVoice.
 */
export function splitSpeechChunks(text, maxLen = 180) {
  const sentences = text.replace(/([.!?;])\s+/g, '$1\n').split('\n').filter(Boolean)
  const chunks = []
  let current = ''
  for (const s of sentences) {
    if ((current + ' ' + s).length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    } else {
      current = current ? current + ' ' + s : s
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
