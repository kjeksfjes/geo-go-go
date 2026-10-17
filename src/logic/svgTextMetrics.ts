// WebKit's getComputedTextLength can omit CSS letter-spacing even though the
// glyphs are laid out with it: https://bugs.webkit.org/show_bug.cgi?id=324266
// Character positions and the ink bounds include the rendered spacing. Read
// both so italic overhangs and a browser's trailing advance are covered too.
export function spacedSvgTextWidth(element: SVGTextContentElement): number {
  const count = element.getNumberOfChars()
  if (!count) return 0
  const first = element.getStartPositionOfChar(0)
  const last = element.getEndPositionOfChar(count - 1)
  return Math.max(Math.hypot(last.x - first.x, last.y - first.y), element.getBBox().width)
}
