const request = require('superagent')

const conf = {
  internalURL: process.env.REDMINE_INT_URL || 'http://redmine:3000',
  externalURL: process.env.REDMINE_EXT_URL || 'https://support.coopengo.com',
  token: process.env.REDMINE_TOKEN || ''
}

Object.entries(conf).forEach((p) => {
  if (p[1] === '') {
    throw new Error(`Redmine ${p[0]} is not set`)
  }
})

const create = (data) => request
    .post(`${conf.internalURL}/issues.json`)
    .auth(conf.token, '')
    .send({issue: data})

const update = (issue, data) => request
    .put(`${conf.internalURL}/issues/${issue}.json`)
    .auth(conf.token, '')
    .send({issue: data})

module.exports = {
  conf,
  create,
  update
}
