import { BpMasterFormPage } from '@/components/bp-master/bp-master-pages'

export default function CustomerPage({ params }: { params: Promise<{ code: string }> }) {
  return <BpMasterFormPage type='C' params={params} />
}
