import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });

async function investigate() {
  // 1. Get all cells to find OpenSesame
  console.log('=== ALL CELLS ===');
  const cells = await client`SELECT * FROM cells ORDER BY created_at DESC`;
  cells.forEach(c => console.log(JSON.stringify(c)));

  // 2. Find OpenSesame cell specifically
  console.log('\n=== OPENSESAME CELL ===');
  const openSesame = await client`SELECT * FROM cells WHERE name ILIKE '%opensesame%' OR name ILIKE '%open sesame%'`;
  console.log('Found:', openSesame.length, 'cells');
  openSesame.forEach(c => console.log(JSON.stringify(c)));

  // 3. If found, check contacts for that cell
  if (openSesame.length > 0) {
    const cellId = openSesame[0].id;
    console.log('\n=== CONTACTS FOR CELL ID:', cellId, '===');
    const contacts = await client`SELECT * FROM phone_user_mappings WHERE cell_id = ${cellId}`;
    console.log('Found contacts:', contacts.length);
    contacts.slice(0,5).forEach(c => console.log(JSON.stringify(c)));
    
    console.log('\n=== CONVERSATIONS FOR CELL ID:', cellId, '===');
    const conversations = await client`SELECT COUNT(*) as count FROM sms_conversations WHERE cell_id = ${cellId}`;
    console.log('Conversations count:', conversations[0].count);
  }

  // 4. Check contacts without cell_id (null)
  console.log('\n=== CONTACTS WITH NULL CELL_ID ===');
  const nullContacts = await client`SELECT COUNT(*) as count FROM phone_user_mappings WHERE cell_id IS NULL`;
  console.log('Contacts with null cell_id:', nullContacts[0].count);

  // 5. Show distribution of contacts per cell
  console.log('\n=== CONTACTS PER CELL ===');
  const contactsPerCell = await client`
    SELECT c.name, c.id, COUNT(p.id) as contact_count 
    FROM cells c 
    LEFT JOIN phone_user_mappings p ON p.cell_id = c.id 
    GROUP BY c.id, c.name
    ORDER BY contact_count DESC`;
  contactsPerCell.forEach(c => console.log(c.name, '-', c.contact_count, 'contacts'));

  await client.end();
}

investigate().catch(console.error);
