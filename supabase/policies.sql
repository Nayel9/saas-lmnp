-- Enable RLS
alter table public."Property"      enable row level security;
alter table public."Income"        enable row level security;
alter table public."Expense"       enable row level security;
alter table public."Amortization"  enable row level security;
alter table public."journal_entries" enable row level security;
alter table public."assets"          enable row level security;

-- PROPERTY
create policy "property_select_own" on public."Property"
for select to authenticated using (user_id = auth.uid()::text);
create policy "property_insert_own" on public."Property"
for insert to authenticated with check (user_id = auth.uid()::text);
create policy "property_update_own" on public."Property"
for update to authenticated using (user_id = auth.uid()::text);
create policy "property_delete_own" on public."Property"
for delete to authenticated using (user_id = auth.uid()::text);

-- INCOME
create policy "income_select_own" on public."Income"
for select to authenticated using (user_id = auth.uid()::text);
create policy "income_insert_own" on public."Income"
for insert to authenticated with check (user_id = auth.uid()::text);
create policy "income_update_own" on public."Income"
for update to authenticated using (user_id = auth.uid()::text);
create policy "income_delete_own" on public."Income"
for delete to authenticated using (user_id = auth.uid()::text);

-- EXPENSE
create policy "expense_select_own" on public."Expense"
for select to authenticated using (user_id = auth.uid()::text);
create policy "expense_insert_own" on public."Expense"
for insert to authenticated with check (user_id = auth.uid()::text);
create policy "expense_update_own" on public."Expense"
for update to authenticated using (user_id = auth.uid()::text);
create policy "expense_delete_own" on public."Expense"
for delete to authenticated using (user_id = auth.uid()::text);

-- AMORTIZATION
create policy "amortization_select_own" on public."Amortization"
for select to authenticated using (user_id = auth.uid()::text);
create policy "amortization_insert_own" on public."Amortization"
for insert to authenticated with check (user_id = auth.uid()::text);
create policy "amortization_update_own" on public."Amortization"
for update to authenticated using (user_id = auth.uid()::text);
create policy "amortization_delete_own" on public."Amortization"
for delete to authenticated using (user_id = auth.uid()::text);

-- JOURNAL ENTRIES
create policy "journal_entries_select_own" on public."journal_entries"
for select to authenticated using (user_id = auth.uid()::text);
create policy "journal_entries_insert_own" on public."journal_entries"
for insert to authenticated with check (user_id = auth.uid()::text);
create policy "journal_entries_update_own" on public."journal_entries"
for update to authenticated using (user_id = auth.uid()::text);
create policy "journal_entries_delete_own" on public."journal_entries"
for delete to authenticated using (user_id = auth.uid()::text);

-- ASSETS
create policy "assets_select_own" on public."assets"
for select to authenticated using (user_id = auth.uid()::text);
create policy "assets_insert_own" on public."assets"
for insert to authenticated with check (user_id = auth.uid()::text);
create policy "assets_update_own" on public."assets"
for update to authenticated using (user_id = auth.uid()::text);
create policy "assets_delete_own" on public."assets"
for delete to authenticated using (user_id = auth.uid()::text);
