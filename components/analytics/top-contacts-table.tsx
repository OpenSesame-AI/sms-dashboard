import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TopActiveContact } from '@/lib/db/queries'

interface TopContactsTableProps {
  data: TopActiveContact[]
}

export function TopContactsTable({ data }: TopContactsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Active Contacts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone Number</TableHead>
              <TableHead className="text-right">Messages</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              data.map((contact, index) => (
                <TableRow key={contact.phoneNumber}>
                  <TableCell className="font-medium">
                    {index + 1}. {contact.phoneNumber}
                  </TableCell>
                  <TableCell className="text-right">{contact.messageCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}








