// Crée ou met à jour un utilisateur admin de test via l'API d'administration Supabase
// Variables requises: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD
require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error('Variables manquantes (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD)');
  process.exit(1);
}

(async () => {
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    // Recherche utilisateur existant
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (listError) throw listError;
    let existing = list.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!existing) {
      console.log('Création de l\'utilisateur admin ...');
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'admin' },
        app_metadata: { role: 'admin' },
      });
      if (error) throw error;
      existing = data.user;
      console.log('Utilisateur créé:', existing.id);
    } else {
      console.log('Utilisateur déjà présent, mise à jour du rôle ...');
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: { ...(existing.user_metadata||{}), role: 'admin' },
        app_metadata: { ...(existing.app_metadata||{}), role: 'admin' },
      });
      if (error) throw error;
      existing = data.user;
      console.log('Rôle mis à jour.');
    }
    console.log('OK - email:', existing.email, 'role:', existing.app_metadata?.role || existing.user_metadata?.role);
  } catch (e) {
    console.error('Échec ensure-admin:', e.message);
    process.exit(1);
  }
})();

