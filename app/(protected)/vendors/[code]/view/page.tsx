import { BpMasterViewPage } from '@/components/bp-master/bp-master-pages'

export default function VendorViewPage({ params }: { params: Promise<{ code: string }> }) {
  return <BpMasterViewPage type='S' params={params} />
}
