const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to:", connectionString ? connectionString.split('@')[1] : "undefined");

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    await client.connect();
    console.log("Connected successfully!");
    const res = await client.query('SELECT 1');
    console.log("Query result:", res.rows);
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await client.end();
  }
}

main();
