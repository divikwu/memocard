// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { useRef, useState } from "react"

import { Button } from "@ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
} from "@ui/components/card"
import { Item } from "@ui/components/item"
import { Label } from "@ui/components/label"
import { IconPlaceholder } from "@ui/showcase-icons"

export function CoverArt() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  return (
    <Card data-showcase-card="cover-art">
      <CardContent className="flex flex-col gap-3">
        <Label
          htmlFor="cover-art"
          className="text-center text-xs font-normal tracking-wider text-secondary uppercase"
        >
          Cover Art
        </Label>
        <Item className="aspect-square" variant="outline">
          <label
            htmlFor="cover-art"
            className="flex size-full cursor-pointer items-center justify-center"
          >
            <IconPlaceholder
              lucide="ImageIcon"
              tabler="IconPhoto"
              hugeicons="Image01Icon"
              phosphor="ImageIcon"
              remixicon="RiImageLine"
              className="size-10 text-secondary/50"
            />
          </label>
        </Item>
        <input
          ref={fileInput}
          id="cover-art"
          type="file"
          tabIndex={-1}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
          accept="image/jpeg,image/png"
          className="sr-only"
        />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => fileInput.current?.click()}
        >
          Upload Artwork
        </Button>
        <CardDescription className="text-center text-xs">
          {fileName || <>Minimum 3000 × 3000px<br />JPEG or PNG only</>}
        </CardDescription>
      </CardFooter>
    </Card>
  )
}
