/**
 * Mã đồng bộ = 16 byte ngẫu nhiên. Từ nó suy ra ba thứ, mỗi thứ một chiều:
 *  - vault: định danh dữ liệu trên máy chủ (hash, máy chủ không suy ngược ra mã được)
 *  - token: chứng minh quyền truy cập (máy chủ chỉ lưu hash của token)
 *  - key:   khoá AES-GCM để mã hoá dữ liệu, không bao giờ rời khỏi máy
 */

const enc = new TextEncoder()
const dec = new TextDecoder()
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32: không có I, L, O, U

export const SECRET_BYTES = 16
const CODE_CHARS = 26 // 128 bit / 5 bit mỗi ký tự, làm tròn lên

export interface VaultKeys {
  vault: string
  token: string
  key: CryptoKey
}

export function newSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SECRET_BYTES))
}

export function formatCode(secret: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of secret) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits) out += ALPHABET[(value << (5 - bits)) & 31]
  return out.match(/.{1,4}/g)!.join('-')
}

/** Nhận mã gõ tay (không phân biệt hoa thường, bỏ qua gạch và khoảng trắng) hoặc cả đường link ghép máy. */
export function parseCode(input: string): Uint8Array | null {
  const fromLink = input.match(/[#&?]pair=([^&\s]+)/)
  const raw = (fromLink ? decodeURIComponent(fromLink[1]) : input)
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
  if (raw.length !== CODE_CHARS) return null
  const out = new Uint8Array(SECRET_BYTES)
  let bits = 0
  let value = 0
  let i = 0
  for (const ch of raw) {
    const v = ALPHABET.indexOf(ch)
    if (v < 0) return null
    value = ((value << 5) | v) & 0xffff
    bits += 5
    if (bits >= 8) {
      if (i < SECRET_BYTES) out[i++] = (value >>> (bits - 8)) & 0xff
      bits -= 8
    }
  }
  // 2 bit thừa ở cuối phải bằng 0: bắt được phần lớn lỗi gõ nhầm ký tự cuối
  if (value & ((1 << bits) - 1)) return null
  return out
}

const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const b64url = (buf: ArrayBuffer) => toBase64(new Uint8Array(buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function deriveKeys(secret: Uint8Array): Promise<VaultKeys> {
  const vault = hex(await crypto.subtle.digest('SHA-256', concat(enc.encode('ideos/v1/vault:'), secret))).slice(0, 32)
  const token = b64url(await crypto.subtle.digest('SHA-256', concat(enc.encode('ideos/v1/auth:'), secret)))
  const base = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('ideos/v1'), info: enc.encode('enc') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  return { vault, token, key }
}

/** Định dạng: 12 byte IV ngẫu nhiên, theo sau là bản mã AES-GCM (kèm tag 16 byte). */
export async function encryptBytes(key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource))
  return concat(iv, ct)
}

export async function decryptBytes(key: CryptoKey, data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) as BufferSource }, key, bytes.subarray(12) as BufferSource)
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  return toBase64(await encryptBytes(key, enc.encode(JSON.stringify(value))))
}

export async function decryptJson<T>(key: CryptoKey, s: string): Promise<T> {
  return JSON.parse(dec.decode(await decryptBytes(key, fromBase64(s)))) as T
}
