'use client'

import type { ComponentProps } from 'react'
import { createKonvaCanvasShellProps } from './konvaCanvasShellProps'
import { KonvaCanvasShell } from './KonvaCanvasShell'

export {
  createKonvaCanvasSpikeTransientUiProps,
  type CreateSpikeTransientUiPropsOptions,
} from './konvaCanvasSpikeTransientUiProps'

type ShellProps = Omit<ComponentProps<typeof KonvaCanvasShell>, 'shellRef'>

type CreateSpikeShellPropsOptions = {
  shellOptions: Parameters<typeof createKonvaCanvasShellProps>[0]
}

export function createKonvaCanvasSpikeShellProps({
  shellOptions,
}: CreateSpikeShellPropsOptions): ShellProps {
  return createKonvaCanvasShellProps(shellOptions)
}
