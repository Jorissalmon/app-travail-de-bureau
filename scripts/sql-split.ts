/**
 * Split a migration into statements on unquoted semicolons.
 *
 * `--` comments are skipped rather than copied through, and that is not a
 * tidiness choice. The splitter used to treat a comment as ordinary text, so a
 * semicolon inside one cut the file in the middle of a sentence and handed
 * Postgres a statement beginning « the rows survive. » — a syntax error that
 * only ever showed up against a live database, and only for whoever ran the
 * migration next. `db/002_seed_content.sql` had exactly that, generated into it
 * by scripts/gen-seed.ts, and an apostrophe in a comment would have opened a
 * string literal that swallowed everything up to the next one.
 *
 * Both were papered over by a warning telling every future author never to
 * write an apostrophe in a comment. Skipping comments removes the class instead
 * of the symptom.
 *
 * A `--` inside a string literal is still text, which is why this is a state
 * machine and not a regex: article bodies are full of dashes.
 */
export function statements(text: string): string[] {
  const out: string[] = []
  let buf = ''
  let inSingle = false
  let inDollar = false
  let inComment = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next2 = text.slice(i, i + 2)

    if (inComment) {
      // Runs to the end of the line, and the newline is kept so statements
      // that follow a comment do not glue onto it.
      if (ch === '\n') {
        inComment = false
        buf += ch
      }
      continue
    }
    if (!inSingle && !inDollar && next2 === '--') {
      inComment = true
      i++
      continue
    }

    if (!inSingle && next2 === '$$') {
      inDollar = !inDollar
      buf += next2
      i++
      continue
    }
    if (!inDollar && ch === "'") {
      if (inSingle && text[i + 1] === "'") {
        buf += "''"
        i++
        continue
      }
      inSingle = !inSingle
    }
    if (ch === ';' && !inSingle && !inDollar) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}
