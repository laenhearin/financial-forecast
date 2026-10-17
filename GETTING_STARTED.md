# Your first day on Financial Forecast

This guide takes you from installing the tools to sharing your first feature with the team. Use the commands in VS Code's terminal, one line at a time. If a command fails, stop and resolve that error before continuing.

## 1. Understand what is shared—and what is yours

**Committing on your feature branch does not change `main`, your teammates' files, or the production app.** A commit saves a checkpoint locally on your current branch. Pushing uploads that branch to GitHub. The team deliberately merges your work into `main` after review.

- **Git** tracks changes to files and their history on your computer.
- **GitHub** hosts a shared copy of the repository online.
- **Repository (repo)** means the project files plus their Git history.
- **Clone** means downloading your own working copy of that repository.
- **`main`** is the team's shared integration branch. Keep it working.
- **Feature branch** is a separate line of work, usually for one task.
- **Commit** is a named checkpoint of selected changes on a branch.
- **Push** uploads local commits to GitHub.
- **Pull** brings remote changes into your local branch.
- **Pull request (PR)** proposes merging one branch into another and gives teammates a place to review it.
- **Merge** combines branch history and changes.
- **Deploy** builds and publishes an app version to a hosted URL.

| Action | What changes? | Does it change shared `main`? |
| --- | --- | --- |
| Save a file on your feature branch | Your local files; your local dev app may refresh immediately | No |
| Commit on your feature branch | Your local branch history | No |
| Push your feature branch | That branch on GitHub; configured automation may run | No |
| Open a PR targeting `main` | A review request on GitHub | No |
| Merge that PR | Shared `main` on GitHub | Yes |
| Pull `main` on your computer | Your local copy of `main` | Shared `main` is unchanged |

If hosting is configured to deploy production from `main`, merging can trigger a production deployment. A feature-branch push may create a separate preview deployment. The integrator should verify that production uses `main` and share which URL is production versus preview.

Branches are independent histories, not permissions or separate servers. Pushing directly to `main` changes shared `main`, and teammates pushing to the same feature branch share that branch. Give each task its own branch.

## 2. Integrator: prepare the shared project

The repository configured in this checkout is:

https://github.com/laenhearin/financial-forecast

1. Open the repository on GitHub and confirm the starter files appear on `main`.
2. Invite each teammate with permission to contribute. Each teammate must accept the invitation.
3. Share this guide and agree on file ownership from `TEAM.md`.
4. If available for this repository, configure a branch rule for `main` requiring pull requests and one approval. Require automated checks once those checks exist.
5. If using Vercel, verify production is connected to `main`. Share the production URL separately from preview URLs.

Teammates clone this one repository. They do not need to create new GitHub repositories or fork it when they have collaborator access.

## 3. Everyone: install the tools

Install Git, Node.js **24**, and VS Code. Create a GitHub account if you do not have one. GitHub Desktop is optional and can make authentication and reviewing changes easier.

After installation, restart VS Code and open **Terminal → New Terminal**. Check:

```sh
git --version
node --version
npm --version
```

Node should report `v24.x.x`. npm is installed with Node. This project uses npm; do not switch it to Yarn or pnpm.

Set the identity used on your commits, replacing the example values:

