import ModalReEngagement from './ModalReEngagement.jsx'
import OverlayRegulationEmotion from './OverlayRegulationEmotion.jsx'
import ModalRappelCours from './ModalRappelCours.jsx'
import DialogOrientation from './DialogOrientation.jsx'
import ModalPauseLongue from './ModalPauseLongue.jsx'
import ToastNotification from './ToastNotification.jsx'
import BadgeChallenge from './BadgeChallenge.jsx'

export default function AdaptationOrchestrator({ adaptation, onDismiss }) {
  if (!adaptation?.action) return null

  const props = { adaptation, onDismiss }

  switch (adaptation.action) {
    case 'modal_re_engagement':           return <ModalReEngagement {...props} />
    case 'overlay_regulation_emotion':    return <OverlayRegulationEmotion {...props} />
    case 'modal_remediation':
    case 'modal_rappel_cours':            return <ModalRappelCours {...props} />
    case 'dialog_orientation':            return <DialogOrientation {...props} />
    case 'modal_pause_longue':            return <ModalPauseLongue {...props} />
    case 'toast_encouragement_transition':
    case 'toast_reconnaissance':          return <ToastNotification {...props} />
    case 'badge_challenge_bonus':         return <BadgeChallenge {...props} />
    default:                              return null
  }
}
