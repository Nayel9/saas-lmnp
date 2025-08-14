// Diagnostic bas niveau Postgres (sans Prisma)
// Utilise DATABASE_URL (pool) ou DIRECT_URL si FORCE_DIRECT=1
require('dotenv/config');
const { Client } = require('pg');
const url = process.env.FORCE_DIRECT ? process.env.DIRECT_URL : process.env.DATABASE_URL;
if (!url) {
  console.error('URL manquante (' + (process.env.FORCE_DIRECT ? 'DIRECT_URL' : 'DATABASE_URL') + ')');
  process.exit(1);
}
console.log('Mode:', process.env.FORCE_DIRECT ? 'DIRECT' : 'POOL');
console.log('Connexion =>', url.replace(/:[^:@/]+@/, ':****@'));

(async () => {
  const client = new Client({ connectionString: url, statement_timeout: 10000, query_timeout: 10000 });
  try {
    await client.connect();
    const { rows } = await client.query('select now(), current_user, version()');
    console.log('Réponse:', rows[0]);
  } catch (e) {
    console.error('Erreur connexion PG:', e.code, e.message);
    if (e.code === '28P01') console.error('→ Mot de passe invalide');
    if (e.code === 'ECONNREFUSED') console.error('→ Port bloqué / firewall');
    if (e.message.includes('certificate')) console.error('→ SSL: ajouter sslmode=require');
  } finally {
    await client.end().catch(()=>{});
  }
})();

