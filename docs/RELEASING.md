# Releasing Triton packages

Triton publishes two npm packages in **lockstep** — they always share the same
version number:

| Package                             | Location        |
| ----------------------------------- | --------------- |
| `@cristianormazabal/triton-core`    | `packages/core` |
| `@cristianormazabal/triton-latex`   | `latex/`        |

The **root `package.json` `version` field is the single source of truth**. A
release bumps that value and syncs the identical version into
`packages/core/package.json` and `latex/package.json`, then publishes both.

## How to cut a release

Land a commit on `main` whose message contains a version tag:

- `[version:patch]` → `0.1.1` → `0.1.2`
- `[version:minor]` → `0.1.1` → `0.2.0`
- `[version:major]` → `0.1.1` → `1.0.0`

The tag is case-insensitive and can appear anywhere in the commit message.

**Copy-paste example:**

```bash
git commit -m "fix(core): correct edge routing for orthogonal hints [version:patch]"
git push origin main
```

That's it. The `.github/workflows/publish-npm.yml` workflow will:

1. Detect the tag and its level.
2. Install, typecheck, test, and build (release aborts if any fail).
3. Compute the new version and write it into all three `package.json` files.
4. Publish `@cristianormazabal/triton-core`, then `@cristianormazabal/triton-latex`.
5. Commit the bump as `chore(release): vX.Y.Z [skip ci]`, create an annotated
   tag `vX.Y.Z`, and push both to `main`.
6. Create a GitHub Release with auto-generated notes.

**No tag = no publish.** A push whose HEAD commit has no `[version:…]` tag is a
clean, green no-op — nothing is built or published. (The bot's own bump commit
carries `[skip ci]` and no version tag, so it never triggers a second release.)

### Bumping the version locally (optional)

You normally never do this by hand — the workflow does it — but the same script
is available as a root alias:

```bash
pnpm release:version patch     # or minor / major
pnpm release:version --set 1.2.3
```

It rewrites the `version` field in all three `package.json` files.

## One-time npm setup (owner must do this manually)

Publishing uses **OIDC Trusted Publishing** with provenance
(`npm publish --provenance`). No `NPM_TOKEN` is stored anywhere — npm trusts the
GitHub Actions workflow directly. This **cannot be automated** and must be
configured once per package on npmjs.com:

For **each** of `@cristianormazabal/triton-core` and
`@cristianormazabal/triton-latex`:

1. Sign in to <https://www.npmjs.com> as the package owner.
2. Open the package → **Settings** → **Publishing access** /
   **Trusted Publisher**.
3. Add a **GitHub Actions** trusted publisher:
   - Organization / user: `ormasoftchile`
   - Repository: `triton`
   - Workflow filename: `publish-npm.yml`
   - Environment: _leave blank_ (this workflow does not use a GitHub Environment)
4. Save.

> Until both packages have this configured, the publish steps will fail with an
> authentication error.

### Fallback: classic Automation token

If Trusted Publishing is unavailable, use a classic **Automation**
`NPM_TOKEN` instead:

1. Create an **Automation** access token on npm and add it as a repo secret
   named `NPM_TOKEN`.
2. In `publish-npm.yml`, `setup-node` already sets
   `registry-url: https://registry.npmjs.org`. Add the token to the publish
   steps via an env var:

   ```yaml
   env:
     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

   npm reads `NODE_AUTH_TOKEN` automatically for `registry.npmjs.org`. You can
   keep or drop `--provenance` (provenance still works with a token when
   `id-token: write` is granted).

## Verifying a release

```bash
npm view @cristianormazabal/triton-core version
npm view @cristianormazabal/triton-latex version
```

Both should report the new version. Also check the
[GitHub Releases page](https://github.com/ormasoftchile/triton/releases) for the
`vX.Y.Z` release and its generated notes.

## Emergency manual publish

If you must publish outside CI (e.g. Trusted Publishing is down), from a clean
checkout at the intended version:

```bash
# core — dist is produced by the root build
pnpm install --frozen-lockfile
pnpm build
cd packages/core && npm publish --access public

# latex — installs and builds independently
cd latex
pnpm install --frozen-lockfile
npm run build           # prepublishOnly also runs this
npm publish --access public
```

Make sure all three `package.json` files carry the same version first
(`pnpm release:version --set X.Y.Z`), then commit and tag `vX.Y.Z` by hand to
keep history consistent.
