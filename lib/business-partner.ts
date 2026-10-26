import { BusinessPartnerForm } from '@/schema/business-partner'
import { SapBusinessPartner, SapBusinessPartnerBody } from '@/types/sap'
import { NO_SALES_EMPLOYEE_CODE } from '@/constants/business-partner'
import { fromYesNo, toNullable, toYesNo } from '@/lib/sap/utils'

//* sap keeps active as two flags, a bp is active when valid and not frozen
export function isBusinessPartnerActive(bp: Pick<SapBusinessPartner, 'Valid' | 'Frozen'>) {
  return fromYesNo(bp.Valid) && bp.Frozen !== 'tYES'
}

//* form values to the service layer body
export function toBusinessPartnerBody(form: BusinessPartnerForm): SapBusinessPartnerBody {
  return {
    CardType: form.CardType,
    CardName: form.CardName,
    GroupCode: form.GroupCode,
    Currency: toNullable(form.Currency),
    FederalTaxID: toNullable(form.FederalTaxID),
    CompanyPrivate: form.CompanyPrivate,
    SalesPersonCode: form.SalesPersonCode,
    Phone1: toNullable(form.Phone1),
    Phone2: toNullable(form.Phone2),
    Cellular: toNullable(form.Cellular),
    EmailAddress: toNullable(form.EmailAddress),
    BilltoDefault: toNullable(form.BilltoDefault),
    ShipToDefault: toNullable(form.ShipToDefault),
    ContactPerson: toNullable(form.ContactPerson),
    Valid: toYesNo(form.isActive),
    Frozen: toYesNo(!form.isActive),
    BPAddresses: form.BPAddresses.map((address) => ({
      AddressName: address.AddressName,
      AddressName2: toNullable(address.AddressName2),
      AddressName3: toNullable(address.AddressName3),
      AddressType: address.AddressType,
      Street: toNullable(address.Street),
      City: toNullable(address.City),
      ZipCode: toNullable(address.ZipCode),
      Country: toNullable(address.Country),
      State: toNullable(address.State)
    })),
    ContactEmployees: form.ContactEmployees.map((contact) => ({
      Name: contact.Name,
      Title: toNullable(contact.Title),
      Position: toNullable(contact.Position),
      E_Mail: toNullable(contact.E_Mail),
      Address: toNullable(contact.Address),
      Phone1: toNullable(contact.Phone1),
      Phone2: toNullable(contact.Phone2),
      MobilePhone: toNullable(contact.MobilePhone),
      Active: toYesNo(contact.Active)
    }))
  }
}

//* a service layer record to form values, null text becomes '' for the inputs
export function toBusinessPartnerFormValues(bp: SapBusinessPartner): BusinessPartnerForm {
  return {
    CardCode: bp.CardCode,
    CardType: bp.CardType,
    CardName: bp.CardName,
    GroupCode: bp.GroupCode,
    Currency: bp.Currency ?? '',
    FederalTaxID: bp.FederalTaxID ?? '',
    CompanyPrivate: bp.CompanyPrivate ?? 'cCompany',
    SalesPersonCode: bp.SalesPersonCode ?? NO_SALES_EMPLOYEE_CODE,
    Phone1: bp.Phone1 ?? '',
    Phone2: bp.Phone2 ?? '',
    Cellular: bp.Cellular ?? '',
    EmailAddress: bp.EmailAddress ?? '',
    BilltoDefault: bp.BilltoDefault ?? '',
    ShipToDefault: bp.ShipToDefault ?? '',
    ContactPerson: bp.ContactPerson ?? '',
    isActive: isBusinessPartnerActive(bp),
    BPAddresses: (bp.BPAddresses ?? []).map((address) => ({
      AddressName: address.AddressName,
      AddressName2: address.AddressName2 ?? '',
      AddressName3: address.AddressName3 ?? '',
      AddressType: address.AddressType,
      Street: address.Street ?? '',
      City: address.City ?? '',
      ZipCode: address.ZipCode ?? '',
      Country: address.Country ?? '',
      State: address.State ?? ''
    })),
    ContactEmployees: (bp.ContactEmployees ?? []).map((contact) => ({
      Name: contact.Name,
      Title: contact.Title ?? '',
      Position: contact.Position ?? '',
      E_Mail: contact.E_Mail ?? '',
      Address: contact.Address ?? '',
      Phone1: contact.Phone1 ?? '',
      Phone2: contact.Phone2 ?? '',
      MobilePhone: contact.MobilePhone ?? '',
      Active: fromYesNo(contact.Active)
    }))
  }
}
