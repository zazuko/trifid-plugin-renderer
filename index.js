const accepts = require('accepts')
const clone = require('lodash/clone')
const difference = require('lodash/difference')
const hijackResponse = require('hijackresponse')
const streamBuffers = require('stream-buffers')

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
    req.headers['accept'] = options.renderer.accept

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
        if (res._headers) {
          difference(Object.keys(res._headers), responseHeaderWhitelist).forEach((name) => {
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

function renderer (router, options) {
  return this.middleware.mountAll(router, options, (options) => {
    // load render module
    const Renderer = this.moduleLoader.require(options.module)

    // create instance and forward options to the constructor
    options.renderer = new Renderer(options)

    return middleware(options)
  })
}

module.exports = renderer
