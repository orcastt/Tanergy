'use client'

import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { useCanvasSettingsStore, type CanvasSettings } from '@/features/canvas-settings/canvasSettingsStore'

type CanvasSettingsPanelProps = {
  boardMode?: boolean
  onClose: () => void
}

const sections = ['Canvas', 'Interaction', 'Display']

function stopCanvasEvent(event: SyntheticEvent) {
  event.stopPropagation()
}

export function CanvasSettingsPanel({ boardMode = false, onClose }: CanvasSettingsPanelProps) {
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
          <button className={section === 'Canvas' ? 'is-active' : undefined} key={section} type="button">
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
            <h2>Canvas Settings</h2>
            <p>{boardMode ? 'Board-specific canvas background and alignment.' : 'Local canvas defaults for this browser.'}</p>
          </div>
          <button
            className="canvas-settings__save"
            onClick={() => {
              if (!boardMode) save()
              onClose()
            }}
            type="button"
          >
            {boardMode ? 'Done' : 'Save Settings'}
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

        <section className="canvas-settings__preview" data-background-style={settings.backgroundStyle}>
          <div
            style={{
              '--canvas-preview-background': settings.backgroundColor,
              '--canvas-preview-grid': settings.gridColor,
              '--canvas-preview-unit': `${settings.gridUnit}px`,
            } as CSSProperties}
          />
          <strong>{getBackgroundLabel(settings.backgroundStyle)}</strong>
        </section>

        <section className="canvas-settings__grid">
          <SettingTitle title="Background" subtitle="Canvas surface pattern" />
          <Segmented
            options={[['dots', 'Dots'], ['grid', 'Grid'], ['solid', 'Solid']]}
            value={settings.backgroundStyle}
            onChange={(backgroundStyle) => update({ backgroundStyle: backgroundStyle as CanvasSettings['backgroundStyle'] })}
          />
          <SettingTitle title="Snap Alignment" subtitle="Intelligently align elements" />
          <Toggle checked={settings.snapAlignment} onChange={(snapAlignment) => update({ snapAlignment })} />

          <SettingTitle title="Spacing" />
          <NumberPill value={settings.gridUnit} unit="px" onChange={(value) => setNumber('gridUnit', value)} />
          <SettingTitle title="Surface" />
          <ColorInput label="Background color" value={settings.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
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
          subtitle={`Strength: ${getSnapStrength(settings.snapDistance)}`}
          value={settings.snapDistance}
          onChange={(value) => setNumber('snapDistance', value)}
        />

        <SettingRow label="Pattern Color">
          <ColorInput label="Pattern color" value={settings.gridColor} onChange={(gridColor) => update({ gridColor })} />
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

function SettingRow({ children, label, subtitle }: { children: ReactNode; label: string; subtitle?: string }) {
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

function ColorInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <input
      aria-label={label}
      className="canvas-settings__color"
      type="color"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
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
    Canvas: '□',
    Display: '◉',
    Interaction: '⌁',
  }
  return icons[section] ?? '•'
}

function getBackgroundLabel(style: CanvasSettings['backgroundStyle']) {
  if (style === 'grid') return 'Fine grid background'
  if (style === 'solid') return 'Solid background'
  return 'Subtle dot background'
}

function getSnapStrength(value: number) {
  if (value < 10) return 'Soft'
  if (value > 28) return 'Strong'
  return 'Normal'
}
