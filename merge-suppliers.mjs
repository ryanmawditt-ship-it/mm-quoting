/**
 * Migration script: Merge duplicate suppliers into canonical entries.
 * 
 * Strategy:
 * 1. Normalise supplier names (lowercase, strip PTY LTD, strip whitespace)
 * 2. Group by normalised name
 * 3. For each group, pick the canonical supplier (lowest ID with the most data)
 * 4. Re-point all supplier_quotes, project_suppliers to canonical ID
 * 5. Delete the duplicate supplier rows
 * 
 * Also cleans up test suppliers that have no quotes attached.
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normaliseName(name) {
  return name
    .toLowerCase()
    .replace(/\bpty\b/gi, '')
    .replace(/\bltd\b/gi, '')
    .replace(/\bgroup\b/gi, '')
    .replace(/\bspecialists?\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  // Get all suppliers
  const [allSuppliers] = await conn.execute('SELECT * FROM suppliers ORDER BY id');
  console.log(`Found ${allSuppliers.length} total suppliers`);

  // Group by normalised name
  const groups = {};
  for (const s of allSuppliers) {
    const key = normaliseName(s.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }

  console.log(`\nGrouped into ${Object.keys(groups).length} unique supplier names:`);
  for (const [key, members] of Object.entries(groups)) {
    console.log(`  "${key}" → ${members.length} entries (IDs: ${members.map(m => m.id).join(', ')})`);
  }

  // For each group with duplicates, merge into canonical
  let totalMerged = 0;
  let totalDeleted = 0;

  for (const [key, members] of Object.entries(groups)) {
    if (members.length <= 1) continue;

    // Pick canonical: the one with the most quotes, then lowest ID
    const quoteCounts = {};
    for (const m of members) {
      const [rows] = await conn.execute(
        'SELECT COUNT(*) as cnt FROM supplier_quotes WHERE supplierId = ?', [m.id]
      );
      quoteCounts[m.id] = Number(rows[0].cnt);
    }

    // Sort: most quotes first, then lowest ID
    members.sort((a, b) => {
      const diff = quoteCounts[b.id] - quoteCounts[a.id];
      if (diff !== 0) return diff;
      return a.id - b.id;
    });

    const canonical = members[0];
    const duplicates = members.slice(1);

    console.log(`\nMerging "${key}": canonical=ID ${canonical.id} (${canonical.name}, ${quoteCounts[canonical.id]} quotes)`);

    for (const dup of duplicates) {
      console.log(`  Merging ID ${dup.id} (${dup.name}, ${quoteCounts[dup.id]} quotes) → ID ${canonical.id}`);

      // Re-point supplier_quotes
      const [sqResult] = await conn.execute(
        'UPDATE supplier_quotes SET supplierId = ? WHERE supplierId = ?',
        [canonical.id, dup.id]
      );
      if (sqResult.affectedRows > 0) {
        console.log(`    Moved ${sqResult.affectedRows} supplier_quotes`);
      }

      // Re-point project_suppliers (but avoid duplicate key if canonical already tracked)
      // First check if canonical is already tracked for the same projects
      const [existingTracked] = await conn.execute(
        'SELECT projectId FROM project_suppliers WHERE supplierId = ?', [canonical.id]
      );
      const trackedProjects = new Set(existingTracked.map(r => r.projectId));

      const [dupTracked] = await conn.execute(
        'SELECT id, projectId FROM project_suppliers WHERE supplierId = ?', [dup.id]
      );
      for (const dt of dupTracked) {
        if (trackedProjects.has(dt.projectId)) {
          // Already tracked for this project, just delete the duplicate
          await conn.execute('DELETE FROM project_suppliers WHERE id = ?', [dt.id]);
          console.log(`    Deleted duplicate project_supplier for project ${dt.projectId}`);
        } else {
          // Move to canonical
          await conn.execute(
            'UPDATE project_suppliers SET supplierId = ? WHERE id = ?',
            [canonical.id, dt.id]
          );
          console.log(`    Moved project_supplier for project ${dt.projectId}`);
        }
      }

      // Delete the duplicate supplier
      await conn.execute('DELETE FROM suppliers WHERE id = ?', [dup.id]);
      console.log(`    Deleted supplier ID ${dup.id}`);
      totalDeleted++;
    }
    totalMerged++;
  }

  // Clean up test suppliers with no quotes (from automated tests)
  const [testSuppliers] = await conn.execute(`
    SELECT s.id, s.name FROM suppliers s
    LEFT JOIN supplier_quotes sq ON sq.supplierId = s.id
    WHERE sq.id IS NULL
    AND (s.name LIKE 'Test %' OR s.name LIKE 'Brand New%' OR s.name LIKE 'Track%')
  `);
  
  if (testSuppliers.length > 0) {
    console.log(`\nCleaning up ${testSuppliers.length} test suppliers with no quotes:`);
    for (const ts of testSuppliers) {
      // Delete any project_suppliers first
      await conn.execute('DELETE FROM project_suppliers WHERE supplierId = ?', [ts.id]);
      await conn.execute('DELETE FROM suppliers WHERE id = ?', [ts.id]);
      console.log(`  Deleted test supplier ID ${ts.id} (${ts.name})`);
      totalDeleted++;
    }
  }

  // Final count
  const [remaining] = await conn.execute('SELECT COUNT(*) as cnt FROM suppliers');
  console.log(`\n=== SUMMARY ===`);
  console.log(`Groups merged: ${totalMerged}`);
  console.log(`Suppliers deleted: ${totalDeleted}`);
  console.log(`Remaining suppliers: ${remaining[0].cnt}`);

  // Show final state
  const [finalSuppliers] = await conn.execute('SELECT id, name, contact, email FROM suppliers ORDER BY LOWER(name), id');
  console.log(`\n=== FINAL SUPPLIER LIST ===`);
  for (const s of finalSuppliers) {
    const [qc] = await conn.execute('SELECT COUNT(*) as cnt FROM supplier_quotes WHERE supplierId = ?', [s.id]);
    console.log(`  ID=${s.id} | "${s.name}" | quotes=${qc[0].cnt}`);
  }

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
