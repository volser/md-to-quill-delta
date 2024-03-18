To perform database migrations for BDR (Bi-Directional Replication), you can follow these general steps as outlined in the [DB DDL Migration Process](https://staging.clickup.com/t/333/8x8uvnhc9):

1. Run a command to generate a new SQL file under `scripts/migrations/bdr`, for example:
   ```
   pnpm run create-db-migration --db bdr --name create_imports_docs_table
   ```
2. Populate the SQL file with the `CREATE TABLE` statement.

3. Run a command to generate a new SQL file to add an index:
   ```
   pnpm run create-db-migration --db bdr --name create_imports_docs_workspace_id_idx
   ```
4. Populate the SQL file with the `CREATE INDEX` statement.

5. Repeat the steps for any other SQL statements you would like to have, such as creating other tables and indices.

6. Run a command to update `src/scripts/db_migrations.sql`:
   ```
   pnpm run regen-db-migrations
   ```

7. Run a command to test your DDL changes:
   ```
   pnpm run test:jest -- test/jest/migrations.test.ts
   ```

8. Add your new table schema metadata into the WMS service files as needed for migration to new shards.