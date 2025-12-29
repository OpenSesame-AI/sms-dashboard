"use client"

import { useCell } from "./cell-context"
import { CopyUrl } from "./copy-url"
import { QrCodeButton } from "./qr-code-button"

export function HeaderActions() {
  const { selectedCell } = useCell()
  return (
    <>
      <CopyUrl phoneNumber={selectedCell?.phoneNumber} />
      <QrCodeButton phoneNumber={selectedCell?.phoneNumber} />
    </>
  )
}




