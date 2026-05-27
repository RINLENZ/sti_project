export function getNotifUrl(notif) {
  switch (notif.type) {
    case 'badge_debloque':       return '/profil'
    case 'competence_maitrisee': return '/dashboard'
    case 'competence_progres':   return '/dashboard'
    case 'session_terminee':     return '/dashboard'
    case 'enseignant_lie':       return '/profil'
    case 'apprenant_lie':        return '/prof'
    case 'apprenant_session':    return '/prof'
    case 'apprenant_decrocheur': return '/prof'
    default:                     return null
  }
}
