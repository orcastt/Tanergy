'use client'

import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { useCanvasSettingsStore, type CanvasSettings } from '@/features/canvas-settings/canvasSettingsStore'

type CanvasSettingsPanelProps = {
  boardMode?: boolean
  onClose: () => void
}

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
      <header className="canvas-settings__header">
        <h2>Canvas Settings</h2>
        <div className="canvas-settings__actions">
          <button
            className="canvas-settings__save"
            onClick={() => {
              if (!boardMode) save()
              onClose()
            }}
            type="button"
          >
            Done
          </button>
          <button aria-label="Close settings" className="canvas-settings__close" onClick={onClose} type="button">×</button>
        </div>
      </header>

      <main className="canvas-settings__main">
        <div className="canvas-settings__cards">
          <section className="canvas-settings__card">
            <h3>Background Settings</h3>
            <SettingRow label="Pattern" subtitle="Canvas surface pattern">
              <Segmented
                options={[['dots', 'Dots'], ['grid', 'Grid'], ['solid', 'Solid']]}
                value={settings.backgroundStyle}
                onChange={(backgroundStyle) => update({ backgroundStyle: backgroundStyle as CanvasSettings['backgroundStyle'] })}
              />
            </SettingRow>
            <SettingRow label="Background Color" subtitle="Base canvas surface">
              <ColorInput label="Background color" value={settings.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
            </SettingRow>
            <SettingRow label="Spacing" subtitle={`${settings.gridUnit}px grid spacing`}>
              <NumberPill value={settings.gridUnit} unit="px" onChange={(value) => setNumber('gridUnit', value)} />
            </SettingRow>
          </section>

          <section className="canvas-settings__card">
            <h3>Editor Behavior</h3>
            <SettingRow label="Snap Alignment" subtitle="Snap alignment in the canvas.">
              <Toggle checked={settings.snapAlignment} onChange={(snapAlignment) => update({ snapAlignment })} />
            </SettingRow>
            <SettingRange label="Snap Distance" max={48} min={2} step={1} value={settings.snapDistance} onChange={(value) => setNumber('snapDistance', value)} />
            <SettingRow label="Smart Drawing" subtitle="Clean up simple strokes.">
              <Toggle checked={settings.smartDrawing} onChange={(smartDrawing) => update({ smartDrawing })} />
            </SettingRow>
          </section>

          <section className="canvas-settings__card">
            <h3>View Controls</h3>
            <SettingRange label="Zoom Sensitivity" max={3} min={0.25} step={0.25} value={settings.zoomSensitivity} onChange={(value) => setNumber('zoomSensitivity', value)} />
            <SettingRow label="Edge Color" subtitle="Standard with edge color">
              <Segmented
                options={[['standard', 'Standard'], ['follow-handle', 'Color']]}
                value={settings.edgeColorMode}
                onChange={(edgeColorMode) => update({ edgeColorMode: edgeColorMode as CanvasSettings['edgeColorMode'] })}
              />
            </SettingRow>
          </section>

          <section className="canvas-settings__card">
            <h3>Interface</h3>
            <SettingRow label="Theme" subtitle="Canvas and node colors">
              <Segmented options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} value={settings.themeMode} onChange={(themeMode) => update({ themeMode: themeMode as CanvasSettings['themeMode'] })} />
            </SettingRow>
            <SettingRow label="Language" subtitle="Language interface control">
              <Segmented options={[['en', 'EN'], ['zh', 'ZH']]} value={settings.language} onChange={(language) => update({ language: language as CanvasSettings['language'] })} />
            </SettingRow>
            <SettingRow label="AI Chat Style" subtitle="AI Chat control style">
              <Segmented options={[['transparent', 'Transparent'], ['solid', 'Solid']]} value={settings.aiChatStyle} onChange={(aiChatStyle) => update({ aiChatStyle: aiChatStyle as CanvasSettings['aiChatStyle'] })} />
            </SettingRow>
          </section>
        </div>
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

function SettingRange({ label, max, min, onChange, step, value }: {
  label: string
  max: number
  min: number
  onChange: (value: string) => void
  step: number
  value: number
}) {
  return (
    <SettingRow label={label}>
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
    <label className="canvas-settings__color" title={`${label}: ${value}`}>
      <span style={{ '--canvas-settings-color': value } as CSSProperties} />
      <input
        aria-label={label}
        type="color"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
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
