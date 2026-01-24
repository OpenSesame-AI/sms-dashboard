import { columns } from "./columns"
import { ContactsTable } from "./contacts-table"

export default function ContactsPage() {
  return (
    <div className="w-full relative h-full flex flex-col flex-1 min-h-0 -my-4">
      <ContactsTable columns={columns} />
    </div>
  )
}

