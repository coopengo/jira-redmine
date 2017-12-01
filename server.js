const request = require('superagent')
const Koa = require('koa')
const router = require('koa-router')()
const koaBody = require('koa-body')
const logger = require('koa-logger')
const os = require('os')
const ifaces = os.networkInterfaces()

// On récupère l'url du docker pour non autoriser les modification du
// middleware vers JIRA en externe
let selfIp
Object.keys(ifaces).forEach(function (ifname) {
  let alias = 0

  ifaces[ifname].forEach(function (iface) {
    if (iface.family !== 'IPv4' || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return
    }

    if (alias >= 1) {
      const address = iface.address.split('.')
      if (address[0] === '172') {
        selfIp = '^'.concat(address[0], '\\.', address[1])
      }
    } else {
      const address = iface.address.split('.')
      selfIp = address[0].concat('.', address[1])
    }
    ++alias
  })
})

selfIp = new RegExp(selfIp)
// Mapping des données Redmine aux données Jira
const RedmineMap = {
  '2': 11,
  '3': 51,
  '4': 31,
  '5': 71,
  '7': 21,
  '8': 61
}

// Mapping des données Jira aux données Redmine
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
  '3': '2',
  '10000': '7',
  '10001': '4',
  '10002': '4',
  '10007': '5',
  '10008': '3',
  '10009': '8'
}
const JiraMapProject = {
  '10000': '1'
}

const RedmineMapProject = {
  '2': '10005',
  '1': '10006'
}

// Sauvegarde de l'issue Redmine pour un default dans
// l'architecture
const issueSave = {
}

// Méthode pour récupérer un attachment Jira
const getAttachmentJira = async(attachment) => {
  const reqAtt = await request.get(attachment.content)
      .auth(process.env.JIRALOGIN, process.env.JIRAPASSWORD)
  const req = await request.post(`${process.env.REDMINE_URL}/uploads.json`)
      .auth(process.env.REDMINE_TOKEN, '')
      .send(reqAtt.body)
      .set('content-type', 'application/octet-stream')
  return {token: req.body.upload.token, filename: attachment.filename, filetype: attachment.mimetype}
}

// Création d'un issue Redmine
const createIssue = async(issue) => {
  // Maybe if there is an issue with done status do not create it ???

  // On récupère les attachments
  const uploads = []
  for (const idAtt in issue.fields.attachment) {
    uploads.push(await getAttachmentJira(issue.fields.attachment[idAtt]))
  }

  const postIssue = {'issue': {}}
  let project = issue.fields.project.key.toLowerCase()
  let description = issue.fields.description
  let subject = issue.fields.summary
  if (issue.fields.customfield_10056 && issue.fields.customfield_10056.id === '10005') {
    project = '2'
    subject = issue.fields.customfield_10054
    description = issue.fields.customfield_10055
  }
  postIssue.issue.priority_id = JiraMapPriority[issue.fields.priority.id]
  postIssue.issue['description'] = description
  postIssue.issue['project_id'] = project
  postIssue.issue['subject'] = subject
  postIssue.issue.tracker_id = JiraMapTracker[issue.fields.issuetype.id]
  postIssue.issue.status_id = '1'
  postIssue.issue.custom_fields = [
    {'value': issue.key, 'id': 1}
  ]
  if (uploads.length > 0) {
    postIssue.issue.uploads = uploads
  }
  const ret = await request.post(`${process.env.REDMINE_URL}/issues.json`)
      .auth(process.env.REDMINE_TOKEN, '')
      .send(`${JSON.stringify(postIssue)}`)
      .type('json')
  if (issue.fields.customfield_10056 && issue.fields.customfield_10056.id === '10005') {
    const data = {'notes': `**$Title :**\n${issue.fields.summary}\n\n **Description :**\n ${issue.fields.description}`, 'private_notes': 1}
    updateIssue(data, ret.body.issue.id)
  }
  // On ajoute tous les commentaires un par un
  for (const idComment in issue.fields.comment.comments) {
    const comment = issue.fields.comment.comments[idComment]
    const data = {'notes': `*${new Date(comment.updated).toLocaleString()} ${comment.author.displayName} :* ${comment.body}`}
    updateIssue(data, ret.body.issue.id)
  }

  await request.put(`https://coopentest2.atlassian.net/rest/api/2/issue/${issue.key}`)
    .auth(process.env.JIRALOGIN, process.env.JIRAPASSWORD)
    .type('json')
    .send({fields: {customfield_10052: `http://test-support.coopengo.com:3000/issues/${ret.body.issue.id}`}})
}

// On vérifie l'existance de l'issue Redmine
const existingIssue = async(key) => {
  const req = await request.get(`${process.env.REDMINE_URL}/issues.json`)
    .query({cf_1: `${key}`, status_id: '*'})
    .type('json')
    .auth(process.env.REDMINE_TOKEN, '')
  return req.body
}

// Modification de l'issue Redmine
const updateIssue = async (data, key) => {
  await request.put(`${process.env.REDMINE_URL}/issues/${key}.json`)
    .type('json')
    .send({issue: data})
    .auth(process.env.REDMINE_TOKEN, '')
}

