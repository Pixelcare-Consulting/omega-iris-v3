import { faker } from '@faker-js/faker'
import { z } from 'zod'

export const POST_TYPE = [
  { value: 'project', label: 'Project' },
  { value: 'blog', label: 'Blog' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'news', label: 'News' },
  { value: 'event', label: 'Event' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'update', label: 'Update' },
  { value: 'review', label: 'Review' },
  { value: 'interview', label: 'Interview' },
  { value: 'case-study', label: 'Case Study' }
]

export const GENDER = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'others', label: 'Others' }
]

export const FAVORITE_COLORS = [
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'purple', label: 'Purple' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'gray', label: 'Gray' }
]

export const FRAMEWORK = [
  { value: 'react', label: 'React.js' },
  { value: 'angular', label: 'Angular' },
  { value: 'vue', label: 'Vue.js' },
  { value: 'django', label: 'Django' },
  { value: 'flask', label: 'Flask' },
  { value: 'spring', label: 'Spring' },
  { value: 'express', label: 'Express.js' },
  { value: 'laravel', label: 'Laravel' },
  { value: 'node.js', label: 'Node.js' },
  { value: 'asp_net', label: 'ASP.NET' }
]

export const ITEMS = [
  { value: '1', label: 'ITM-001', itemName: 'Wireless Mouse', itemDescription: 'Ergonomic wireless mouse', unitPrice: 450, quantity: 2 },
  { value: '2', label: 'ITM-002', itemName: 'Mechanical Keyboard', itemDescription: 'RGB backlit keyboard', unitPrice: 2500, quantity: 1 },
  { value: '3', label: 'ITM-003', itemName: 'USB-C Cable', itemDescription: 'Fast charging cable', unitPrice: 150, quantity: 5 },
  { value: '4', label: 'ITM-004', itemName: 'Laptop Stand', itemDescription: 'Adjustable aluminum stand', unitPrice: 800, quantity: 1 },
  { value: '5', label: 'ITM-005', itemName: 'External Hard Drive', itemDescription: '1TB portable storage', unitPrice: 3200, quantity: 1 },
  { value: '6', label: 'ITM-006', itemName: 'Bluetooth Speaker', itemDescription: 'Portable mini speaker', unitPrice: 1200, quantity: 2 },
  { value: '7', label: 'ITM-007', itemName: 'Webcam', itemDescription: '1080p HD webcam', unitPrice: 900, quantity: 1 },
  { value: '8', label: 'ITM-008', itemName: 'Gaming Headset', itemDescription: 'Surround sound headset', unitPrice: 1800, quantity: 1 },
  { value: '9', label: 'ITM-009', itemName: 'Monitor 24"', itemDescription: 'Full HD LED monitor', unitPrice: 7500, quantity: 1 },
  { value: '10', label: 'ITM-010', itemName: 'Power Bank', itemDescription: '10000mAh portable charger', unitPrice: 600, quantity: 3 }
]

export const exampleFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  search: z.string(),
  price: z.string(),
  body: z.string().min(1, 'Body is required'),
  framework: z.string().min(1, 'Framework is required'),
  item1: z.string().min(1, 'Item 1 is required'),
  item2: z.string().min(1, 'Item 2 is required'),
  item3: z.string().min(1, 'Item 3 is required'),
  color: z.array(z.string()).min(1, 'Please select at least one color'),
  badgeColor: z.string().min(1, 'Badge color is required'),
  badgeColor2: z.string(),
  items: z.array(z.string()).min(1, 'Please select at least one item'),
  date1: z.date({ error: 'Date is required' }),
  date2: z.date().nullish(),
  rangeDate1: z.object({
    from: z.date({ error: 'Range 1 From Date is required' }),
    to: z.date({ error: 'Range 2 To Date is required' })
  }),
  rangeDate2: z.object({
    from: z.date().nullish(),
    to: z.date().nullish()
  }),
  time: z.string().min(1, 'Time is required'),
  isAllowed: z.boolean().optional(),
  isAgree: z.boolean().refine((value) => value === true, 'Agreeing to the terms is required'),
  isAccept: z.boolean(),
  favoriteColors: z.array(z.string()).min(1, 'Please select at least one color'),
  gender: z.string().min(1, 'Gender is required'),
  files: z.array(z.custom<File>()).min(1, 'Please select at least one file'),
  excelFiles: z.array(z.custom<File>()).min(1, 'Please select at least one file'),
  images: z.array(z.custom<File>()).min(1, 'Please select at least one image'),
  coverImage: z
    .custom<File>()
    .nullish()
    .refine((file) => file !== null, 'Cover image is required')
})

export type ExampleForm = z.infer<typeof exampleFormSchema>
