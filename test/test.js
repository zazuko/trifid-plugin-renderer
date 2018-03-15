/* global describe, it */

const assert = require('assert')
const clone = require('lodash/clone')
const express = require('express')
const hijackResponse = require('hijackresponse')
const path = require('path')
const renderer = require('..')
const request = require('supertest')
const middleware = require('trifid-core/lib/middleware')
const moduleLoader = require('trifid-core/lib/module-loader')

describe('trifid-plugin-renderer', () => {
  it('should be a factory', () => {
    assert.equal(typeof renderer, 'function')
  })

  it('should do nothing if request doesn\'t accept html', () => {
    const app = express()

    const context = {
      middleware,
      moduleLoader
    }

    return renderer.call(context, app, {
      root: {
        module: path.join(__dirname, 'support/dummy-renderer')
      }
    }).then(() => {
      const content = {key: 'value'}

      app.use((req, res) => {
        res.json(content)
      })

      return request(app)
        .get('/')
        .set('accept', 'application/json')
        .then((res) => {
          assert.deepEqual(res.body, content)
        })
    })
  })

  it('should use the renderer to process the graph', () => {
    const app = express()

    const context = {
      middleware,
      moduleLoader
    }

    return renderer.call(context, app, {
      root: {
        module: path.join(__dirname, 'support/dummy-renderer')
      }
    }).then(() => {
      const content = {key: 'value'}

      app.use((req, res) => {
        res.json(content)
      })

      return request(app)
        .get('/')
        .set('accept', 'text/html')
        .then((res) => {
          assert.deepEqual(res.text, '<html><head><script type="application/json">' + JSON.stringify(content) + '</script></head></html>')
        })
    })
  })

  it('should check the qvalue in the accept headers', () => {
    const app = express()

    const context = {
      middleware,
      moduleLoader
    }

    return renderer.call(context, app, {
      root: {
        module: path.join(__dirname, 'support/dummy-renderer'),
        alternativeMediaTypes: ['application/json']
      }
    }).then(() => {
      const content = {key: 'value'}

      app.use((req, res) => {
        res.json(content)
      })

      return request(app)
        .get('/')
        .set('accept', 'application/json;q=0.9,text/html;q=0.8')
        .then((res) => {
          assert.deepEqual(res.body, content)
        })
    })
  })

  it('should restore original request headers', () => {
    const app = express()

    let reqHeaders

    app.use((req, res, next) => {
      reqHeaders = clone(req.headers)

      hijackResponse(res, (err, res) => {
        if (err) {}

        assert.deepEqual(res.req.headers, reqHeaders)

        res.pipe(res)
      })

      next()
    })

    const context = {
      middleware,
      moduleLoader
    }

    return renderer.call(context, app, {
      root: {
        module: path.join(__dirname, 'support/dummy-renderer'),
        alternativeMediaTypes: ['application/json']
      }
    }).then(() => {
      const content = {key: 'value'}

      app.use((req, res) => {
        res.json(content)
      })

      return request(app)
        .get('/')
        .set('accept', 'text/html')
    })
  })
})