const searchIssueKey = (issue) => {
  const custom = issue.custom_fields
  for (const idField in custom) {
    if (custom[idField].id === 1) {
      return custom[idField].value
    }
  }
}

const main = async () => {
  const app = new Koa()

  app.on('error', function (err) {
    console.log(err)
  })

  app.use(logger())

  router.post('/redmine', koaBody(), async(ctx) => {
    if (!ctx.ip.match(selfIp)) {
      console.error('UNAUTHORIZED CON')
      return
    }
    const payload = ctx.request.body.payload
    if (payload.action === 'updated' && payload.journal.author.firstname !== 'Bot') {
      const issue = ctx.request.body.payload.issue

      const comment = ctx.request.body.payload.journal
      const issueKey = searchIssueKey(issue)
      const data = {fields: {}}
      if (comment.details.length) {
        for (const i in comment.details) {
          const detail = comment.details[i]
          if (detail.prop_key === 'status_id') {
            data.transition = {id: RedmineMap[detail.value]}
            issueSave[issueKey] = detail.value
          } else if (detail.prop_key === 'project_id') {
            data.fields.customfield_10056 = {id: RedmineMapProject[detail.value]}
          }
        }
        if (data.transition) {
          await request.post(`https://coopentest2.atlassian.net/rest/api/2/issue/${issueKey}/transitions`)
              .auth(process.env.JIRALOGIN, process.env.JIRAPASSWORD)
              .type('json')
              .send(data)
        } else {
          await request.put(`https://coopentest2.atlassian.net/rest/api/2/issue/${issueKey}`)
              .auth(process.env.JIRALOGIN, process.env.JIRAPASSWORD)
              .type('json')
              .send(data)
        }
      } else {
        if (comment.private_notes) return
        await request.post(`https://coopentest2.atlassian.net/rest/api/2/issue/${issueKey}/comment`)
        .auth(process.env.JIRALOGIN, process.env.JIRAPASSWORD)
        .type('json')
        .send({body: `*Message transféré de ${comment.author.firstname} ${comment.author.lastname}* : ${comment.notes}`})
      }
    }
  })

  router.post('/jira/issue', koaBody(), async(ctx) => {
    if (ctx.ip !== '::ffff:185.166.140.229') {
      console.error('UNAUTHORIZED CON')
      return
    }
    const issueJira = ctx.request.body.issue
    const issueRed = await existingIssue(issueJira.key)
    if (issueRed.total_count) {
      const issueId = issueRed.issues[0].id
      const statusId = JiraMapStatus[issueJira.fields.status.id]
      if (issueSave[issueJira.key] === statusId) {
        delete issueSave[issueRed.key]
        return
      }
      updateIssue({status_id: statusId}, issueId)
    } else {
      createIssue(issueJira)
    }
  })

  router.post('/jira/issueUpdate', koaBody(), async(ctx) => {
    if (ctx.ip !== '::ffff:185.166.140.229') {
      console.error('UNAUTHORIZED CON')
      return
    }
    const issueJira = ctx.request.body.issue
    const issueRed = await existingIssue(issueJira.key)
    if (issueRed.total_count) {
      const issueId = issueRed.issues[0].id
      const project = issueJira.fields.customfield_10056.id
      if (project === '10005' && issueRed.issues[0].project.id !== 2) {
        console.log('coog')
        updateIssue({project_id: 2}, issueId)
      } else if (project === '10006' && issueRed.issues[0].project.id === 2) {
        console.log('spec')
        updateIssue({project_id: JiraMapProject[issueJira.fields.project.id]}, issueId)
      }
    }
  })

  router.post('/jira/comment', koaBody(), async(ctx) => {
    if (ctx.ip !== '::ffff:185.166.140.229') {
      console.error('UNAUTHORIZED CON')
      return
    }
    if (ctx.request.body.comment.body.includes('Bot Redmine')) return
    const issueJira = ctx.request.body.issue
    const issueRed = await existingIssue(issueJira.key)

    const issueId = issueRed.issues[0].id
    const comment = ctx.request.body.comment
    if (comment.body.match(/^\*Message transféré de /)) return
    const splitedBody = comment.body.split('!')
    let body = splitedBody[0]
    const maxIds = splitedBody.length - 1
    let currentId = 1

    const uploads = []
    while (currentId < maxIds) {
      if (splitedBody[currentId].match(/\|thumbnail/)) {
        const fileName = splitedBody[currentId].replace(/\|thumbnail/, '')
        let maxAttId = issueJira.fields.attachment.length - 1
        while (true) {
          const attachment = issueJira.fields.attachment[maxAttId]
          if (fileName === attachment.filename) {
            uploads.push(await getAttachmentJira(issueJira.fields.attachment[maxAttId]))
            break
          }
          maxAttId--
        }
        currentId++
      } else {
        body += '!' + splitedBody[currentId]
      }
      currentId++
    }
    const contentBody = {}
    if (body !== undefined) {
      contentBody.notes = `**${new Date(comment.updated).toLocaleString()} ${comment.author.displayName} :** ${body}`
    }
    if (uploads.length) {
      contentBody.uploads = uploads
    }
    updateIssue(contentBody, issueId)
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
