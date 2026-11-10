import 'server-only'

import { defineSequence, padSequence, SequenceDefinition } from '@/lib/sequence'
import { BpMasterType } from '@/constants/bp-master'

type BpChildSequenceContext = { dbCode: string; bpCode: string }

//* each database runs its own series, vendors are type S but code V
export const BP_MASTER_SEQUENCES: Record<BpMasterType, SequenceDefinition<{ dbCode: string }>> = {
  C: defineSequence<{ dbCode: string }>({
    key: 'BP_CUSTOMER',
    scope: (ctx) => ctx.dbCode,
    format: (value) => `C${padSequence(value, 5)}`
  }),
  S: defineSequence<{ dbCode: string }>({
    key: 'BP_VENDOR',
    scope: (ctx) => ctx.dbCode,
    format: (value) => `V${padSequence(value, 5)}`
  })
}

export const BP_ADDRESS_SEQUENCE = defineSequence<BpChildSequenceContext>({
  key: 'BP_ADDRESS',
  scope: (ctx) => `${ctx.dbCode}:${ctx.bpCode}`,
  format: (value) => `A${padSequence(value, 2)}`
})

export const BP_CONTACT_PERSON_SEQUENCE = defineSequence<BpChildSequenceContext>({
  key: 'BP_CONTACT_PERSON',
  scope: (ctx) => `${ctx.dbCode}:${ctx.bpCode}`,
  format: (value) => `CP${padSequence(value, 2)}`
})
