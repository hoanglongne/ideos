// Dùng trong CI: nếu wrangler.jsonc còn database_id mẫu (toàn số 0), tra id thật của D1 tên "ideos"
// trên tài khoản Cloudflare rồi điền vào, để bạn không phải commit id.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../wrangler.jsonc', import.meta.url)
const PLACEHOLDER = '00000000-0000-0000-0000-000000000000'
const NAME = 'ideos'

const config = readFileSync(FILE, 'utf8')
if (!config.includes(PLACEHOLDER)) {
  console.log('wrangler.jsonc đã có database_id, giữ nguyên.')
  process.exit(0)
}

const out = execSync('npx wrangler d1 list --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const list = JSON.parse(out.slice(out.indexOf('[')))
const db = list.find((d) => d.name === NAME)
if (!db?.uuid) {
  console.error(`Không tìm thấy D1 tên "${NAME}" trên tài khoản. Tạo bằng: npx wrangler d1 create ${NAME}`)
  process.exit(1)
}
writeFileSync(FILE, config.replace(PLACEHOLDER, db.uuid))
console.log(`Đã điền database_id của D1 "${NAME}".`)
