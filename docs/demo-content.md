# Refresh the demo magazines

1. Merge the seed changes to `main` and wait for the demo app's Railway deployment
   to succeed. Deploying updates the code and applies database migrations; it does
   **not** run the seed or replace existing magazine content.
2. Select the **demo project and its environment**, then connect to the app service
   (not the Postgres service). Run the copied SSH command from your local terminal,
   or substitute the demo's identifiers here:

   ```sh
   railway ssh --project <demo-project-id> --environment <environment> --service <app-service>
   ```

3. Inside the deployed app's shell, from its application directory (`/app`):

   ```sh
   npm run db:seed -- --force
   ```

   This generates the artwork in R2, validates the six issues, then replaces the
   issues, image rows and all existing logos (including manually uploaded marks)
   in one database transaction. Members, sessions and magazine settings are
   preserved; existing sponsor rows remain,
   but their old image references are cleared. There is no separate database wipe,
   schema reset or R2 bucket deletion. Expect six published issues and 25 generated
   images, with Regatta as issue 6 at the top of the library.

4. Refresh the demo and inspect the featured cover, back issues and logo library.

Use this reset **only on the isolated demo database and bucket**, never the members'
site. Keep it a manual command; adding `--force` seeding to the deployment hook would
replace edited issues on every deployment.

[`railway ssh`](https://docs.railway.com/cli/ssh) runs inside the deployed container,
with its deployed source, variables and private database connection.
[`railway run`](https://docs.railway.com/cli/run) instead executes local source on
your computer with Railway variables; it is not a remote terminal.
