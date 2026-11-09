import type { Visibility } from '../domain'

export type ListOccasion = 'birthday' | 'christmas'
/** Presentation only: no stored values, visibility or sharing permissions change. */
export function listOccasion(title: string, visibility: Visibility): ListOccasion | null {
  if (visibility === 'private') return null
  const name = title.normalize('NFKC').toLocaleLowerCase('de')
  const birthday = name.includes('geburtstag')
  const christmas = name.includes('weihnacht')
  // A combined wish list has no single occasion; retain the normal styling.
  if (birthday === christmas) return null
  return birthday ? 'birthday' : 'christmas'
}
