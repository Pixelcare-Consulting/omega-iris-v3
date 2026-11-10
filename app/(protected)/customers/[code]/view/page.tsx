import { BpMasterViewPage } from '@/components/bp-master/bp-master-pages'

export default function CustomerViewPage({ params }: { params: Promise<{ code: string }> }) {
  return <BpMasterViewPage type='C' params={params} />
}
