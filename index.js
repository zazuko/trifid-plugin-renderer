import accepts from 'accepts'
import clone from 'lodash/clone.js'
import difference from 'lodash/difference.js'
import hijackResponse from 'hijackresponse'
import streamBuffers from 'stream-buffers'
import path from 'path'

import cottonCandy from 'cotton-candy'
import cottonCandyInclude from 'cotton-candy/include.js'
import cottonCandySetterGetter from 'cotton-candy/setter-getter.js'

const requestHeaderWhitelist = [
  'host',
  'x-forwarded-host',
  'x-forwarded-proto'
]

const responseHeaderWhitelist = [
  'link',
  'set-cookie'
]

function middleware (options) {
  const mediaTypes = (options.alternativeMediaTypes || []).concat(['html'])

  return (req, res, next) => {
    const accept = accepts(req)
    if (accept.type(mediaTypes) !== 'html') {
      return next()
    }

    // keep original headers to restore them later
    const reqHeaders = clone(req.headers)

    // remove all request header sent from the client which are not required
    difference(Object.keys(req.headers), requestHeaderWhitelist).forEach((name) => {
      delete req.headers[name]
    })

    // set html middleware request headers for the handler
    req.headers.accept = options.renderer.accept

    hijackResponse(res, (err, res) => {
      if (err) {
        res.unhijack()

        return next(err)
      }

      // add missing next in hijacked req
      req.next = (err) => {
        res.unhijack()

        next(err)
      }

      const graphBuffer = new streamBuffers.WritableStreamBuffer()

      graphBuffer.on('finish', () => {
        // restore original request headers for other hijack middlewares
        req.headers = reqHeaders

        const graphString = graphBuffer.getContentsAsString('utf8')

        // don't process graph if it's bigger than graphSizeLimit
        if (options.graphSizeLimit && (graphString || '').length > options.graphSizeLimit) {
          res.status(413)
        } else {
          res.locals.graph = graphString
        }

        res.locals.graph = graphString

        // remove all response headers sent from handler
        if (res.getHeaders()) {
          difference(Object.keys(res.getHeaders()), responseHeaderWhitelist).forEach((name) => {
            res.removeHeader(name)
          })
        }

        // set new response headers
        res.setHeader('content-type', 'text/html')

        // use renderer to build body
        if (res.statusCode === 200) {
          options.renderer.render(req, res)
        } else {
          options.renderer.error(req, res)
        }
      })

      res.pipe(graphBuffer)
    })

    next()
  }
}

const resolvePath = (modulePath) => {
  if (['.', '/'].includes(modulePath.slice(0, 1))) {
    return path.resolve(modulePath)
  } else {
    return modulePath
  }
}

const loader = async (modulePath) => {
  const middleware = await import(resolvePath(modulePath))
  return middleware.default
}

async function createRenderer (trifid) {
  const { config, server } = trifid

  // Load ES6 based templates
  if (server) {
    server.engine('html', cottonCandy({
      plugins: [
        cottonCandyInclude,
        cottonCandySetterGetter
      ],
      resolve: resolvePath
    }))
    server.set('view engine', 'cotton-candy')
  }

  // load render module
  const Renderer = await loader(config.module)

  // create instance and forward options to the constructor
  config.renderer = new Renderer(config)

  return middleware(config)
}

export default createRenderer
