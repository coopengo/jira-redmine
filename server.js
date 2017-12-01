const request = require('superagent')
const Koa = require('koa')
const router = require('koa-router')()
const koaBody = require('koa-body')
const logger = require('koa-logger')

const convert = require('./convert')

// env
const JiraLogin = process.env.JIRA_LOGIN
const JiraPassword = process.env.JIRA_PASSWORD
const RedmineApi = process.env.REDMINE_JIRA_TOKEN

const JiraUrl = process.env.JIRA_URL
const RedmineUrl = process.env.REDMINE_URL

// Méthode pour récupérer un attachment Jira
const getAttachmentJira = async(attachment) => {
  const reqAtt = await request.get(attachment.content)
      .auth(JiraLogin, JiraPassword)
  const req = await request.post(`${RedmineUrl}/uploads.json`)
      .auth(RedmineApi, '')
      .send(reqAtt.body)
      .set('content-type', 'application/octet-stream')
  return {token: req.body.upload.token, filename: attachment.filename, filetype: attachment.mimetype}
}

// Modification de l'issue Redmine
const updateIssue = async (data, key) => {
  await request.put(`${RedmineUrl}/issues/${key}.json`)
    .type('json')
    .send({issue: data})
    .auth(RedmineApi, '')
}

const main = async () => {
  const app = new Koa()

  app.on('error', function (err) {
    console.log(err)
  })

  app.use(logger())

  router.post('/redmine', koaBody(), async(ctx) => {
    if (!ctx.ip.match(/172./)) {
      console.error('UNAUTHORIZED CON')
      return
    }
    const treatment = convert.RedmineTreatment(ctx.request.body.payload)
    if (treatment) {
      switch (treatment.path) {
        case '':
          await request.put(`${JiraUrl}/${treatment.key}${treatment.path}`)
              .auth(JiraLogin, JiraPassword)
              .type('json')
              .send(treatment.data)
          break
        case undefined:
          break
        default :
          await request.post(`${JiraUrl}/${treatment.key}${treatment.path}`)
              .auth(JiraLogin, JiraPassword)
              .type('json')
              .send(treatment.data)
          break
      }
    }
  })

  router.post('/jira/update', koaBody(), async(ctx) => {
    if (ctx.ip !== '::ffff:185.166.140.229') {
      console.error('UNAUTHORIZED CON')
      return
    }
    const treatment = await convert.JiraUpdate(ctx.request.body)

    if (treatment) {
      updateIssue(treatment.data, treatment.key)
    }
  })

  router.post('/jira/create', koaBody(), async(ctx) => {
    if (ctx.ip !== '::ffff:185.166.140.229') {
      console.error('UNAUTHORIZED CON')
      return
    }
    const treatment = await convert.JiraCreate(ctx.request.body.issue)

    const ret = await request.post(`${RedmineUrl}/issues.json`)
      .auth(RedmineApi, '')
      .type('json')
      .send(treatment.data)
    const key = ret.body.issue.id
    if (treatment.coog) {
      updateIssue(treatment.coog, key)
    }
    if (treatment.comments.length) {
      for (const comment in comment) {
        updateIssue(treatment.comments[comment], key)
      }
    }
    await request.put(`${JiraUrl}/${ctx.request.body.issue.key}`)
      .auth(JiraLogin, JiraPassword)
      .type('json')
      .send({fields: {customfield_10052: `${JiraUrl}/${ret.body.issue.id}`}})
  })

  router.post('/jira/comment', koaBody(), async(ctx) => {
    if (ctx.ip !== '::ffff:185.166.140.229') {
      console.error('UNAUTHORIZED CON')
      return
    }
    const treatment = await convert.JiraComment(ctx.request.body)

    if (treatment) {
      updateIssue(treatment.data, treatment.key)
    }
  })

  app.use(router.routes())
  app.listen(80)

  return `web server started on port 80`
}
module.exports = {
  getAttachmentJira
}

main().then(
  (res) => console.log(res),
  (err) => {
    console.error(err)
    process.exit(1)
  })
