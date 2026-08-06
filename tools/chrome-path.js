/* Where Chrome is, for every tool here that drives one.
 *
 * The default is the macOS install, because that is where this prototype is
 * built. CI is not macOS: `.github/workflows/prototype-refresh.yml` sets
 * CHROME_PATH to the runner's own Chrome, and a tool that ignores it fails on
 * the runner with a path that cannot exist there. Three of the four browser
 * tools hardcoded the macOS path and only `build-usecases.js` read the
 * variable, so the first CI run of that workflow got through the use-case
 * captures and then died in `shoot-previews.js` — which is exactly the shape
 * a shared resolver prevents.
 *
 * Keep the fallback: passing CHROME_PATH on a developer's Mac should stay
 * optional. */
module.exports = function chromePath() {
  return process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
};
