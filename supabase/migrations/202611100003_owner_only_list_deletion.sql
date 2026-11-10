begin;

-- Collaborators retain editing, sharing and member management. Deleting the
-- entire list belongs exclusively to its owner, including direct API calls.
drop policy "Editors delete lists" on public.wishlists;
create policy "Owner deletes lists" on public.wishlists for delete to authenticated
  using (owner_id = (select auth.uid()));

commit;
