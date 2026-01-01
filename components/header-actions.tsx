"use client"

import { useCell } from "./cell-context"
import { CopyUrl } from "./copy-url"
import { QrCodeButton } from "./qr-code-button"
import { CopyCellLink } from "./copy-cell-link"

export function HeaderActions() {
  const { selectedCell } = useCell()
  return (
    <>
      {selectedCell && <CopyCellLink cellId={selectedCell.id} />}
      <CopyUrl phoneNumber={selectedCell?.phoneNumber} />
      <QrCodeButton phoneNumber={selectedCell?.phoneNumber} />
    </>
  )
}




