export const DEFAULT_PROCESS_ZONES = [
  { code: 'REC', name: 'Receiving staging area', isPalletEligible: true },
  { code: 'WH', name: 'Warehouse area', isPalletEligible: true },
  { code: 'QC-HOLD', name: 'In-inspection / testing hold area', isPalletEligible: false },
  { code: 'NCOR-RMA', name: 'Rejected and NCOR-pending racks', isPalletEligible: false },
  { code: 'CUST-APPR', name: 'For Customer Approval hold', isPalletEligible: false },
  { code: 'OUT', name: 'Outbound/Shipping staging, pre-dispatch', isPalletEligible: true },
  { code: 'VLT', name: 'Vault', isPalletEligible: false },
  { code: 'TC', name: 'Time-Controlled Room', isPalletEligible: false }
]
