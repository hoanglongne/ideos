import { describe, expect, it } from 'vitest'
import { decryptBytes, decryptJson, deriveKeys, encryptBytes, encryptJson, formatCode, newSecret, parseCode } from './crypto'

describe('mã đồng bộ', () => {
  it('in ra 26 ký tự chia nhóm 4 và đọc lại đúng 16 byte', () => {
    for (let i = 0; i < 50; i++) {
      const s = newSecret()
      const code = formatCode(s)
      expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/)
      expect([...parseCode(code)!]).toEqual([...s])
    }
  })

  it('chấp nhận chữ thường, khoảng trắng, nhầm O/0 và I/L/1, và cả đường link ghép máy', () => {
    const s = newSecret()
    const code = formatCode(s)
    expect([...parseCode(code.toLowerCase().replace(/-/g, ' '))!]).toEqual([...s])
    expect([...parseCode(code.replace(/0/g, 'O').replace(/1/g, 'I'))!]).toEqual([...s])
    expect([...parseCode(`https://ideos.example.workers.dev/#pair=${code}`)!]).toEqual([...s])
  })

  it('từ chối mã thiếu ký tự hoặc có ký tự lạ', () => {
    const code = formatCode(newSecret())
    expect(parseCode(code.slice(0, -1))).toBeNull()
    expect(parseCode(code.slice(0, -1) + 'U')).toBeNull()
    expect(parseCode('')).toBeNull()
  })
})

describe('khoá và mã hoá', () => {
  it('cùng mã cho cùng vault/token; khác mã thì khác', async () => {
    const s = newSecret()
    const a = await deriveKeys(s)
    const b = await deriveKeys(parseCode(formatCode(s))!)
    const c = await deriveKeys(newSecret())
    expect(a.vault).toMatch(/^[0-9a-f]{32}$/)
    expect(a.vault).toBe(b.vault)
    expect(a.token).toBe(b.token)
    expect(a.vault).not.toBe(c.vault)
    expect(a.token).not.toContain(a.vault)
  })

  it('mã hoá rồi giải mã được JSON và file; khoá khác thì không giải được', async () => {
    const k = await deriveKeys(newSecret())
    const other = await deriveKeys(newSecret())
    const idea = { title: 'Cho thuê đồ cắm trại', tags: ['travel'], n: 3 }
    const ct = await encryptJson(k.key, idea)
    expect(ct).not.toContain('cắm')
    expect(await decryptJson(k.key, ct)).toEqual(idea)
    expect(await encryptJson(k.key, idea)).not.toBe(ct) // IV ngẫu nhiên mỗi lần
    await expect(decryptJson(other.key, ct)).rejects.toThrow()

    const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 31 + 7) % 256)
    const enc = await encryptBytes(k.key, bytes)
    expect(new Uint8Array(await decryptBytes(k.key, enc))).toEqual(bytes)
  })
})
