# Reset the demo site

Returns the demo to a clean state after a round of testing: the six seed issues and
nothing else. Use it after testing, and after merging seed changes (a deploy updates
the code and applies migrations; it never replaces content).

1. If seed changes are involved, merge them to `main` and wait for the demo app's
   Railway deployment to succeed.
2. Select the **demo project and its environment**, then connect to the app service
   (not the Postgres service). Run the copied SSH command from your local terminal,
   or substitute the demo's identifiers here:

   ```sh
   railway ssh --project <demo-project-id> --environment <environment> --service <app-service>
   ```

3. Inside the deployed app's shell, from its application directory (`/app`), look
   first, then reset:

   ```sh
   npm run demo:reset -- --dry-run
   npm run demo:reset
   ```

   It names the database and bucket, counts what goes, and asks you to type `reset`.

4. Refresh the demo and inspect the featured cover, back issues and logo library.

## What it does

- **Deletes** every issue (with its comments, reports and notifications), image,
  logo, sponsor, posting name and issue-import record.
- **Loads** the six seed issues, their 25 generated images and the seed logos,
  in the same database transaction as the delete. Regatta, issue 6, tops the library.
- **Keeps** members, their sessions and the magazine settings (name, footer,
  the discussion and PDF switches). Admins stay admins; a member's next comment
  asks for a posting name again. The AI assistant's ledger and grants
  (`ai_usage`, `ai_grants`) stay too, so a reset doesn't restore the month's
  budget; a deleted issue's rows keep counting with no issue attached.
- **Then sweeps storage:** every object in the bucket that no image row names is
  deleted — old uploads, avatars, imported images and cached PDFs, including
  anything orphaned before the script existed. Seed images keep fixed keys, so
  resets never leave copies of them. If the sweep fails, run the reset again.

It refuses unless `NEXT_PUBLIC_DEMO_MODE=1`, a variable set on the demo's Railway app
service and never on the members' production service, so it cannot run against the
members' site. The bucket sweep assumes the demo bucket is the demo's
alone (see [infrastructure.md](infrastructure.md#demo-project-marketing-showcase)). `--yes` skips the
prompt. Keep it a manual command: in a deployment hook it would replace edited issues
on every deploy.

`npm run db:seed -- --force` still replaces just the issues, images and logos, leaving
sponsors, posting names and stored objects in place.

[`railway ssh`](https://docs.railway.com/cli/ssh) runs inside the deployed container,
with its deployed source, variables and private database connection.
[`railway run`](https://docs.railway.com/cli/run) instead executes local source on
your computer with Railway variables; it is not a remote terminal.
