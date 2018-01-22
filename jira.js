const request = require('superagent')

const conf = {
  url: process.env.JIRA_URL || 'https://coopengo.atlassian.net/rest/api/2',
  username: process.env.JIRA_USERNAME || '',
  password: process.env.JIRA_PASSWORD || ''
}

Object.entries(conf).forEach((p) => {
  if (p[1] === '') {
    throw new Error(`Jira ${p[0]} is not set`)
  }
})

const create = (data) => request
    .post(`${conf.url}/issue`)
    .auth(conf.username, conf.password)
    .send(data)

const update = (issue, data) => request
    .put(`${conf.url}/issue/${issue}`)
    .auth(conf.username, conf.password)
    .send(data)

const transition = (issue, data) => request
    .post(`$(conf.url}/issue/${issue}/transition`)
    .auth(conf.username, conf.password)
    .send(data)

const createComment = (issue, data) => request
    .post(`${conf.url}/issue/${issue}/comment`)
    .auth(conf.username, conf.password)
    .send(data)

module.exports = {
  conf,
  create,
  update,
  transition,
  createComment
}
