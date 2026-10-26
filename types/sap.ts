export type SapCredentials = {
  baseUrl: string
  companyDb: string
  userName: string
  password: string
}

//* whole cookie strings, e.g. 'B1SESSION=abc', routeid only comes behind the sap load balancer
export type SapAuthCookies = {
  b1session: string
  routeid?: string
}

export type SapResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string }

//* service layer query options, sent as the url query string
export type SapQuery = {
  $select?: string
  $filter?: string
  $orderby?: string
  $top?: number
  $skip?: number
  $expand?: string
}

export type SapCollection<T> = { value: T[] }

export type SapYesNo = 'tYES' | 'tNO'
export type SapCardType = 'cCustomer' | 'cSupplier' | 'cLid'
export type SapCompanyPrivate = 'cCompany' | 'cPrivate' | 'cGovernment' | 'cEmployee'
export type SapAddressType = 'bo_BillTo' | 'bo_ShipTo'
export type SapGroupType = 'bbpgt_CustomerGroup' | 'bbpgt_VendorGroup'

export type SapBPAddress = {
  AddressName: string
  AddressName2?: string | null
  AddressName3?: string | null
  AddressType: SapAddressType
  Street?: string | null
  City?: string | null
  ZipCode?: string | null
  State?: string | null
  Country?: string | null
  BPCode?: string
  RowNum?: number
}

export type SapContactEmployee = {
  Name: string
  Title?: string | null
  Position?: string | null
  E_Mail?: string | null
  Address?: string | null
  Phone1?: string | null
  Phone2?: string | null
  MobilePhone?: string | null
  Active?: SapYesNo
  CardCode?: string
  InternalCode?: number
}

export type SapBusinessPartner = {
  CardCode: string
  CardName: string
  CardType: SapCardType
  GroupCode: number
  Currency?: string | null
  FederalTaxID?: string | null
  CompanyPrivate?: SapCompanyPrivate
  SalesPersonCode?: number | null
  Phone1?: string | null
  Phone2?: string | null
  Cellular?: string | null
  EmailAddress?: string | null
  BilltoDefault?: string | null
  ShipToDefault?: string | null
  ContactPerson?: string | null
  Valid?: SapYesNo
  Frozen?: SapYesNo
  Series?: number
  CreateDate?: string | null
  CreateTime?: string | null
  UpdateDate?: string | null
  UpdateTime?: string | null
  BPAddresses?: SapBPAddress[]
  ContactEmployees?: SapContactEmployee[]
}

//* the body sap takes on create and update, no codes it assigns itself
export type SapBusinessPartnerBody = Partial<Omit<SapBusinessPartner, 'BPAddresses' | 'ContactEmployees'>> & {
  BPAddresses?: Omit<SapBPAddress, 'BPCode' | 'RowNum'>[]
  ContactEmployees?: Omit<SapContactEmployee, 'CardCode' | 'InternalCode'>[]
}

export type SapBusinessPartnerGroup = { Code: number; Name: string; Type: SapGroupType }
export type SapCurrency = { Code: string; Name: string }
export type SapSalesPerson = { SalesEmployeeCode: number; SalesEmployeeName: string; Active: SapYesNo }
export type SapCountry = { Code: string; Name: string }
export type SapState = { Code: string; Name: string; Country: string }
export type SapSeries = {
  Series: number
  Name: string
  IsManual?: SapYesNo
  Locked?: SapYesNo
}

export type SapItemType = 'itItems' | 'itLabor' | 'itTravel' | 'itFixedAssets'

export type SapItem = {
  ItemCode: string
  ItemName: string
  ItemType: SapItemType
  ItemsGroupCode: number
  InventoryItem?: SapYesNo
  SalesItem?: SapYesNo
  PurchaseItem?: SapYesNo
  WTLiable?: SapYesNo
  Manufacturer?: number | null
  SalesVATGroup?: string | null
  Valid?: SapYesNo
  Frozen?: SapYesNo
  Series?: number
  CreateDate?: string | null
  CreateTime?: string | null
  UpdateDate?: string | null
  UpdateTime?: string | null
}

export type SapItemBody = Partial<SapItem>

export type SapItemGroup = { Number: number; GroupName: string }
export type SapManufacturer = { Code: number; ManufacturerName: string }
export type SapVatGroup = { Code: string; Name: string; Category: string; Inactive: SapYesNo }

//* object code 2 is business partners, the sub type picks customer, vendor or lead
export type SapDocumentTypeParams = { DocumentTypeParams: { Document: string; DocumentSubType?: string } }
