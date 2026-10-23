'use client'

import { KeyboardEvent, useState } from 'react'
import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form'

import { cn } from '@/lib/utils'
import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field'
import { FormExtendedProps, InputProps } from '@/types/common'
import { Badge } from '../ui/badge'
import { Icons } from '../icons'

type ExtendedProps = FormExtendedProps & {
  inputProps?: InputProps
}

type TagsFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>
  name: TName
  label?: string
  placeholder?: string
  description?: string
  isRequired?: boolean
  isHideLabel?: boolean
  //* rewrites each tag before it is stored
  transform?: (value: string) => string
  extendedProps?: ExtendedProps
}

export default function TagsField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  isRequired,
  isHideLabel,
  transform,
  extendedProps
}: TagsFieldProps<T>) {
  const [draft, setDraft] = useState('')

  //* the tag being rewritten in place, absent means every tag is a plain badge
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null)

  const isDisabled = extendedProps?.inputProps?.disabled

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const tags = (field.value ?? []) as string[]

        const addTag = () => {
          const tag = transform ? transform(draft.trim()) : draft.trim()

          //* a tag is stored once, no matter how many times it is typed
          if (!tag || tags.includes(tag)) {
            setDraft('')
            return
          }

          field.onChange([...tags, tag])
          setDraft('')
        }

        const removeTag = (tag: string) => field.onChange(tags.filter((t) => t !== tag))

        const commitEdit = () => {
          if (!editing) return

          const tag = transform ? transform(editing.value.trim()) : editing.value.trim()
          const isDuplicate = tags.some((t, index) => index !== editing.index && t === tag)

          //* an emptied tag is dropped, and a duplicate keeps what it was
          if (!tag) field.onChange(tags.filter((_, index) => index !== editing.index))
          else if (!isDuplicate) field.onChange(tags.map((t, index) => (index === editing.index ? tag : t)))

          setEditing(null)
        }

        const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitEdit()
            return
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            setEditing(null)
          }
        }

        const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
          //* enter commits the tag, it must not submit the form
          //! only enter, so a tag can hold any character the user types, commas included
          if (event.key === 'Enter') {
            event.preventDefault()
            addTag()
            return
          }

          //* backspace on an empty box drops the last tag
          if (event.key === 'Backspace' && !draft && tags.length > 0) field.onChange(tags.slice(0, -1))
        }

        const itemErrors = (Array.isArray(fieldState.error) ? fieldState.error : []) as ({ message?: string } | undefined)[]
        const errors = Array.isArray(fieldState.error) ? itemErrors.filter(Boolean) : fieldState.error ? [fieldState.error] : []

        return (
          <Field {...extendedProps?.fieldProps} data-disabled={isDisabled} data-invalid={fieldState.invalid}>
            {!isHideLabel && label && (
              <FieldLabel {...extendedProps?.fieldLabelProps} isRequired={isRequired} isDisabled={isDisabled} htmlFor={field.name}>
                {label}
              </FieldLabel>
            )}

            <div
              className={cn(
                'border-input dark:bg-input/30 flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow]',
                'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
                fieldState.invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40',
                isDisabled && 'pointer-events-none cursor-not-allowed opacity-50',
                extendedProps?.inputProps?.className
              )}
              onClick={() => document.getElementById(field.name)?.focus()}
            >
              {tags.map((tag, index) =>
                editing?.index === index ? (
                  <input
                    key={tag}
                    autoFocus
                    //! own colour, the field turns its text destructive while invalid and this would inherit it
                    className='border-input text-foreground h-5.5 min-w-16 rounded-4xl border bg-transparent px-2 text-xs outline-none'
                    style={{ width: `${Math.max(editing.value.length + 2, 6)}ch` }}
                    value={editing.value}
                    aria-label={`Edit ${tag}`}
                    autoComplete='off'
                    //! the wrapper focuses the draft box on click, which would end the edit at once
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setEditing({ index, value: event.target.value })}
                    onKeyDown={handleEditKeyDown}
                    onBlur={commitEdit}
                  />
                ) : (
                  <Badge
                    key={tag}
                    //* the offending tag colours itself, so the message names something visible
                    variant={itemErrors[index] ? 'destructive' : 'secondary'}
                    className='gap-1'
                    title='Double click to edit'
                    //* double click rewrites the tag in place
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      setEditing({ index, value: tag })
                    }}
                  >
                    {tag}
                    <button type='button' aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>
                      <Icons.x className='size-3' />
                    </button>
                  </Badge>
                )
              )}

              <input
                {...extendedProps?.inputProps}
                id={field.name}
                className='placeholder:text-muted-foreground text-foreground min-w-32 flex-1 bg-transparent outline-none'
                value={draft}
                aria-invalid={fieldState.invalid}
                placeholder={placeholder ?? 'Type and press enter'}
                autoComplete='off'
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                //* leaving the box keeps what was typed instead of dropping it
                onBlur={() => {
                  addTag()
                  field.onBlur()
                }}
              />
            </div>

            {description && <FieldDescription {...extendedProps?.fieldDescriptionProps}>{description}</FieldDescription>}
            {errors.length > 0 && <FieldError {...extendedProps?.fieldErrorProps} errors={errors} />}
          </Field>
        )
      }}
    />
  )
}
