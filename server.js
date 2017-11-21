const request = require('superagent')
const Koa = require('koa')
const router = require('koa-router')()
const koaBody = require('koa-body')
const logger = require('koa-logger')

const createIssue = async(issue) => {
  const postIssue = {'issue': {}}
  postIssue.issue.project_id = issue.fields.project.key.toLowerCase()
  postIssue.issue.priority_id = issue.fields.priority.id
  postIssue.issue.description = issue.fields.description
  postIssue.issue.subject = issue.key.concat(':', issue.fields.summary)
  postIssue.issue.tracker_id = 1

  const ret = await request.post(`${process.env.REDMINE_URL}/issues.json`)
      .auth(process.env.REDMINE_TOKEN, '')
      .send(`${JSON.stringify(postIssue)}`)
      .type('json')

  for (const idComment in issue.fields.comment.comments) {
    const comment = issue.fields.comment.comments[idComment]
    const data = {'notes': `*${new Date(comment.updated).toLocaleString()} ${comment.author.displayName} :* ${comment.body}`}
    updateIssue(data, ret.body.issue.id)
  }
}

const existingIssue = async(key) => {
  const req = await request.get(`${process.env.REDMINE_URL}/issues.json`)
    .query({subject: `~${key}:`})
    .type('json')
    .auth(process.env.REDMINE_TOKEN, '')

  return req.body
}

const updateIssue = async (data, key) => {
  await request.put(`${process.env.REDMINE_URL}/issues/${key}.json`)
    .type('json')
    .send({issue: data})
    .auth(process.env.REDMINE_TOKEN, '')
}

const main = async () => {
  const app = new Koa()

  app.on('error', function (err) {
    console.log(err)
  })

  app.use(logger())

  router.post('/redmine', koaBody(), async(ctx) => {
    console.log(ctx.request.body)
    createIssue(ctx)
  })

  router.post('/jira/issue', koaBody(), async(ctx) => {
    const issueJira = ctx.request.body.issue
    const issueRed = await existingIssue(issueJira.key)
    if (issueRed.total_count) {
      const issueId = issueRed.issues[0].id
      updateIssue({'status_id': issueJira.fields.status.statusCategory.id}, issueId)
    } else {
      createIssue(issueJira)
    }
  })

  router.post('/jira/comment', koaBody(), async(ctx) => {
    const issueJira = ctx.request.body.issue
    const issueRed = await existingIssue(issueJira.key)

    const issueId = issueRed.issues[0].id
    const comment = ctx.request.body.comment
    updateIssue({'notes': `*${new Date(comment.updated).toLocaleString()} ${comment.author.displayName} :* ${comment.body}`}, issueId)
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
