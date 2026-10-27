import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db, newIdea, patchIdea } from '../../db'
import { newMoneyPlan } from './models'

it('hai lần sửa sát nhau trên ô số khác nhau không đè mất nhau', async () => {
  const idea = newIdea({ title: 'tiền', money: newMoneyPlan('saas', 'VND') })
  await db.ideas.add(idea)
  const edit = (k: 'price' | 'cac', v: number) =>
    patchIdea(idea.id, (cur) => (cur.money ? { money: { inputs: { ...cur.money.inputs, [k]: v }, assumed: cur.money.assumed.filter((a) => a !== k) } } : null))
  await Promise.all([edit('price', 99_000), edit('cac', 123_000)])
  const got = (await db.ideas.get(idea.id))!
  expect(got.money!.inputs.price).toBe(99_000)
  expect(got.money!.inputs.cac).toBe(123_000)
  expect(got.money!.assumed).not.toContain('price')
  expect(got.money!.assumed).not.toContain('cac')
  expect(got.dirty).toBe(1)
})

it('ý tưởng cũ không có bài toán tiền vẫn đọc được', async () => {
  const idea = newIdea({ title: 'cũ' })
  await db.ideas.add(idea)
  expect((await db.ideas.get(idea.id))!.money).toBeUndefined()
})
