import { requireSession, canAccessClinic } from '@/lib/access'
import { getQueueItem } from '@/lib/queue/store'
import { getAppointmentType } from '@/lib/rules/config'
import { MOCK_PATIENTS } from '@/lib/mock/patients'
import { notFound } from 'next/navigation'
import BookingApprovalCard from '@/components/BookingApprovalCard'

export default async function QueueItemPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSession()
  const { id } = await params

  const item = getQueueItem(id)
  if (!item) notFound()

  // Use canAccessClinic so group_owner can access items across their clinics
  if (!canAccessClinic(actor, item.clinicId)) notFound()

  const apptType = item.appointmentTypeId ? getAppointmentType(item.appointmentTypeId) : null
  const patient = item.patientId ? MOCK_PATIENTS.find(p => p.id === item.patientId) : null

  return <BookingApprovalCard item={item} apptType={apptType ?? null} patient={patient ?? null} actor={actor} />
}
