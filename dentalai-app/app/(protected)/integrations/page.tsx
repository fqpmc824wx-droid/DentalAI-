import { requireSession } from '@/lib/access'
import { getDentallyReadinessReport, type DentallyReadinessStatus } from '@/lib/dentally/readiness'
import {
  Banner,
  DataGrid,
  PageFoot,
  PageHeader,
  PageShell,
  SectionCard,
  SectionH,
  StatusPill,
} from '@/components/calm'

function statusIntent(status: DentallyReadinessStatus) {
  if (status === 'connected') return 'allow' as const
  if (status === 'degraded') return 'review' as const
  if (status === 'setup_required') return 'review' as const
  return 'block' as const
}

function humanStatus(status: DentallyReadinessStatus) {
  if (status === 'setup_required') return 'Setup required'
  return status
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default async function IntegrationsPage() {
  const actor = await requireSession()
  const canSeeSetup = actor.role === 'practice_manager' || actor.role === 'group_owner' || actor.role === 'super_admin'

  if (!canSeeSetup) {
    return (
      <PageShell>
        <PageHeader
          meta="Trust · Dentally"
          title={<>Integration <em>status</em>.</>}
          sub="This area is available to practice managers, group owners, and system administrators."
        />
        <Banner tone="warn">Your role can use the queue, identity, and rules surfaces, but not integration setup.</Banner>
        <PageFoot status="Role-protected admin surface · no secrets exposed" />
      </PageShell>
    )
  }

  const report = await getDentallyReadinessReport(actor)
  const mappedClinics = report.clinicMappings.filter(mapping => mapping.status === 'mapped').length
  const setupRequiredClinics = report.clinicMappings.filter(mapping => mapping.status === 'setup_required').length

  return (
    <PageShell wide>
      <PageHeader
        meta={`Dentally read-only proof · ${new Date(report.checkedAt).toLocaleString('en-GB', { timeZone: 'Europe/London' })}`}
        title={<>Dentally <em>readiness</em>.</>}
        sub="Read-only proof surface for token context, practice, sites, and safe clinic-to-site mapping. Formal re-run is still required. No Dentally writes are available here."
      />

      <SectionCard
        tone={report.status === 'connected' ? 'success' : report.status === 'unavailable' ? 'danger' : 'warn'}
        accent={report.status === 'connected' ? 'primary' : report.status === 'unavailable' ? 'block' : 'review'}
        label="Current state"
      >
        <div className="stack-row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
              Dentally is {humanStatus(report.status)}.
            </h2>
            <p className="micro" style={{ marginTop: 8 }}>
              Health probe: <span style={{ fontFamily: 'var(--font-mono)' }}>{report.health.probePath}</span> · {formatDuration(report.health.durationMs)}
            </p>
          </div>
          <StatusPill intent={statusIntent(report.status)}>{humanStatus(report.status)}</StatusPill>
        </div>
      </SectionCard>

      {report.warnings.length > 0 && (
        <Banner tone={report.status === 'unavailable' ? 'danger' : 'warn'}>
          {report.warnings.join(' · ')}
        </Banner>
      )}

      <SectionH label="Token context" meta="safe summary only" />
      <SectionCard label="Read-only proof">
        <DataGrid
          items={[
            { label: 'User', value: report.user?.name ?? report.user?.email ?? 'Not available', strong: true },
            { label: 'User ID', value: report.user?.id ?? '—', mono: true },
            { label: 'Practice', value: report.practice?.name ?? 'Not available', strong: true },
            { label: 'Practice ID', value: report.practice?.id ?? '—', mono: true },
            { label: 'Visible sites', value: String(report.visibleSiteCount), mono: true },
            { label: 'Mapped sites', value: String(report.mappedSiteCount), mono: true, tone: report.mappedSiteCount > 0 ? 'ok' : 'warn' },
            { label: 'Rollout candidates', value: String(report.rolloutCandidateCount), mono: true, tone: report.rolloutCandidateCount > 0 ? 'warn' : undefined },
            { label: 'Clinic setup required', value: String(setupRequiredClinics), mono: true, tone: setupRequiredClinics > 0 ? 'warn' : 'ok' },
          ]}
        />
      </SectionCard>

      <SectionH label="Clinic mapping" meta={`${mappedClinics} mapped · ${setupRequiredClinics} setup required`} />
      {report.clinicMappings.map(mapping => (
        <SectionCard
          key={mapping.clinicId}
          label={mapping.clinicId}
          accent={mapping.status === 'mapped' ? 'primary' : 'review'}
        >
          <div className="stack-row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <DataGrid
              items={[
                { label: 'Status', value: mapping.status === 'mapped' ? 'Mapped' : 'Setup required', tone: mapping.status === 'mapped' ? 'ok' : 'warn', strong: true },
                { label: 'Dentally site ID', value: mapping.status === 'mapped' ? mapping.dentallySiteId : '—', mono: true },
                { label: 'Note', value: mapping.status === 'mapped' ? mapping.note ?? '—' : 'No approved Dentally site binding yet.' },
              ]}
            />
            <StatusPill intent={mapping.status === 'mapped' ? 'allow' : 'review'}>{mapping.status === 'mapped' ? 'Mapped' : 'Needs setup'}</StatusPill>
          </div>
        </SectionCard>
      ))}

      <SectionH label="Sites visible to token" meta={`${report.sites.length} returned by Dentally`} />
      <SectionCard label="Rollout view">
        <div style={{ display: 'grid', gap: 12 }}>
          {report.sites.length === 0 && <p className="micro">No Dentally sites returned for this token yet.</p>}
          {report.sites.map(site => {
            const mapping = report.siteMappings.find(item => item.dentallySiteId === site.id)
            const mapped = mapping?.status === 'mapped'
            return (
              <div
                key={site.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{site.name}</div>
                  <div className="micro">
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{site.id}</span>
                    {site.postcode ? <> · {site.postcode}</> : null}
                  </div>
                </div>
                <StatusPill intent={mapped ? 'allow' : 'neutral'}>{mapped ? 'Mapped' : 'Disabled candidate'}</StatusPill>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <PageFoot status="Read-only proof under re-audit · no Dentally writes · no token exposed to browser bundle" />
    </PageShell>
  )
}
