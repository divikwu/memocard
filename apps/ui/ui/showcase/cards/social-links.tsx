// Adapted from shadcn/ui preview-02 (MIT); pinned source: build/verification/luma-showcase/source.
import { Button } from "@ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@ui/components/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@ui/components/input-group"
import { IconPlaceholder } from "@ui/showcase-icons"

export function SocialLinks() {
  return (
    <Card data-showcase-card="social-links">
      <CardHeader>
        <CardTitle>Social Links</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="spotify-url">Spotify Artist URL</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  lucide="CirclePlusIcon"
                  tabler="IconCirclePlus"
                  hugeicons="PlusSignCircleIcon"
                  phosphor="PlusCircleIcon"
                  remixicon="RiAddCircleLine"
                />
              </InputGroupAddon>
              <InputGroupInput
                id="spotify-url"
                defaultValue="spotify.com/artist/3j...2k"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="instagram-handle">Instagram Handle</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  lucide="CameraIcon"
                  tabler="IconCamera"
                  hugeicons="Camera01Icon"
                  phosphor="CameraIcon"
                  remixicon="RiCameraLine"
                />
              </InputGroupAddon>
              <InputGroupInput
                id="instagram-handle"
                defaultValue="@julianduryea_music"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="soundcloud-url">SoundCloud URL</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  lucide="CloudIcon"
                  tabler="IconCloud"
                  hugeicons="CloudUploadIcon"
                  phosphor="CloudIcon"
                  remixicon="RiCloudLine"
                />
              </InputGroupAddon>
              <InputGroupInput
                id="soundcloud-url"
                placeholder="soundcloud.com/username"
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="website-url">Website</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <IconPlaceholder
                  lucide="GlobeIcon"
                  tabler="IconWorld"
                  hugeicons="Globe02Icon"
                  phosphor="GlobeIcon"
                  remixicon="RiGlobalLine"
                />
              </InputGroupAddon>
              <InputGroupInput
                id="website-url"
                placeholder="https://yoursite.com"
              />
            </InputGroup>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="secondary">
          Discard
        </Button>
        <Button>Save Changes</Button>
      </CardFooter>
    </Card>
  )
}
