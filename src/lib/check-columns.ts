import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function checkColumns() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const tables = ['requests', 'K8sRequestNodeGroup', 'AdditionalDisk', 'FirewallPort', 'NetworkAccessEntry', 'k8s_request_node_groups', 'additional_disks', 'firewall_ports', 'network_access_entries'];
    for (const table of tables) {
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY column_name;
      `, [table]);
      if (res.rows.length > 0) {
        console.log(`\nColumns in ${table} table:`);
        res.rows.forEach(r => {
          console.log(`- ${r.column_name} (type: ${r.data_type})`);
        });
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkColumns();
