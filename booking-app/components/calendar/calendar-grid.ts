import { parseISO } from 'date-fns'

export const HOUR_HEIGHT = 64
export const START_HOUR = 8
export const END_HOUR = 20

export function timeToTopPx(timeStr: string): number {
  const d = parseISO(timeStr)
  const hours = d.getHours() - START_HOUR
  const minutes = d.getMinutes()
  return (hours * 60 + minutes) * (HOUR_HEIGHT / 60)
}

export function durationToHeightPx(startStr: string, endStr: string): number {
  const start = parseISO(startStr)
  const end = parseISO(endStr)
  const durationMin = (end.getTime() - start.getTime()) / 60000
  return durationMin * (HOUR_HEIGHT / 60)
}
