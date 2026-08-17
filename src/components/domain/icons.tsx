/**
 * Icon vocabulary. Lucide only, stroke 1.5, currentColor (README §11).
 * Status is never color-alone — every severity and every device state has a
 * distinct glyph so the UI survives a grayscale check.
 */

import {
  Axe,
  Cctv,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Cpu,
  Footprints,
  Mic,
  PawPrint,
  Radio,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Thermometer,
  Truck,
  TriangleAlert,
  User,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import type { DetectionClass, NodeType, Severity, NodeStatus } from '@/data/types'

export const CLASS_ICONS: Record<DetectionClass, LucideIcon> = {
  gunshot: Siren,
  chainsaw: Axe,
  vehicle: Truck,
  human: User,
  elephant: Footprints,
  tiger: PawPrint,
  leopard: PawPrint,
  wild_boar: PawPrint,
}

export const SEVERITY_ICONS: Record<Severity, LucideIcon> = {
  critical: ShieldAlert,
  warning: TriangleAlert,
  watch: CircleAlert,
  info: CircleDot,
}

export const NODE_TYPE_ICONS: Record<NodeType, LucideIcon> = {
  camera: Cctv,
  acoustic: Mic,
  thermal: Thermometer,
  gateway: Server,
}

export const NODE_STATUS_ICONS: Record<NodeStatus, LucideIcon> = {
  online: CircleCheck,
  degraded: TriangleAlert,
  offline: WifiOff,
}

export { Cpu, Radio, ShieldCheck, Siren }

/** Default icon props for consistency across the app. */
export const iconProps = { strokeWidth: 1.5, 'aria-hidden': true } as const
