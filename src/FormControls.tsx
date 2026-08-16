import { parseDate, parseTime, type CalendarDate, type Time } from "@internationalized/date";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, Check, MagnifyingGlass, Minus, Plus, X } from "@phosphor-icons/react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Checkbox,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  NumberField,
  Popover,
  SearchField,
  Select,
  SelectValue,
  Slider,
  SliderFill,
  SliderThumb,
  SliderTrack,
  TextArea,
  TextField,
  TimeField,
} from "react-aria-components";
import type { ISODate } from "./types";

export interface SelectOption {
  id: string;
  label: string;
}

export function AppSelect({ label, value, options, onChange, disabled = false, className = "" }: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return <Select
    className={`ui-field ui-select ${className}`.trim()}
    selectedKey={value}
    onSelectionChange={(key) => key !== null && onChange(String(key))}
    isDisabled={disabled}
  >
    <Label className="ui-field__label">{label}</Label>
    <Button className="ui-select__trigger">
      <SelectValue className="ui-select__value" />
      <CaretDown size={17} aria-hidden="true" />
    </Button>
    <Popover className="ui-popover" placement="bottom start">
      <ListBox className="ui-listbox">
        {options.map((option) => <ListBoxItem className="ui-listbox__item" id={option.id} key={option.id} textValue={option.label}>
          {({ isSelected }) => <><span>{option.label}</span>{isSelected && <Check size={17} weight="bold" aria-hidden="true" />}</>}
        </ListBoxItem>)}
      </ListBox>
    </Popover>
  </Select>;
}

function dateValue(value: ISODate | null): CalendarDate | null {
  if (!value) return null;
  return parseDate(value);
}

export function AppDatePicker({ label, value, onChange, optional = false, disabled = false, className = "" }: {
  label: string;
  value: ISODate | null;
  onChange: (value: ISODate | null) => void;
  optional?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return <DatePicker
    className={`ui-field ui-date-picker ${className}`.trim()}
    value={dateValue(value)}
    onChange={(date) => onChange((date?.toString() as ISODate | undefined) ?? null)}
    isDisabled={disabled}
    granularity="day"
  >
    <Label className="ui-field__label"><span>{label}</span>{optional && <small>Optional</small>}</Label>
    <Group className="ui-date-picker__group">
      <DateInput className="ui-date-picker__input">{(segment) => <DateSegment className="ui-date-picker__segment" segment={segment} />}</DateInput>
      <Button className="ui-date-picker__button" aria-label="Open calendar"><CalendarBlank size={19} aria-hidden="true" /></Button>
    </Group>
    <Popover className="ui-popover ui-calendar-popover" placement="bottom start">
      <Dialog className="ui-calendar-dialog">
        <Calendar className="ui-calendar">
          <header className="ui-calendar__header">
            <Button className="ui-calendar__nav" slot="previous" aria-label="Previous month"><CaretLeft size={18} aria-hidden="true" /></Button>
            <Heading className="ui-calendar__heading" />
            <Button className="ui-calendar__nav" slot="next" aria-label="Next month"><CaretRight size={18} aria-hidden="true" /></Button>
          </header>
          <CalendarGrid className="ui-calendar__grid">
            <CalendarGridHeader>{(day) => <CalendarHeaderCell className="ui-calendar__weekday">{day}</CalendarHeaderCell>}</CalendarGridHeader>
            <CalendarGridBody>{(date) => <CalendarCell className="ui-calendar__cell" date={date} />}</CalendarGridBody>
          </CalendarGrid>
        </Calendar>
      </Dialog>
    </Popover>
  </DatePicker>;
}

export function AppTextField({ label, value, defaultValue, onChange, onFocus, name, placeholder, autoComplete, maxLength, required = false, readOnly = false, className = "" }: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  return <TextField
    className={`ui-field ui-text-field ${className}`.trim()}
    value={value}
    defaultValue={defaultValue}
    onChange={onChange}
    name={name}
    isRequired={required}
    isReadOnly={readOnly}
  >
    <Label className="ui-field__label">{label}</Label>
    <Input className="ui-input" placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength} onFocus={onFocus} />
  </TextField>;
}

