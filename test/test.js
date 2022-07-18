import assert from 'assert'
import clone from 'lodash/clone.js'
import express from 'express'
import { describe, it } from 'mocha'

import hijackResponse from 'hijackresponse'
import path from 'path'
import createRenderer from '../index.js'
import request from 'supertest'

import { URL } from 'url'

const __dirname = new URL('.', import.meta.url).pathname

describe('trifid-plugin-renderer', () => {
  it('should be a factory', () => {
    assert.strictEqual(typeof createRenderer, 'function')
  })

  it('should do nothing if request doesn\'t accept html', async () => {
    const app = express()

    const rendererModule = await createRenderer({
      config: {
        module: path.join(__dirname, 'support/dummy-renderer.js')
      }
    })
    const content = { key: 'value' }
    app.use(rendererModule)
    app.use((_req, res) => {
      res.json(content)
    })

    const res = await request(app).get('/').set('accept', 'application/json')
    assert.deepStrictEqual(res.body, content)
  })

  it('should use the renderer to process the graph', async () => {
    const app = express()

    const rendererModule = await createRenderer({
      config: {
        module: path.join(__dirname, 'support/dummy-renderer.js')
      }
    })
    const content = { key: 'value' }
    app.use(rendererModule)
    app.use((_req, res) => {
      res.json(content)
    })

    const res = await request(app).get('/').set('accept', 'text/html')
    assert.deepStrictEqual(res.text, '<html><head><script type="application/json">' + JSON.stringify(content) + '</script></head></html>')
  })

  it('should check the qvalue in the accept headers', async () => {
    const app = express()

    const rendererModule = await createRenderer({
      config: {
        module: path.join(__dirname, 'support/dummy-renderer.js'),
        alternativeMediaTypes: ['application/json']
      }
    })
    const content = { key: 'value' }
    app.use(rendererModule)
    app.use((_req, res) => {
      res.json(content)
    })
    const res = await request(app).get('/').set('accept', 'application/json;q=0.9,text/html;q=0.8')

    assert.deepStrictEqual(res.body, content)
  })

  it('should restore original request headers', () => {
    const app = express()

    let reqHeaders

    app.use((req, res, next) => {
      reqHeaders = clone(req.headers)

      hijackResponse(res, (_err, res) => {
        assert.deepStrictEqual(res.req.headers, reqHeaders)
        res.pipe(res)
      })

      next()
    })

    const context = {}

    return createRenderer.call(context, {
      config: {
        module: path.join(__dirname, 'support/dummy-renderer.js'),
        alternativeMediaTypes: ['application/json']
      }
    }).then(() => {
      const content = { key: 'value' }

      app.use((_req, res) => {
        res.json(content)
      })

      return request(app).get('/').set('accept', 'text/html')
    })
  })
})