```sh
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Use an email associated with your GitHub account, or your GitHub-provided private commit email. These settings label commits; they do not log you into GitHub.

## 4. Clone and open the project

In a terminal opened in the parent folder where you keep projects, run:

```sh
git clone https://github.com/laenhearin/financial-forecast.git
cd financial-forecast
```

If prompted, complete GitHub authentication. If cloning says the repository is unavailable, check the URL, your signed-in account, and whether you accepted the invitation. GitHub Desktop can also clone the repository after you sign in.

In VS Code, open the newly created `financial-forecast` folder. Your integrated terminal should be in the folder containing `package.json`.

**Already have this repository on your computer?** Open that existing folder instead of cloning another copy inside it. The integrator's existing folder is `2026-10-16/tea/financial-forecast`.

Read `README.md`, `TEAM.md`, and `AGENTS.md` before changing files. Ask any coding assistant you use to read them too.

## 5. Install and run the app

Install exactly the dependencies recorded in the lockfile:

```sh
npm ci
```

In VS Code, copy `.env.example` to a new file named `.env.local` in the same folder. Leave the values blank until the integrator provides the relevant development credentials through a private channel.

`.env.local` stays on your computer and is ignored by Git. Never paste credentials into source code, PRs, or chat attached to the public repository. Teammates configure their own local environment files; the integrator separately configures hosting variables.

Start the app:

```sh
npm run dev
```

Open http://localhost:3000, or the address printed in your terminal. Keep this terminal running. Use a second terminal for Git commands. Press **Ctrl+C** in the server terminal to stop it.

The starter works with labeled demo data without credentials. Adding credentials alone does not implement or verify the Nessie connection.

Each teammate runs their own app on their own computer. Everyone can use `localhost:3000` simultaneously because `localhost` means “this computer.”

## 6. Create your branch before editing

Start a new task from an updated `main`:

```sh
git status
git switch main
git pull --ff-only origin main
git switch -c feature/calendar
```

Use a branch name for your actual task, such as `feature/nessie-accounts` or `feature/purchase-simulator`. The `-c` creates a new branch. To return to an existing branch later, use `git switch feature/calendar` without `-c`.

If `git status` shows unfinished changes, commit them on their intended branch or ask for help before switching. Uncommitted edits are not safely isolated in branch history: they may carry across a switch or prevent it. Do not discard them just to clear an error.

Check where you are:

```sh
git branch --show-current
```

It should show your feature branch. Edit your assigned files normally. Switching branches changes the files shown in this same folder; it does not create another folder.

## 7. Save a checkpoint, then share your branch

Review what you changed:

```sh
git status
git diff
```

Stage the specific files you intend to include. For example, after creating a calendar component:

```sh
git add src/components/pressure-calendar.tsx
git diff --staged
git commit -m "Add seven-day forecast calendar"
git push -u origin feature/calendar
```

Replace the file path and branch name with yours. Staging selects what goes into the next commit. New files may not appear in plain `git diff`; inspect them in your editor and in `git diff --staged` after staging.

The first push uses `-u` to connect your local branch to its GitHub counterpart. Later, after additional commits on that same branch, use `git push`.

**At this point, your work is backed up on GitHub on `feature/calendar`. `main` still has the previous app.** You can make multiple commits and push unfinished work to your feature branch.

## 8. Test and open a pull request

Run the project's checks from the project folder:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Also open the app and try the behavior you changed. Fix failures before requesting final review. These are local commands; do not assume GitHub automatically runs them until CI is configured.

On the GitHub repository, create a pull request with:

- **Base:** `main` (the destination).
- **Compare:** your feature branch (the proposed changes).
- **Title:** a short description, such as “Add seven-day forecast calendar.”
- **Description:** what changed, how you tested it, and any remaining limitations.
- **Reviewer:** the integrator or another teammate.

Use a draft PR if the work is still in progress. Opening a PR does not merge it. Additional commits pushed to the same branch automatically appear in that PR.

The reviewer checks the changes and the app behavior. After approval and passing checks, the designated merger merges the PR. This is when the feature enters shared `main`.

## 9. Pick up everyone's merged work

After your PR is merged, finish or save any remaining local edits, then:

```sh
git switch main
git pull --ff-only origin main
```

If the dependency files changed, stop the dev server, run `npm ci`, and restart it. Create a fresh branch from this updated `main` for your next task.

If you are still working on a feature while someone else's PR merges, bring updated `main` into your feature branch:

```sh
git status
git fetch origin
git merge origin/main
```

Run those commands while on your feature branch with a clean working tree. `fetch` downloads remote history without changing your files. `merge origin/main` incorporates the latest shared work into your branch; it does not merge your feature into shared `main`. Recheck your feature and push after resolving any conflicts.

## 10. Work simultaneously without stepping on each other

| Owner | Primary files / responsibility |
| --- | --- |
| Integrator | `src/app/page.tsx`, shared layout, deployment, `package.json`, `package-lock.json` |
| Calendar teammate | Create `src/components/pressure-calendar.tsx` and `src/components/day-details.tsx` |
| Nessie teammate | `src/lib/nessie.ts`, `src/app/api/dashboard/route.ts` |
| Forecast teammate | `src/lib/forecast.ts`, forecast tests, create `src/components/purchase-simulator.tsx` |

Coordinate changes to `src/lib/types.ts` before editing it. Keep money in integer cents and dates in `YYYY-MM-DD` format. Keep API keys and Nessie calls in server-only code.

Example: Alex pushes a calendar branch while Sam pushes a Nessie branch. Neither push changes `main`. Alex's PR is reviewed and merged first. Sam then merges `origin/main` into the Nessie branch, tests the combined behavior, and finishes the Nessie PR. After that PR merges, `main` contains both features.

Branches reduce interference while editing, but they do not guarantee independently developed features work together. Agree on shared types, keep PRs small, and merge reviewed work every few hours.

## 11. What to do when something goes wrong

**Git reports a merge conflict:** overlapping changes need a human decision. Open the conflicting files with the teammate who owns them, choose the correct combined code, and remove conflict markers. Stage the resolved files, finish the merge with `git commit`, test, and push. Do not blindly accept every “ours” or “theirs” change. To back out of an in-progress merge, use `git merge --abort`.

**You accidentally started editing on `main`, but have not committed:** create your feature branch now with `git switch -c feature/your-task`. Your edits come with you. Then review and commit there.

**You already committed on `main`, a push is rejected, or a pull cannot fast-forward:** ask the integrator to help inspect the history. Do not force-push or reset files to make an error disappear.

**Your teammate cannot see your work:** check whether you committed, pushed, and told them the branch name. Your feature will not appear on their local `main` until the PR is merged and they pull it.

**The app works for you but not for a teammate:** compare Node versions, run `npm ci` after dependency changes, and confirm each person has their required `.env.local` values. Do not share `node_modules` or `.next` folders.

## Daily checklist

1. Agree on a small task and file ownership.
2. Update `main`, then create a feature branch.
3. Edit, inspect, and commit your work on that branch.
4. Push the feature branch to GitHub.
5. Run checks and open a PR for review.
6. Merge after review; teammates pull updated `main`.

Remember: **save → commit → push → review → merge → deploy** are separate steps. Saving affects your local running app. A feature-branch commit does not immediately change the shared app.
