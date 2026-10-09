# Changesets

Every pull request that changes a published package (`anchorlist`, `@anchorlist/*`) must include a changeset.
Run `pnpm changeset`, pick the bump type, and describe the change for the changelog.

All published packages are versioned together (`fixed` group), so a bump to one bumps them all.
