const Koa = require('koa')
const logger = require('koa-logger')
const route = require('koa-route')
const body = require('koa-body')
const debug = require('debug')('bridge')
const debugHTTP = require('debug')('bridge:http')

const config = require('./config')
const redmine = require('./redmine')
const jira = require('./jira')
const convert = require('./convert')

const main = async () => {
  const app = new Koa()

  app.on('error', function (err) {
    console.log(err)
  })

  app.use(logger())
  app.use(body())
  app.use(async (ctx, next) => {
    ctx.id = Math.floor(Math.random() * Math.floor(1000000))
    debugHTTP('path: %s', ctx.path)
    debugHTTP('query: %O', ctx.query)
    debugHTTP('body: %O', ctx.request.body)
    await next()
  })

  app.use(route.post('/jira/create', async(ctx) => {
    const jiraKey = ctx.request.body.issue.key
    debug('%d jira/create jira:%s', ctx.id, jiraKey)
    const create = await convert.j2rCreateIssue(ctx.request.body)
    debug('%d jira/create upload:%o', ctx.id, create)
    const ret = await redmine.create(create)
    const redmineKey = ret.body.issue.id
    debug('%d jira/create redmine:%o', ctx.id, redmineKey)
    await jira.update(jiraKey, {fields: {
      [`customfield_${config.JiraRedmineRef}`]: `${redmine.conf.externalURL}/issues/${redmineKey}`
    }})
    ctx.body = {
      msg: redmineKey
    }
  }))

  app.use(route.post('/jira/update', async(ctx) => {
    const jiraKey = ctx.request.body.issue.key
    debug('%d jira/update jira:%s', ctx.id, jiraKey)
    const {key, update} = await convert.j2rUpdateIssue(ctx.request.body)
    debug('%d jira/update redmine:%s', ctx.id, key)
    debug('%d jira/update upload:%o', ctx.id, update)
    if (key) {
      await redmine.update(key, update)
      ctx.body = {
        msg: 'ok'
      }
    } else {
      ctx.body = {
        msg: 'nothing'
      }
    }
  }))

  app.use(route.post('/jira/comment', async(ctx) => {
    const jiraKey = ctx.request.body.issue.key
    debug('%d jira/comment jira:%s', ctx.id, jiraKey)
    const {key, update} = await convert.j2rComment(ctx.request.body)
    debug('%d jira/comment redmine:%s', ctx.id, key)
    debug('%d jira/comment upload:%o', ctx.id, update)
    if (key) {
      await redmine.update(key, update)
      ctx.body = {
        msg: 'ok'
      }
    } else {
      ctx.body = {
        msg: 'nothing'
      }
    }
  }))

  app.use(route.post('/redmine', async(ctx) => {
    const redmineKey = ctx.request.body.payload.issue.id
    debug('%d redmine redmine:%s', ctx.id, redmineKey)
    const {key, update, path} = await convert.r2j(ctx.request.body.payload)
    debug('%d redmine jira:%s', ctx.id, key)
    debug('%d redmine update:%o', ctx.id, update)
    if (key) {
        switch (path) {
            case 'transitions':
                await jira.transition(key, update)
                break;
            case 'comment':
                await jira.createComment(key, update)
                break;
            default:
                await jira.update(key, update)
                break;
        }
        ctx.body = {
            msg: 'ok'
        }
    } else {
        ctx.body = {
            msg: 'nothing'
        }
    }
  }))

  app.listen(3000)
  return 'web server started on port 3000'
}

main().then(
  (res) => console.log(res),
  (err) => {
    console.error(err)
    process.exit(1)
  })
