'use client'

import { useFormContext, useWatch } from 'react-hook-form'

import { LocationGenerateForm } from '@/schema/location'
import { FormOptions } from '@/types/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { TooltipWrapper } from '@/components/tooltip-wrapper'
import { Row } from '@/components/row'
import { Column } from '@/components/column'
import { ComboboxField } from '@/components/forms/combobox-field'
import { renderCodeItem } from '@/components/forms/combobox-item-content'
import SwitchField from '@/components/forms/switch-field'
import ChipPickerField from '@/components/forms/chip-picker-field'
import { LOCATION_BAY_OPTIONS, LOCATION_LEVEL_OPTIONS, LOCATION_RACK_OPTIONS, LOCATION_TYPE_OPTIONS } from '@/constants/location'

//* how to pick chips, shown under each picker
const PICKER_HINT = 'Click to pick one. For a range, click the first, then Shift+click the last'

type LocationGenerateLineProps = {
  index: number
  zoneOptions: FormOptions[]
  isZonesLoading: boolean
  canRemove: boolean
  onDuplicate: () => void
  onRemove: () => void
}

export default function LocationGenerateLine({
  index,
  zoneOptions,
  isZonesLoading,
  canRemove,
  onDuplicate,
  onRemove
}: LocationGenerateLineProps) {
  const form = useFormContext<LocationGenerateForm>()

  const line = useWatch({ control: form.control, name: `lines.${index}` })

  const bays = line?.bayCodes?.length ?? 0
  const levels = line?.levelCodes?.length ?? 0
  const racks = line?.rackCodes?.length ?? 0

  //* an empty level or rack pick counts as one
  const total = `${bays} bays x ${levels || 'no'} levels x ${racks || 'no'} racks = ${bays * Math.max(levels, 1) * Math.max(racks, 1)}`

  return (
    <Card>
      <CardHeader className='flex flex-row items-center gap-2'>
        <CardTitle className='text-base'>Line {index + 1}</CardTitle>
        <span className='text-muted-foreground text-sm'>{total}</span>

        <div className='ml-auto flex items-center gap-1'>
          <TooltipWrapper label='Duplicate Line'>
            <Button type='button' variant='ghost' size='icon-sm' onClick={onDuplicate}>
              <Icons.copy className='size-4' />
            </Button>
          </TooltipWrapper>

          {canRemove && (
            <TooltipWrapper label='Remove Line'>
              <Button type='button' variant='ghost' size='icon-sm' onClick={onRemove}>
                <Icons.trash className='text-destructive size-4' />
              </Button>
            </TooltipWrapper>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Row gap={5}>
          <Column md={6} lg={3}>
            <ComboboxField
              control={form.control}
              type='Basic'
              name={`lines.${index}.type`}
              label='Type'
              data={LOCATION_TYPE_OPTIONS}
              description='Optional'
            />
          </Column>

          <Column md={6} lg={3}>
            <ComboboxField
              control={form.control}
              type='Basic'
              name={`lines.${index}.processZoneCode`}
              label='Process Zone'
              data={zoneOptions}
              isLoading={isZonesLoading}
              searchKeys={['value']}
              renderItem={renderCodeItem}
              isRequired
              //* the zone decides the pallet default
              callback={({ item }) => {
                if (item) form.setValue(`lines.${index}.isPalletAllowed`, !!item.isPalletEligible, { shouldDirty: true })
              }}
            />
          </Column>

          <Column md={6} lg={3}>
            <SwitchField
              control={form.control}
              name={`lines.${index}.isPalletAllowed`}
              label='Pallet Allowed'
              layout='choice-card'
              description="Allows pallets here, starts with the process zone's setting"
            />
          </Column>

          <Column>
            <ChipPickerField
              control={form.control}
              name={`lines.${index}.bayCodes`}
              label='Bays'
              options={LOCATION_BAY_OPTIONS}
              description={PICKER_HINT}
              isRequired
            />
          </Column>

          <Column>
            <ChipPickerField
              control={form.control}
              name={`lines.${index}.levelCodes`}
              label='Levels'
              options={LOCATION_LEVEL_OPTIONS}
              description={`${PICKER_HINT}. Leave empty for no level`}
            />
          </Column>

          <Column>
            <ChipPickerField
              control={form.control}
              name={`lines.${index}.rackCodes`}
              label='Racks'
              options={LOCATION_RACK_OPTIONS}
              description={`${PICKER_HINT}. Leave empty for no rack`}
            />
          </Column>
        </Row>
      </CardContent>
    </Card>
  )
}
