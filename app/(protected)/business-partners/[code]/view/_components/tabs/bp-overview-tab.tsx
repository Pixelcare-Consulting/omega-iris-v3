'use client'

import { BusinessPartnerLookups } from '@/actions/business-partner'
import { SapBusinessPartner } from '@/types/sap'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import ContentWrapper from '@/components/content-wrapper'
import ReadOnlyFieldHeader from '@/components/read-only-field-header'
import ReadOnlyField from '@/components/read-only-field'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import Copy from '@/components/copy'
import { isBusinessPartnerActive } from '@/lib/business-partner'
import { formatSapDateTime } from '@/lib/sap/utils'
import { ALL_CURRENCIES, CARD_TYPE_OPTIONS, COMPANY_PRIVATE_OPTIONS, toCurrencyLabel, toOptionLabel } from '@/constants/business-partner'

type BPOverviewTabProps = { businessPartner: SapBusinessPartner; lookups: BusinessPartnerLookups | null }

export default function BPOverviewTab({ businessPartner: bp, lookups }: BPOverviewTabProps) {
  const groupName = lookups?.groups.find((g) => g.Code === bp.GroupCode)?.Name ?? ''
  const currency = [ALL_CURRENCIES, ...(lookups?.currencies ?? [])].find((c) => c.Code === bp.Currency)
  const salesEmployee = lookups?.salesPersons.find((s) => s.SalesEmployeeCode === bp.SalesPersonCode)?.SalesEmployeeName ?? ''
  const isActive = isBusinessPartnerActive(bp)

  return (
    <ContentWrapper className='h-full'>
      <ScrollArea className='min-h-0 flex-1 p-4' type='auto'>
        <Row className='w-full' gap={5}>
          <Column>
            <ReadOnlyFieldHeader title='General' description="Business partner's general information" />
            <Separator className='mt-4' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Code' value={bp.CardCode}>
              <Copy value={bp.CardCode} />
            </ReadOnlyField>
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='BP Type' value={toOptionLabel(CARD_TYPE_OPTIONS, bp.CardType)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Name' value={bp.CardName} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Group' value={groupName} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField
              title='Currency'
              value={
                currency && currency.Code !== ALL_CURRENCIES.Code ? `${currency.Code} - ${currency.Name}` : toCurrencyLabel(bp.Currency)
              }
            />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Federal Tax ID' value={bp.FederalTaxID} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Type of Business' value={toOptionLabel(COMPANY_PRIVATE_OPTIONS, bp.CompanyPrivate)} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Sales Employee' value={salesEmployee} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Contact' description='Phone and e-mail of the business partner' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Tel 1' value={bp.Phone1} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Tel 2' value={bp.Phone2} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Mobile Phone' value={bp.Cellular} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='E-Mail' value={bp.EmailAddress} />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Defaults' description='Default addresses and contact person' />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Bill-to Default' value={bp.BilltoDefault} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Ship-to Default' value={bp.ShipToDefault} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Contact Person' value={bp.ContactPerson} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Active' value={isActive ? 'Yes' : 'No'} description='Inactive business partners are frozen in SAP' />
          </Column>

          <Column>
            <Separator className='mt-3 mb-4' />
            <ReadOnlyFieldHeader title='Record Meta Data' description="Business partner's record meta data" />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Created At' value={formatSapDateTime(bp.CreateDate, bp.CreateTime, 'MM-dd-yyyy hh:mm a', 'MM-dd-yyyy')} />
          </Column>

          <Column md={6} lg={3}>
            <ReadOnlyField title='Updated At' value={formatSapDateTime(bp.UpdateDate, bp.UpdateTime, 'MM-dd-yyyy hh:mm a', 'MM-dd-yyyy')} />
          </Column>
        </Row>
      </ScrollArea>
    </ContentWrapper>
  )
}
