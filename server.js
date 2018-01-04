const request = require('superagent')
const Koa = require('koa')
const router = require('koa-router')()
const koaBody = require('koa-body')
const logger = require('koa-logger')

const convert = require('./convert')
const properties = require('./config')

// env
const JiraLogin = process.env.JIRA_LOGIN
const JiraPassword = process.env.JIRA_PASSWORD

const RedmineApi = process.env.REDMINE_JIRA_TOKEN

const JiraUrl = properties.JiraUrl
const RedmineUrl = properties.RedmineUrl

const postRequest = async (path, login, pass, data, type) => {
  return request.post(path)
        .auth(login, pass)
        .send(data)
        .type(type)
}

const putRequest = async (path, login, pass, data, type) => {
  return request.put(path)
        .auth(login, pass)
        .send(data)
        .type(type)
}

// Méthode pour récupérer un attachment Jira
const getAttachmentJira = async(attachment) => {
  const reqAtt = await request.get(attachment.content)
      .auth(JiraLogin, JiraPassword)
  const req = await postRequest(`${RedmineUrl}/uploads.json`, RedmineApi, '', reqAtt.body, 'octet-stream')
  return {token: req.body.upload.token, filename: attachment.filename, filetype: attachment.mimetype}
}

// Modification de l'issue Redmine
const updateIssue = async (data, key) => {
  await putRequest(`${RedmineUrl}/issues/${key}.json`, RedmineApi, '', {issue: data}, 'json')
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
          await putRequest(`${JiraUrl}/${treatment.key}${treatment.path}`, JiraLogin, JiraPassword, treatment.data, 'json')
          break
        case undefined:
          break
        default :
          await postRequest(`${JiraUrl}/${treatment.key}${treatment.path}`, JiraLogin, JiraPassword, treatment.data, 'json')
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

    const ret = await postRequest(`${RedmineUrl}/issues.json`, RedmineApi, '', treatment.data, 'json')
    const key = ret.body.issue.id
    if (treatment.coog) {
      updateIssue(treatment.coog, key)
    }
    if (treatment.comments.length) {
      for (const comment in comment) {
        updateIssue(treatment.comments[comment], key)
      }
    }
    const data = {'fields': {}}
    data.fields[`customfield_$(properties.redmineRef)`] = `${JiraUrl}/${ret.body.issue.id}`
    // Change custom_field_10052 to Jira Redmine field id
    await putRequest(`${JiraUrl}/${ctx.request.body.issue.key}`, JiraLogin, JiraPassword, data, 'json')
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
