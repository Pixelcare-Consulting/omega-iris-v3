import { BpMasterFormPage } from '@/components/bp-master/bp-master-pages'

export default function VendorPage({ params }: { params: Promise<{ code: string }> }) {
  return <BpMasterFormPage type='S' params={params} />
}
