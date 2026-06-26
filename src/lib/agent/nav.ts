export type NavButton = { path: string; label: string }

/**
 * Parse `[NAV:/path:label]` tags emitted by the agent into structured nav
 * buttons, returning the text with the tags stripped out. Shared by every
 * channel so the raw tags never leak into a user-facing message.
 */
export function parseNavTags(text: string): { cleanText: string; navButtons: NavButton[] } {
  const navButtons: NavButton[] = []
  const cleanText = text
    .replace(/\[NAV:([^\]]+)\]/g, (_, content: string) => {
      const colonIdx = content.indexOf(':')
      if (colonIdx === -1) return ''
      const path  = content.slice(0, colonIdx).trim()
      const label = content.slice(colonIdx + 1).trim()
      if (path && label) navButtons.push({ path, label })
      return ''
    })
    .trim()
  return { cleanText, navButtons }
}

/** Resolve a nav path to an absolute https URL for LINE quick-reply uri actions. */
export function toAbsoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://asia-bot.xyz').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