export function AppTextArea({ label, value, onChange, placeholder, maxLength, className = "" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  return <TextField className={`ui-field ui-text-field ${className}`.trim()} value={value} onChange={onChange}>
    <Label className="ui-field__label">{label}</Label>
    <TextArea className="ui-input ui-textarea" placeholder={placeholder} maxLength={maxLength} />
  </TextField>;
}

export function AppSearchField({ value, onChange, placeholder = "Search", label = "Search" }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return <SearchField className="ui-search" value={value} onChange={onChange} aria-label={label}>
    <MagnifyingGlass size={20} aria-hidden="true" />
    <Input className="ui-search__input" placeholder={placeholder} />
    <Button className="ui-search__clear" aria-label="Clear search"><X size={16} aria-hidden="true" /></Button>
  </SearchField>;
}

export function AppSlider({ label, value, onChange, minValue = 0, maxValue = 10, step = 1, suffix = "" }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  suffix?: string;
}) {
  return <Slider className="ui-field ui-slider" value={value} onChange={onChange} minValue={minValue} maxValue={maxValue} step={step}>
    <div className="ui-slider__header"><Label className="ui-field__label">{label}</Label><output>{value}{suffix}</output></div>
    <SliderTrack className="ui-slider__track">
      <SliderFill className="ui-slider__fill" />
      <SliderThumb className="ui-slider__thumb" />
    </SliderTrack>
  </Slider>;
}

function timeValue(value: string): Time | null {
  if (!value) return null;
  try {
    return parseTime(value);
  } catch {
    return null;
  }
}

export function AppTimeField({ label, value, onChange, className = "" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return <TimeField
    className={`ui-field ui-time-field ${className}`.trim()}
    value={timeValue(value)}
    onChange={(time) => onChange(time ? `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}` : "")}
    granularity="minute"
    hourCycle={24}
  >
    <Label className="ui-field__label">{label}</Label>
    <DateInput className="ui-time-field__input">{(segment) => <DateSegment className="ui-date-picker__segment" segment={segment} />}</DateInput>
  </TimeField>;
}

export function AppNumberField({ label, name, defaultValue, minValue, maxValue, step = 1, className = "" }: {
  label: string;
  name: string;
  defaultValue?: number;
  minValue: number;
  maxValue: number;
  step?: number;
  className?: string;
}) {
  return <NumberField
    className={`ui-number-field ${className}`.trim()}
    name={name}
    defaultValue={defaultValue}
    minValue={minValue}
    maxValue={maxValue}
    step={step}
  >
    <Label className="ui-field__label">{label}</Label>
    <Group className="ui-number-field__group">
      <Button className="ui-number-field__button" slot="decrement" aria-label={`Decrease ${label.toLowerCase()}`}><Minus size={14} aria-hidden="true" /></Button>
      <Input className="ui-number-field__input" />
      <Button className="ui-number-field__button" slot="increment" aria-label={`Increase ${label.toLowerCase()}`}><Plus size={14} aria-hidden="true" /></Button>
    </Group>
  </NumberField>;
}

export function AppCompactNumberField({ value, onChange, minValue, maxValue, step = 1, ariaLabel, inputMode = "decimal", className = "" }: {
  value: number | null;
  onChange: (value: number | null) => void;
  minValue: number;
  maxValue: number;
  step?: number;
  ariaLabel: string;
  inputMode?: "decimal" | "numeric";
  className?: string;
}) {
  return <NumberField
    className={`ui-compact-number ${className}`.trim()}
    value={value ?? Number.NaN}
    onChange={(nextValue) => onChange(Number.isFinite(nextValue) ? nextValue : null)}
    minValue={minValue}
    maxValue={maxValue}
    step={step}
    aria-label={ariaLabel}
  >
    <Input className="ui-compact-number__input" inputMode={inputMode} autoComplete="off" />
  </NumberField>;
}

export function AppCheckbox({ checked, onChange, label, ariaLabel, disabled = false, className = "" }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return <Checkbox
    className={`ui-checkbox ${className}`.trim()}
    isSelected={checked}
    onChange={onChange}
    isDisabled={disabled}
    aria-label={ariaLabel}
  >
    {({ isSelected }) => <><span className="ui-checkbox__box">{isSelected && <Check size={15} weight="bold" aria-hidden="true" />}</span>{label && <span>{label}</span>}</>}
  </Checkbox>;
}
