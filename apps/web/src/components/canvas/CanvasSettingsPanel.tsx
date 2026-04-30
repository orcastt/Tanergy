'use client'

import type { SyntheticEvent } from 'react'
import { useCanvasSettingsStore, type CanvasSettings } from '@/features/canvas-settings/canvasSettingsStore'

type CanvasSettingsPanelProps = {
  onClose: () => void
}

const sections = ['Settings', 'Workspace', 'Referral', 'Appearance', 'AI Settings', 'Advanced']

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSettingsPanel({ onClose }: CanvasSettingsPanelProps) {
  const save = useCanvasSettingsStore((state) => state.save)
  const settings = useCanvasSettingsStore((state) => state.settings)
  const update = useCanvasSettingsStore((state) => state.update)

  const setNumber = (key: keyof CanvasSettings, value: string) => {
    update({ [key]: Number(value) } as Partial<CanvasSettings>)
  }

  return (
    <div
      className="canvas-settings"
      onDoubleClick={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <aside className="canvas-settings__sidebar">
        {sections.map((section) => (
          <button className={section === 'Settings' ? 'is-active' : undefined} key={section} type="button">
            <span aria-hidden>{getSectionIcon(section)}</span>
            {section}
          </button>
        ))}
        <div className="canvas-settings__user">
          <span>0</span>
          <strong>0657</strong>
        </div>
      </aside>

      <main className="canvas-settings__main">
        <header className="canvas-settings__header">
          <div>
            <h2>Save View</h2>
            <p>Save current grid style and colors, and keep them after refresh.</p>
          </div>
          <button
            className="canvas-settings__save"
            onClick={() => {
              save()
              onClose()
            }}
            type="button"
          >
            Save Settings
          </button>
          <button aria-label="Close settings" className="canvas-settings__close" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <section className="canvas-settings__language">
          <div>
            <strong>Interface Language</strong>
            <span>Switch between Chinese and English</span>
          </div>
          <Segmented
            options={[['zh', 'ZH'], ['en', 'EN']]}
            value={settings.language}
            onChange={(language) => update({ language: language as CanvasSettings['language'] })}
          />
        </section>

        <section className="canvas-settings__grid">
          <SettingTitle title="Grid Rendering" subtitle="Show background reference lines" />
          <Toggle checked={settings.gridRendering} onChange={(gridRendering) => update({ gridRendering })} />
          <SettingTitle title="Snap Alignment" subtitle="Intelligently align elements" />
          <Toggle checked={settings.snapAlignment} onChange={(snapAlignment) => update({ snapAlignment })} />

          <SettingTitle title="Style" />
          <Segmented
            options={[['grid', 'Grid'], ['solid', 'Solid']]}
            value={settings.gridStyle}
            onChange={(gridStyle) => update({ gridStyle: gridStyle as CanvasSettings['gridStyle'] })}
          />
          <SettingTitle title="Grid Unit" />
          <NumberPill value={settings.gridUnit} unit="px" onChange={(value) => setNumber('gridUnit', value)} />
        </section>

        <SettingRange
          label="Zoom Sensitivity"
          max={3}
          min={0.25}
          step={0.25}
          subtitle="Adjust damping feel"
          value={settings.zoomSensitivity}
          onChange={(value) => setNumber('zoomSensitivity', value)}
        />
        <SettingRange
          label="Snap Distance"
          max={48}
          min={2}
          step={1}
          subtitle="Distance in screen pixels before alignment guides catch"
          value={settings.snapDistance}
          onChange={(value) => setNumber('snapDistance', value)}
        />

        <SettingRow label="Grid Color">
          <input
            aria-label="Grid color"
            className="canvas-settings__color"
            type="color"
            value={settings.gridColor}
            onChange={(event) => update({ gridColor: event.currentTarget.value })}
          />
        </SettingRow>

        <SettingRow label="Edge Color" subtitle="Set how flow edge colors are displayed">
          <Segmented
            options={[['standard', 'Standard'], ['follow-handle', 'Follow Handle']]}
            value={settings.edgeColorMode}
            onChange={(edgeColorMode) => update({ edgeColorMode: edgeColorMode as CanvasSettings['edgeColorMode'] })}
          />
        </SettingRow>

        <SettingRow label="AI Chat Style">
          <Segmented
            options={[['transparent', 'Transparent'], ['solid', 'Solid']]}
            value={settings.aiChatStyle}
            onChange={(aiChatStyle) => update({ aiChatStyle: aiChatStyle as CanvasSettings['aiChatStyle'] })}
          />
        </SettingRow>
      </main>
    </div>
  )
}

function SettingTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="canvas-settings__title">
      <strong>{title}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  )
}

function SettingRange({
  label,
  max,
  min,
  onChange,
  step,
  subtitle,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (value: string) => void
  step: number
  subtitle: string
  value: number
}) {
  return (
    <SettingRow label={label} subtitle={subtitle}>
      <div className="canvas-settings__range">
        <input max={max} min={min} step={step} type="range" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
        <span>{value}</span>
      </div>
    </SettingRow>
  )
}

function SettingRow({ children, label, subtitle }: { children: React.ReactNode; label: string; subtitle?: string }) {
  return (
    <section className="canvas-settings__row">
      <SettingTitle title={label} subtitle={subtitle} />
      {children}
    </section>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      aria-pressed={checked}
      className="canvas-settings__toggle"
      data-active={checked ? 'true' : undefined}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span />
    </button>
  )
}

function Segmented({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void
  options: [string, string][]
  value: string
}) {
  return (
    <div className="canvas-settings__segmented">
      {options.map(([optionValue, label]) => (
        <button
          className={value === optionValue ? 'is-active' : undefined}
          key={optionValue}
          onClick={() => onChange(optionValue)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function NumberPill({ onChange, unit, value }: { onChange: (value: string) => void; unit: string; value: number }) {
  return (
    <label className="canvas-settings__number">
      <input value={value} type="number" min={8} max={128} onChange={(event) => onChange(event.currentTarget.value)} />
      <span>{unit}</span>
    </label>
  )
}

function getSectionIcon(section: string) {
  const icons: Record<string, string> = {
    Advanced: '⚡',
    Appearance: '◉',
    'AI Settings': '✣',
    Referral: '♧',
    Settings: '⚙',
    Workspace: '□',
  }
  return icons[section] ?? '•'
}
