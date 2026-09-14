# @dimwitlabs/parcourse-brand

Every colour, radius and shadow Parcourse draws with, plus the marks themselves.
Parcourse uses it, and so does anything else that has to look like Parcourse.

```css
@import "@dimwitlabs/parcourse-brand/styles.css";
```

`styles.css` is the whole of Parcourse's stylesheet, and it pulls in `tokens.css`
itself. Parcourse draws with it and nothing else, so anything built on it looks
exactly like Parcourse. When the app changes, this changes with it.

The tokens are plain custom properties on `:root`, built on `light-dark()`, so a
page picks up both themes by setting `color-scheme` and nothing else.

Assets sit alongside them:

| File | What it is |
| --- | --- |
| `assets/parcourse.svg` | The mark on its own, tall. |
| `assets/parcourse-square.svg` | The mark padded into a square, for favicons and app icons. |
| `assets/parcourse-wordmark.svg` | Mark and name, for light backgrounds. |
| `assets/parcourse-wordmark-dark.svg` | The same, for dark ones. |

Published to GitHub Packages. Consumers need a line in `.npmrc`:

```
@dimwitlabs:registry=https://npm.pkg.github.com
```
