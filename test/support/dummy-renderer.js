class DummyRenderer {
  constructor () {
    this.accept = 'application/ld+json'
  }

  render (req, res) {
    res.end('<html><head><script type="application/json">' + res.locals.graph + '</script></head></html>')
  }

  error (req, res) {
    res.end('<html><head><script type="application/json">{"status": ' + res.statusCode + '}</script></head></html>')
  }
}

module.exports = DummyRenderer
