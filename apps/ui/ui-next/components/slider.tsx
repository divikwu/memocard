// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/licenses/shadcn-preview-02.md.
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cnState } from "@ui-next/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: SliderPrimitive.Root.Props) {
  const initialValues = value ?? defaultValue
  const _values = Array.isArray(initialValues)
    ? initialValues
    : typeof initialValues === "number"
      ? [initialValues]
      : [min]

  return (
    <SliderPrimitive.Root
      className={cnState(className, "data-horizontal:w-full data-vertical:h-full")}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-track select-none data-horizontal:h-2 data-horizontal:w-full data-vertical:h-full data-vertical:w-2"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-accent-bg select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            index={index}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            className="block h-4 w-6 shrink-0 rounded-full bg-on-dark shadow-md ring-1 ring-on-light/10 transition-[color,box-shadow,background-color] select-none not-dark:bg-clip-padding not-data-disabled:hover:ring-4 not-data-disabled:hover:ring-focus/30 has-[:focus-visible]:focus-ring data-disabled:pointer-events-none data-vertical:h-6 data-vertical:w-4"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
