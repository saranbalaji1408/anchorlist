---
'@anchorlist/core': patch
---

core: `destroy()` (and so `attach()`) resets the touch state, so a list re-attached mid-touch commits deferred corrections instead of holding them in a transform until the next touch ends.
