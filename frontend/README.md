# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## PWA / Offline Support

FlowIQ ships a minimal service worker (`public/sw.js`) that provides a
**cache-first offline experience** for the app shell (HTML, JS bundle, CSS,
icons, manifest).

### How it works

| Request type | Strategy | Reason |
|---|---|---|
| Static / app shell assets | Cache-first | Fast loads; assets are fingerprinted per build |
| `/api/*` calls | Network-first | Always fetch fresh data; returns `{"error":"offline"}` (HTTP 503) when offline |
| HTML navigation (offline) | Cache fallback → `/index.html` | Keeps the React SPA router alive even without a network |

Non-GET requests and cross-origin requests are never intercepted.

### Bumping the cache version

When you need to force all clients to re-download the app shell (e.g. after a
major layout change or icon update), increment the version string in
`public/sw.js`:

```js
const CACHE_NAME = 'flowiq-shell-v2'; // ← bump this
```

Then redeploy. The `activate` handler automatically deletes all caches whose
name no longer matches `CACHE_NAME`.

### Limitations (beta)

- The JS/CSS bundles are **not** pre-cached during `install` (their filenames
  are hashed by Webpack and unknown at build time). They are cached
  **on first request** and served from cache thereafter.
- API responses are never cached — any page that relies solely on live API data
  will show an error state when offline.
- The service worker is **only registered in production** (`NODE_ENV=production`).
  Development builds are unaffected.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
