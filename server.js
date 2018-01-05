const Koa = require('koa')
const router = require('koa-router')()
const koaBody = require('koa-body')
const logger = require('koa-logger')

const convert = require('./convert')
const properties = require('./config')
const requestModule = require('./requestModule')

// env
const JiraLogin = process.env.JIRA_LOGIN
const JiraPassword = process.env.JIRA_PASSWORD

const RedmineApi = process.env.REDMINE_JIRA_TOKEN

const JiraUrl = properties.JiraUrl
const RedmineUrlInternal = properties.RedmineUrlInternal
const RedmineUrlExternal = properties.RedmineUrlExternal

const postRequest = requestModule.postRequest
const putRequest = requestModule.putRequest

// Modification de l'issue Redmine
const updateIssue = async (data, key) => {
  await putRequest(`${RedmineUrlInternal}/issues/${key}.json`, RedmineApi, '', {issue: data}, 'json')
}

const main = async () => {
  const app = new Koa()

  app.on('error', function (err) {
    console.log(err)
  })

  app.use(logger())

  router.post('/redmine', koaBody(), async(ctx) => {
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
    const treatment = await convert.JiraUpdate(ctx.request.body)

    if (treatment) {
      await updateIssue(treatment.data, treatment.key)
    }
  })

  router.post('/jira/create', koaBody(), async(ctx) => {
    const treatment = await convert.JiraCreate(ctx.request.body.issue)

    const ret = await postRequest(`${RedmineUrlInternal}/issues.json`, RedmineApi, '', treatment.data, 'json')
    const key = ret.body.issue.id
    if (treatment.coog) {
      updateIssue(treatment.coog, key)
    }
    if (treatment.comments.length) {
      for (const comment in treatment.comments) {
        updateIssue(treatment.comments[comment], key)
      }
    }
    const data = {'fields': {}}
    data.fields[`customfield_${properties.JiraRedmineRef}`] = `${RedmineUrlExternal}/issues/${ret.body.issue.id}`
    await putRequest(`${JiraUrl}/${ctx.request.body.issue.key}`, JiraLogin, JiraPassword, data, 'json')
  })

  router.post('/jira/comment', koaBody(), async(ctx) => {
    const treatment = await convert.JiraComment(ctx.request.body)

    if (treatment) {
      updateIssue(treatment.data, treatment.key)
    }
  })

  app.use(router.routes())
  app.listen(80)

  return `web server started on port 80`
}

main().then(
  (res) => console.log(res),
  (err) => {
    console.error(err)
    process.exit(1)
  })
