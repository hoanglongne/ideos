/**
 * D1 giả chạy trên SQLite của Node (node:sqlite), đủ cho phần D1 mà Worker dùng, kèm bộ đếm số dòng đọc/ghi.
 * Chỉ dùng trong test: chạy đúng mã của Worker mà không cần Cloudflare.
 *
 * Cách tính "dòng ghi" theo cách Cloudflare tính: mỗi dòng ghi vào bảng cộng thêm một dòng cho mỗi index của bảng đó
 * (kể cả index tự sinh của khoá chính kiểu chữ). INSERT/UPSERT/DELETE tính đủ; UPDATE chỉ tính dòng bảng
 * (các UPDATE của Worker không đụng cột nào có index). UPSERT tính như INSERT nên đây là cận trên.
 */
import { readFileSync, readdirSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'

export interface Meter {
  statements: number
  rowsRead: number
  rowsWritten: number
}

type Value = string | number | null | Uint8Array

export function createD1(db: DatabaseSync, meter: Meter): D1Database {
  const indexCount = new Map<string, number>()
  const indexes = (table: string) => {
    if (!indexCount.has(table)) indexCount.set(table, (db.prepare(`PRAGMA index_list(${table})`).all() as unknown[]).length)
    return indexCount.get(table)!
  }

  function exec(sql: string, params: Value[]) {
    meter.statements++
    const st = db.prepare(sql)
    const reads = /^\s*select/i.test(sql) || /returning/i.test(sql)
    if (reads) {
      const rows = st.all(...params) as Record<string, unknown>[]
      meter.rowsRead += Math.max(1, rows.length)
      const m = sql.match(/^\s*insert\s+into\s+(\w+)/i)
      if (m) meter.rowsWritten += 1 + indexes(m[1])
      return { results: rows, changes: 0 }
    }
    const r = st.run(...params)
    const changes = Number(r.changes)
    const ins = sql.match(/^\s*insert\s+into\s+(\w+)/i)
    const del = sql.match(/^\s*delete\s+from\s+(\w+)/i)
    const upd = sql.match(/^\s*update\s+(\w+)/i)
    if (ins) meter.rowsWritten += changes * (1 + indexes(ins[1]))
    else if (del) meter.rowsWritten += changes * (1 + indexes(del[1]))
    else if (upd) meter.rowsWritten += changes
    return { results: [], changes }
  }

  const stmt = (sql: string, params: Value[] = []): D1PreparedStatement => {
    const self = {
      bind: (...v: Value[]) => stmt(sql, v),
      first: async (col?: string) => {
        const { results } = exec(sql, params)
        const row = results[0] ?? null
        return col && row ? (row as Record<string, unknown>)[col] : row
      },
      all: async () => ({ results: exec(sql, params).results, success: true, meta: {} }),
      run: async () => ({ results: [], success: true, meta: { changes: exec(sql, params).changes } }),
      raw: async () => exec(sql, params).results.map((r) => Object.values(r)),
      __exec: () => exec(sql, params),
    }
    return self as unknown as D1PreparedStatement
  }

  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (stmts: D1PreparedStatement[]) => {
      db.exec('BEGIN')
      try {
        const out = stmts.map((s) => {
          const r = (s as unknown as { __exec: () => { results: unknown[]; changes: number } }).__exec()
          return { results: r.results, success: true, meta: { changes: r.changes } }
        })
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    exec: async (sql: string) => {
      db.exec(sql)
      return { count: 1, duration: 0 }
    },
  } as unknown as D1Database
}

/** Chạy toàn bộ migrations/*.sql theo thứ tự tên. */
export function migrate(db: DatabaseSync, dir = new URL('../../migrations/', import.meta.url)) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'))
}
