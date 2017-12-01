const server = require('./server')

const bot = parseInt(process.env.BOT_ID)

// Mapping des données Redmine aux données Jira
const RedmineMapStatus = {
  '2': 11,
  '3': 51,
  '4': 31,
  '5': 71,
  '7': 21,
  '8': 61
}

const RedmineMapProject = {
  '2': '10005',
  '1': '10006'
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

const RedmineJiraIssue = (issue) => {
  const custom = issue.custom_fields
  for (const idField in custom) {
    if (custom[idField].id === 1) {
      return custom[idField].value
    }
  }
}

const RedmineTreatment = (payload) => {
  if (payload.action === 'updated' && parseInt(payload.journal.author.id) !== bot) {
    const issue = payload.issue

    const comment = payload.journal
    const key = RedmineJiraIssue(issue)
    const data = {fields: {}}
    let path = ''
    if (comment.details.length) {
      for (const i in comment.details) {
        const detail = comment.details[i]
        if (detail.prop_key === 'status_id') {
          data.transition = {id: RedmineMapStatus[detail.value]}
        } else if (detail.prop_key === 'project_id') {
          data.fields.customfield_10056 = {id: RedmineMapProject[detail.value]}
        }
      }
      if (data.transition) {
        path = '/transitions'
      }
    } else {
      if (comment.private_notes) return
      path = '/comment'
      data.body = `*Message transféré de ${comment.author.firstname} ${comment.author.lastname}* : ${comment.notes}`
    }
    return {data, path, key}
  }
}

const JiraComment = async (payload) => {
  const issue = payload.issue
  const keyTab = issue.fields.customfield_10052.split('/')
  const key = keyTab[keyTab.length - 1]
  const data = {}
  const comment = payload.comment

  if (comment.body.match(/^\*Message transféré de /)) return
  const splitedBody = comment.body.split('!')
  let body = splitedBody[0]
  const maxIds = splitedBody.length - 1
  let currentId = 1

  const uploads = []
  while (currentId < maxIds) {
    if (splitedBody[currentId].match(/\|thumbnail/)) {
      const fileName = splitedBody[currentId].replace(/\|thumbnail/, '')
      let maxAttId = issue.fields.attachment.length - 1
      while (true) {
        const attachment = issue.fields.attachment[maxAttId]
        if (fileName === attachment.filename) {
          uploads.push(await server.getAttachmentJira(issue.fields.attachment[maxAttId]))
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

  if (body !== undefined) {
    data.notes = `**${new Date(comment.updated).toLocaleString()} ${comment.author.displayName} :** ${body}`
  }
  if (uploads.length) {
    data.uploads = uploads
  }

  return {data, key}
}

const JiraUpdate = (payload) => {
  const issue = payload.issue
  if (issue.fields.customfield_10052 && payload.changelog) {
    const data = {}
    const keyTab = issue.fields.customfield_10052.split('/')
    const key = keyTab[keyTab.length - 1]
    const project = issue.fields.customfield_10056.id
    data['status_id'] = JiraMapStatus[issue.fields.status.id]
    if (project === '10005') {
      data['project_id'] = 2
    } else if (project === '10006') {
      data['project_id'] = JiraMapProject[issue.fields.project.id]
    }
    return {data, key}
  }
}

const JiraCreate = async (issue) => {
  const uploads = []

  // On récupère les attachments
  for (const idAtt in issue.fields.attachment) {
    uploads.push(await server.getAttachmentJira(issue.fields.attachment[idAtt]))
  }

  const data = {'issue': {}}
  let project = JiraMapProject[issue.fields.project.id]
  let description = issue.fields.description
  let subject = issue.fields.summary
  let coog
  const comments = []
  if (issue.fields.customfield_10056 && issue.fields.customfield_10056.id === '10005') {
    project = '2'
    subject = issue.fields.customfield_10054
    description = issue.fields.customfield_10055
  }
  data.issue.priority_id = JiraMapPriority[issue.fields.priority.id]
  data.issue['description'] = description
  data.issue['project_id'] = project
  data.issue['subject'] = subject
  data.issue.tracker_id = JiraMapTracker[issue.fields.issuetype.id]
  data.issue.status_id = '1'
  // Redmine field (Jira issue)
  data.issue.custom_fields = [
    {'value': issue.key, 'id': 1}
  ]
  if (uploads.length > 0) {
    data.issue.uploads = uploads
  }
  if (issue.fields.customfield_10056 && issue.fields.customfield_10056.id === '10005') {
    coog = {'notes': `**$Title :**\n${issue.fields.summary}\n\n **Description :**\n ${issue.fields.description}`, 'private_notes': 1}
  }
  for (const idComment in issue.fields.comment.comments) {
    const comment = issue.fields.comment.comments[idComment]
    comments.push({'notes': `*${new Date(comment.updated).toLocaleString()} ${comment.author.displayName} :* ${comment.body}`})
  }

  return {data, coog, comments}
}

module.exports = {
  RedmineTreatment,
  JiraCreate,
  JiraComment,
  JiraUpdate
}
