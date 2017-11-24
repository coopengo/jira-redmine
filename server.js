const request = require('superagent')
const Koa = require('koa')
const router = require('koa-router')()
const koaBody = require('koa-body')
const logger = require('koa-logger')

const RedmineMap = {
  '1': 51,
  '2': 11,
  '3': 41,
  '4': 41,
  '5': 61
}
const JiraMapPriority = {
  '1': '5',
  '2': '4',
  '3': '3',
  '4': '2',
  '5': '1'
}
const JiraMapTracker = {
  '10001': '1',
  '10002': '3',
  '10003': '2'
}
const JiraMapStatus = {
  '1': '1',
  '10003': '4',
  '10007': '5',
  '10006': '2',
  '4': '4'
}
const issueSave = {
}
const createIssue = async(issue) => {
  // Maybe if there is an issue with done status do not create it ???

  const postIssue = {'issue': {}}
  postIssue.issue.project_id = issue.fields.project.key.toLowerCase()
  postIssue.issue.priority_id = JiraMapPriority[issue.fields.priority.id]
  postIssue.issue.description = issue.fields.description
  postIssue.issue.subject = issue.key.concat(':', issue.fields.summary)
  postIssue.issue.tracker_id = JiraMapTracker[issue.fields.issuetype.id]
  postIssue.issue.status_id = JiraMapStatus[issue.fields.status.id]

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
    .query({subject: `~${key}:`, status_id: '*'})
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
    const payload = ctx.request.body.payload
    if (payload.action === 'updated' && payload.journal.author.firstname !== 'Bot') {
      const issue = ctx.request.body.payload.issue
      const req = await request.get(`https://coopentest2.atlassian.net/rest/servicedeskapi/request/${issue.subject.split(':')[0]}`)
        .auth('pierre.kunkel+jiratest@coopengo.com', 'Lolmdr62*')
        .type('json')

      const comment = ctx.request.body.payload.journal
      const jiraIssue = req.body
      if (comment.details.length) {
        for (const i in comment.details) {
          const detail = comment.details[i]
          if (detail.prop_key === 'status_id') {
            await request.post(`https://coopentest2.atlassian.net/rest/api/2/issue/${jiraIssue.issueId}/transitions`)
              .auth('pierre.kunkel+jiratest@coopengo.com', 'Lolmdr62*')
              .type('json')
              .send({transition: {id: RedmineMap[detail.value]}})
            issueSave[jiraIssue.key] = detail.value
          }
        }
      } else {
        await request.post(`https://coopentest2.atlassian.net/rest/api/2/issue/${jiraIssue.issueId}/comment`)
        .auth('pierre.kunkel+jiratest@coopengo.com', 'Lolmdr62*')
        .type('json')
        .send({body: JSON.stringify(`**${comment.author.firstname} ${comment.author.lastname}** : ${comment.notes}`)})
      }
    }
  })

  router.post('/jira/issue', koaBody(), async(ctx) => {
    const issueJira = ctx.request.body.issue
    const issueRed = await existingIssue(issueJira.key)
    if (issueRed.total_count) {
      const issueId = issueRed.issues[0].id
      const statusId = JiraMapStatus[issueJira.fields.status.id]
      if (issueSave[issueRed.key] === statusId) {
        delete issueSave[issueRed.key]
        return
      }
      updateIssue({status_id: statusId}, issueId)
    } else {
      createIssue(issueJira)
    }
  })

  router.post('/jira/comment', koaBody(), async(ctx) => {
    if (ctx.request.body.comment.body.includes('Bot Redmine')) return
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
