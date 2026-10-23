'use client'

import { useState } from 'react'

import StatCard from '@/components/stat-card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export default function ExampleStatCard() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className='flex flex-col gap-10'>
      <div className='bg-muted/40 flex items-center gap-2 rounded-lg border p-4'>
        <Switch id='stat-card-loading' checked={isLoading} onCheckedChange={setIsLoading} />
        <Label htmlFor='stat-card-loading'>Toggle loading state of every card below</Label>
      </div>

      {/* //* the common dashboard layout — a responsive grid of KPIs */}
      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Basic</h2>
          <p className='text-muted-foreground text-sm'>Only title and value are required. Add an icon key from `Icons` for context.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard title='Total Items' value={1284} icon='package' isLoading={isLoading} />
          <StatCard title='Total Users' value={42} icon='users' isLoading={isLoading} />
          <StatCard title='Warehouses' value={7} icon='warehouse' isLoading={isLoading} />
          <StatCard title='Inventory Value' value='₱ 2,450,300.00' icon='recieptText' isLoading={isLoading} />
        </div>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>With description</h2>
          <p className='text-muted-foreground text-sm'>A short qualifier rendered under the value.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <StatCard title='Pending Requests' value={18} icon='clipboadList' description='Awaiting approval' isLoading={isLoading} />
          <StatCard title='Issued Today' value={36} icon='packageCheck' description='As of 5:00 PM' isLoading={isLoading} />
          <StatCard title='Low Stock' value={9} icon='packageSearch' description='Below reorder point' isLoading={isLoading} />
        </div>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>With trend</h2>
          <p className='text-muted-foreground text-sm'>
            `trend.value` is a signed percentage. Positive renders green by default — pass `isGoodWhenUp: false` for metrics where a rise is
            bad, and `0` renders a neutral dash.
          </p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard
            title='Received Stock'
            value={512}
            icon='packageCheck'
            trend={{ value: 12.5, label: 'vs last month' }}
            isLoading={isLoading}
          />

          <StatCard
            title='Fulfillment Rate'
            value='94%'
            icon='checkCircle'
            trend={{ value: -3, label: 'vs last month' }}
            isLoading={isLoading}
          />

          <StatCard
            title='Overdue Loans'
            value={5}
            icon='triangleAlert'
            trend={{ value: 8, label: 'vs last month', isGoodWhenUp: false }}
            isLoading={isLoading}
          />

          <StatCard title='Rejected Requests' value={2} icon='xCircle' trend={{ value: 0, label: 'no change' }} isLoading={isLoading} />
        </div>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Clickable</h2>
          <p className='text-muted-foreground text-sm'>
            Pass `href` to wrap the whole card in a link — use it to drill into the list page behind the metric.
          </p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <StatCard title='Users' value={42} icon='users' description='Go to users list' href='/users' isLoading={isLoading} />

          <StatCard
            title='Roles'
            value={6}
            icon='userKey'
            trend={{ value: 2, label: 'vs last month' }}
            href='/roles'
            isLoading={isLoading}
          />

          <StatCard
            title='Form Fields Example'
            value='24'
            icon='fileText'
            description='Go to the form example'
            href='/examples/form-fields'
            isLoading={isLoading}
          />
        </div>
      </section>

      <section className='flex flex-col gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>Custom class</h2>
          <p className='text-muted-foreground text-sm'>`className` lands on the underlying `Card`, so spans and accents are easy.</p>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard
            title='Total Disbursed'
            value='₱ 8,120,000.00'
            icon='presentation'
            trend={{ value: 21.4, label: 'vs last quarter' }}
            className='bg-primary/5 sm:col-span-2'
            isLoading={isLoading}
          />

          <StatCard title='Active Sessions' value={13} icon='database' className='ring-primary/40' isLoading={isLoading} />
          <StatCard title='Failed Jobs' value={1} icon='alertCircle' className='ring-destructive/40' isLoading={isLoading} />
        </div>
      </section>
    </div>
  )
}
