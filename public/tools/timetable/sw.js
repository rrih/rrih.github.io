/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  const registry = {}

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + '.js', parentUri).href
    return (
      registry[uri] ||
      new Promise((resolve) => {
        if ('document' in self) {
          const script = document.createElement('script')
          script.src = uri
          script.onload = resolve
          document.head.appendChild(script)
        } else {
          nextDefineUri = uri
          importScripts(uri)
          resolve()
        }
      }).then(() => {
        const promise = registry[uri]
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`)
        }
        return promise
      })
    )
  }

  self.define = (depsNames, factory) => {
    const uri =
      nextDefineUri || ('document' in self ? document.currentScript.src : '') || location.href
    if (registry[uri]) {
      // Module is already loading or loaded.
      return
    }
    const exports = {}
    const require = (depUri) => singleRequire(depUri, uri)
    const specialDeps = {
      module: { uri },
      exports,
      require,
    }
    registry[uri] = Promise.all(
      depsNames.map((depName) => specialDeps[depName] || require(depName))
    ).then((deps) => {
      factory(...deps)
      return exports
    })
  }
}
define(['./workbox-1e826536'], (workbox) => {
  importScripts()
  self.skipWaiting()
  workbox.clientsClaim()

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute(
    [
      {
        url: '/_next/static/chunks/1118-636577a3e59f42e4.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/1176-9775e6f7cd34a4f5.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/1458-16099023a62e4100.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/1614-60ba1d1a6890e2d6.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/2017-044408b553ed5fc2.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/2101-248d47a4254cc22a.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/2225-867ca7536b05d146.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/2374-1caac41d1325b500.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/3127-9fbf56ad55f17323.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/3142-c454b2fc7d2d5678.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/33-3feaa6c1ed240500.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/3314-f20a0582a8bf52e0.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/3581-684006cd4be4b0a8.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/4022-58c54a32168a1ef6.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/4239-ff357d77adfd80de.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/4bd1b696-a5a3ae3d62f9eefb.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/5126-d6d4d6869efcbd38.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/5238-5fbd9e450832d602.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/5283-641c828dd9bc4bbe.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/5572-4b7a80da71e26979.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/5810-db42e8fd75b0a2ff.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/6182-fead2f0965cbfff5.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/6382-78e353bd058d5e6c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/686-c694ed022c9e9e2e.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/7084-82b79305a8306287.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/728-0a4ca3c60b2cf679.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/7339-3068544d47552864.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/7455-99c2700b7959fcd1.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/7653-4a0622206e93263d.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/7654-9842fc0a82cb8995.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/8379-c46da913952d9a96.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/8571-bba68bc877746b4a.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/9051-4e7ac782a9bbfe94.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/9572-5a75c68a017543c1.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/9701-1111a7ddec3fa9dc.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/9783-9608a63ba0f840fe.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/ad2866b8-e61efaab7b01bf9f.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/about/page-bcf25c6623254bea.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/app/achievement-tree/page-93019ca0b9475b91.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/blog/%5Bslug%5D/page-55ab3dde2362e16c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/blog/articles/page-42f5232a55844f0e.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/blog/category/%5Bcategory%5D/page-1fdec03b11c8695c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/blog/layout-3e9b2b3b035ad2c0.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/blog/page-644fe68f07d3836c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/blog/tag/%5Btag%5D/page-9f6ee4f2d9f77995.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/layout-43ccd21c310d09a9.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/page-08f1f2be6171c17c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/privacy/page-739b6d1754044e21.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/terms/page-f65ea1c9ebaf071b.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/%5Blocale%5D/tools/%5Btool%5D/page-a10be90e5e40eb4c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/_not-found/page-f9a4243b08ef9b50.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/about/page-acb7818a285104fb.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/app/achievement-tree/page-a7460c1b8403e0b5.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/blog/%5Bslug%5D/page-329f7b86b17f4a73.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/blog/articles/page-449116b8ff3cee0b.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/blog/category/%5Bcategory%5D/page-942ed611d7154194.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/blog/layout-47632126070878b1.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/blog/page-98808fc76484a29c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/blog/tag/%5Btag%5D/page-ff3cb015d30fd049.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/layout-e077f640ec4761f7.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/not-found-13b8e1fe5870f769.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/page-ea1f7b1a2f0271cf.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/privacy/page-86833d915429cd98.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/terms/page-84f800a1c4c9e911.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/animation-generator/layout-63c17bb2b1eb2d4d.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/animation-generator/page-038c4ff87ff399ab.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/base64/layout-82f0dbea55e4c353.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/base64/page-c8fe403cf2c0419d.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/box-shadow-generator/layout-0a8db9de369e46f4.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/box-shadow-generator/page-8dde4567ace82ebd.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/color-picker/layout-d4c3e77531da8fb0.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/color-picker/page-d40ccacd12c72798.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/gradient-generator/layout-b69480db94d1916b.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/gradient-generator/page-a8dc112d78bb8866.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/homework-tracker/layout-ecc4c078553c28b8.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/homework-tracker/page-0b5d48d2d855d779.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/image-converter/layout-3065e97dae4bb6b3.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/image-converter/page-3fa056ae870f8441.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/investment-calculator/layout-0f628267700c6084.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/investment-calculator/page-2360bba7fad6931d.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/json-formatter/layout-434a681ea208f5d9.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/json-formatter/page-2ad85920f6fb066f.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/markdown-editor/layout-2a03d0b80b06410d.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/markdown-editor/page-31781ba98f2cda70.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/password-generator/layout-f785b6a35e9c70b2.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/password-generator/page-ba5a32ae552c1bfe.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/qr-generator/layout-bd9fe0fea32ede1f.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/qr-generator/page-a70468a07146367c.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/timetable/layout-be8ea7c68efb48b0.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/timetable/page-0e865639b4776e46.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/uuid-generator/layout-1106015c11b9c1cf.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/app/tools/uuid-generator/page-09649300d8a1ebc4.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/framework-42cf344f87404319.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/main-app-dff11d2e241cff11.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/main-b39ae2c49077dc14.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/pages/_app-7b6d0eccb6d4eec5.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/pages/_error-c5a2488fbbd04e67.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
        revision: '846118c33b2c0e922d7b3a7676f81f6f',
      },
      {
        url: '/_next/static/chunks/webpack-61488ab4b071205d.js',
        revision: 'xGguqzgCsdbNJtaV7Kve5',
      },
      {
        url: '/_next/static/css/b230b5ed20e52fcc.css',
        revision: 'b230b5ed20e52fcc',
      },
      {
        url: '/_next/static/xGguqzgCsdbNJtaV7Kve5/_buildManifest.js',
        revision: '5e7c848f5d5ad814128c8b99f05bd3f5',
      },
      {
        url: '/_next/static/xGguqzgCsdbNJtaV7Kve5/_ssgManifest.js',
        revision: 'b6652df95db52feb4daf4eca35380933',
      },
      {
        url: '/ads.txt',
        revision: '3adbf29f9b055d17d550183bd1e699d1',
      },
      {
        url: '/browserconfig.xml',
        revision: 'f211afc83fb6f9d915d411fb76545343',
      },
      {
        url: '/icons/icon-128x128.png',
        revision: 'c63a44b54a5ff8a77d37795de8f6aa0f',
      },
      {
        url: '/icons/icon-144x144.png',
        revision: '78bf1dd8983a89056a582308fcce67de',
      },
      {
        url: '/icons/icon-152x152.png',
        revision: 'd5999f612093d895754ae71d75740c89',
      },
      {
        url: '/icons/icon-192x192.png',
        revision: 'c575b4ebaca7e76bc85e70be1710e7e8',
      },
      {
        url: '/icons/icon-384x384.png',
        revision: '8bc3e24ce904560085dd8aeb7e68c0f9',
      },
      {
        url: '/icons/icon-512x512.png',
        revision: '1e8a87a7bb5921830b42103b34e166cf',
      },
      {
        url: '/icons/icon-72x72.png',
        revision: 'a75cf1b8c7cbd59e5cfa844e925c5f7d',
      },
      {
        url: '/icons/icon-96x96.png',
        revision: 'fb439436e554aedba0e5669c09d06b4d',
      },
      {
        url: '/icons/poodware_1024.png',
        revision: '8395a1b336741d9946e500375ede3ff7',
      },
      {
        url: '/llms.txt',
        revision: 'eed0bf9417c5855d866cf7a38381bef1',
      },
      {
        url: '/og/animation-generator.png',
        revision: '18d494984cae71788e1fc72c54f6d56d',
      },
      {
        url: '/og/base64.png',
        revision: '6e349639c370584e2f592572dc2fcfae',
      },
      {
        url: '/og/blog-create-secure-passwords-that-you-can-remember.png',
        revision: 'f73643ccf6052d4da71adb921611d6fa',
      },
      {
        url: '/og/blog-embed-images-in-html-email-base64.png',
        revision: '3d510b7c2e494260edb2ea2516179706',
      },
      {
        url: '/og/blog-generate-qr-codes-for-your-business.png',
        revision: 'b26c9a6affe0e9a7076afc5b45405fec',
      },
      {
        url: '/og/blog-how-to-format-messy-json-data.png',
        revision: '38a23a81ee691d031f659c0521255c5c',
      },
      {
        url: '/og/blog-make-beautiful-css-gradients-without-code.png',
        revision: '2485286b7411afcad270102b9ecd96da',
      },
      {
        url: '/og/box-shadow-generator.png',
        revision: '51a75cdf4e8ec9f5081ff77c8a48650c',
      },
      {
        url: '/og/color-picker.png',
        revision: 'd2e0508987f3e98a0f3cf8b8a868396b',
      },
      {
        url: '/og/gradient-generator.png',
        revision: '4b5532f426b0747c91af4faa620c2c3e',
      },
      {
        url: '/og/home.png',
        revision: '1c97235a3a1c9f1e11bf5ef118e29cdd',
      },
      {
        url: '/og/homework-tracker.png',
        revision: 'cf421bf5d887c05f25ff8b339b740c6e',
      },
      {
        url: '/og/image-converter.png',
        revision: 'f6f8aa33d299739bfc179b7fc4bfc400',
      },
      {
        url: '/og/investment-calculator.png',
        revision: '29df2848e302aeff56b0b43cc8cba31f',
      },
      {
        url: '/og/json-formatter.png',
        revision: '724fa873e162d12622556fd47451a534',
      },
      {
        url: '/og/markdown-editor.png',
        revision: '8b16fc13bc28f9755789e90c69dee6eb',
      },
      {
        url: '/og/password-generator.png',
        revision: '00a30ce4b80a51942dd21817c2981e4e',
      },
      {
        url: '/og/qr-generator.png',
        revision: '0f7e50e72dd069177535ed4be6dbd662',
      },
      {
        url: '/og/timetable.png',
        revision: '0cf4377ad5e8b4050aa29187c0eb2648',
      },
      {
        url: '/og/uuid-generator.png',
        revision: 'c62dd0f0e726cb8e86678312e9b54107',
      },
      {
        url: '/robots.txt',
        revision: '1bb04c5e19878f88d6aef000cf9de2ac',
      },
      {
        url: '/sitemap.xml',
        revision: 'c26e5524639d130ee2e171d4b9a0e441',
      },
      {
        url: '/tools/timetable/manifest.webmanifest',
        revision: '887ad95cd87b1b17fdb82df70c9b05d4',
      },
      {
        url: '/tools/timetable/workbox-1e826536.js',
        revision: '1a346f26e02f53bc2c5fc4511f8d2270',
      },
    ],
    {
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
    }
  )
  workbox.cleanupOutdatedCaches()
  workbox.registerRoute(
    '/',
    new workbox.NetworkFirst({
      cacheName: 'start-url',
      plugins: [
        {
          cacheWillUpdate: function (_) {
            return _ref.apply(this, arguments)
          },
        },
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
    new workbox.CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 31536000,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 604800,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-font-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 4,
          maxAgeSeconds: 604800,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-image-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 2592000,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\/_next\/static.+\.js$/i,
    new workbox.CacheFirst({
      cacheName: 'next-static-js-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\/_next\/image\?url=.+$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'next-image',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:mp3|wav|ogg)$/i,
    new workbox.CacheFirst({
      cacheName: 'static-audio-assets',
      plugins: [
        new workbox.RangeRequestsPlugin(),
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:mp4|webm)$/i,
    new workbox.CacheFirst({
      cacheName: 'static-video-assets',
      plugins: [
        new workbox.RangeRequestsPlugin(),
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:js)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-js-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 48,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:css|less)$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'static-style-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\/_next\/data\/.+\/.+\.json$/i,
    new workbox.StaleWhileRevalidate({
      cacheName: 'next-data',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    /\.(?:json|xml|csv)$/i,
    new workbox.NetworkFirst({
      cacheName: 'static-data-assets',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    (param) => {
      var e = param.sameOrigin,
        _param_url = param.url,
        t = _param_url.pathname
      return !(!e || t.startsWith('/api/auth/callback')) && !!t.startsWith('/api/')
    },
    new workbox.NetworkFirst({
      cacheName: 'apis',
      networkTimeoutSeconds: 10,
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 16,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    (param) => {
      var e = param.request,
        _param_url = param.url,
        t = _param_url.pathname,
        a = param.sameOrigin
      return (
        '1' === e.headers.get('RSC') &&
        '1' === e.headers.get('Next-Router-Prefetch') &&
        a &&
        !t.startsWith('/api/')
      )
    },
    new workbox.NetworkFirst({
      cacheName: 'pages-rsc-prefetch',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    (param) => {
      var e = param.request,
        _param_url = param.url,
        t = _param_url.pathname,
        a = param.sameOrigin
      return '1' === e.headers.get('RSC') && a && !t.startsWith('/api/')
    },
    new workbox.NetworkFirst({
      cacheName: 'pages-rsc',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    (param) => {
      var _param_url = param.url,
        e = _param_url.pathname,
        t = param.sameOrigin
      return t && !e.startsWith('/api/')
    },
    new workbox.NetworkFirst({
      cacheName: 'pages',
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 86400,
        }),
      ],
    }),
    'GET'
  )
  workbox.registerRoute(
    (param) => {
      var e = param.sameOrigin
      return !e
    },
    new workbox.NetworkFirst({
      cacheName: 'cross-origin',
      networkTimeoutSeconds: 10,
      plugins: [
        new workbox.ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 3600,
        }),
      ],
    }),
    'GET'
  )
})
