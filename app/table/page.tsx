import { columns } from "./columns"
import { ContactsTable } from "./contacts-table"

export default function ContactsPage() {
  return (
    <div className="w-full">
      <ContactsTable columns={columns} />
    </div>
  )
}

