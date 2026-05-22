export const AVATARS = [
  { id: 'student_boy_1',  emoji: '👦🏿' },
  { id: 'student_girl_1', emoji: '👧🏿' },
  { id: 'student_boy_2',  emoji: '👦🏾' },
  { id: 'student_girl_2', emoji: '👧🏾' },
  { id: 'scholar_1',      emoji: '🧑🏿‍🎓' },
  { id: 'scholar_2',      emoji: '👩🏾‍🎓' },
  { id: 'scholar_3',      emoji: '👨🏿‍🎓' },
  { id: 'scholar_4',      emoji: '🧑🏾‍🎓' },
  { id: 'coder_1',        emoji: '🧑🏿‍💻' },
  { id: 'coder_2',        emoji: '👩🏾‍💻' },
  { id: 'scientist_1',    emoji: '🧑🏿‍🔬' },
  { id: 'teacher_f',      emoji: '👩🏾‍🏫' },
  { id: 'teacher_m',      emoji: '👨🏿‍🏫' },
  { id: 'artist',         emoji: '🧑🏾‍🎨' },
  { id: 'lion',           emoji: '🦁' },
  { id: 'elephant',       emoji: '🐘' },
  { id: 'leopard',        emoji: '🐆' },
  { id: 'owl',            emoji: '🦉' },
  { id: 'eagle',          emoji: '🦅' },
  { id: 'parrot',         emoji: '🦜' },
  { id: 'books',          emoji: '📚' },
  { id: 'microscope',     emoji: '🔬' },
  { id: 'rocket',         emoji: '🚀' },
  { id: 'star',           emoji: '⭐' },
  { id: 'trophy',         emoji: '🏆' },
  { id: 'brain',          emoji: '🧠' },
  { id: 'globe',          emoji: '🌍' },
  { id: 'drum',           emoji: '🥁' },
  { id: 'seedling',       emoji: '🌱' },
  { id: 'sun',            emoji: '☀️' },
  { id: 'gem',            emoji: '💎' },
]

/** Retourne l'emoji correspondant à un avatar ID, ou null. */
export function getAvatarEmoji(avatarId) {
  if (!avatarId) return null
  return AVATARS.find(a => a.id === avatarId)?.emoji ?? null
}
