/**
 * 把"某个 IANA 时区里的挂钟时间"转成正确的 UTC Date，处理夏令时切换。
 * 不能直接 `new Date(`${date}T${time}:00`)`——那是服务器自己的时区（Cloud Run 上是 UTC），
 * 不是门店所在地时区,会导致店主在后台看到的预约时间和顾客选的时间差好几个小时。
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(dtf.formatToParts(naiveUtc).map((p) => [p.type, p.value]))
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour)
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  )
  const offset = naiveUtc.getTime() - asIfUtc
  return new Date(naiveUtc.getTime() + offset)
}
