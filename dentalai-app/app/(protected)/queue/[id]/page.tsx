import { requireSession, canAccessClinic } from '@/lib/access'
import { getQueueItem, getQueueItemsForClinics } from '@/lib/queue/store'
import { openQueueItemForView, resolveAssigneeName } from '@/lib/queue/ownership-service'
import { buildQueueLockView } from '@/lib/queue/ownership'
import { buildPassToColleaguePanel } from '@/lib/queue/colleague-presence'
import { getAppointmentType } from '@/lib/rules/config'
import { MOCK_PATIENTS, lookupCallerByPhone } from '@/lib/mock/patients'
import { notFound } from 'next/navigation'
import BookingApprovalCard from '@/components/BookingApprovalCard'
import { checkDentallyHealth } from '@/lib/dentally/health'
import { resolveIntegrationBanner } from '@/lib/dentally/contracts/integration-states'
import { buildIdentitySession } from '@/lib/identity/scenarios'
import { mapScenarioToIdentityBadge } from '@/lib/queue/card-identity'
import { buildDentallyLinkPanel } from '@/lib/queue/dentally-link-panel'
import { buildSamePatientBanner } from '@/lib/queue/same-patient-banner'
import { buildDuplicateCallerAlert } from '@/lib/queue/duplicate-caller'
import { getClinic } from '@/lib/mock/clinics'

export default async function QueueItemPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSession()
  const { id } = await params

  let item = getQueueItem(id)
  if (!item) notFound()

  if (!canAccessClinic(actor, item.clinicId)) notFound()

  const openResult = openQueueItemForView(id, actor)
  if (openResult) item = openResult.item

  const assigneeName = resolveAssigneeName(item.assignedTo)
  const lockView = buildQueueLockView({
    item,
    actorUserId: actor.userId,
    assigneeName,
  })
  const clinicItems = getQueueItemsForClinics(actor.clinicIds)
  const passPanel = buildPassToColleaguePanel({
    item,
    actorUserId: actor.userId,
    clinicId: item.clinicId,
    allClinicItems: clinicItems,
  })

  const apptType = item.appointmentTypeId ? getAppointmentType(item.appointmentTypeId) : null
  const patient = item.patientId ? MOCK_PATIENTS.find(p => p.id === item.patientId) : null

  const lookup = lookupCallerByPhone(item.callerPhone)
  const identitySession = buildIdentitySession({
    rawCallerNumber: item.callerPhone,
    lookup,
    verified: item.callerState === 'confirmed',
  })
  const identityBadge = mapScenarioToIdentityBadge({
    scenario: identitySession.scenario,
    verified: identitySession.verified ?? false,
  })

  const health = await checkDentallyHealth()
  const integration = resolveIntegrationBanner({ healthStatus: health.status })
  const clinic = getClinic(item.clinicId)

  const dentallyLinkPanel = buildDentallyLinkPanel({
    showPanel: integration.showDentallyLinkPanel,
    identityBadge,
    callerState: item.callerState,
    patient: patient ?? null,
    integrationNote:
      integration.state !== 'connected'
        ? integration.nextAction
        : undefined,
  })

  const samePatientBanner = buildSamePatientBanner({
    currentItem: item,
    allItems: clinicItems,
  })

  const duplicateCallerAlert = buildDuplicateCallerAlert({
    item,
    allItems: clinicItems,
  })

  return (
    <BookingApprovalCard
      item={item}
      apptType={apptType ?? null}
      patient={patient ?? null}
      actor={actor}
      dentallyLinkPanel={dentallyLinkPanel}
      clinicName={clinic?.name}
      assigneeName={assigneeName}
      lockView={lockView}
      passPanel={passPanel}
      readOnly={openResult?.readOnly ?? lockView.readOnlyForActor}
      samePatientBanner={samePatientBanner}
      duplicateCallerAlert={duplicateCallerAlert}
    />
  )
}
