const properties = require('./config')
const requestModule = require('./requestModule')

const JiraLogin = process.env.JIRA_LOGIN
const JiraPassword = process.env.JIRA_PASSWORD

const RedmineApi = process.env.REDMINE_JIRA_TOKEN

const RedmineUrlInternal = properties.RedmineUrlInternal

const getRequest = requestModule.getRequest
const postRequest = requestModule.postRequest

const bot = properties.RedmineBotId

// Mapping des données Redmine aux données Jira
const RedmineMapStatus = properties.RedmineMapStatus

const RedmineMapProject = properties.RedmineMapProject

// Mapping des données Jira aux données Redmine
const JiraMapPriority = properties.JiraMapPriority

const JiraMapTracker = properties.JiraMapTracker

const JiraMapStatus = properties.JiraMapStatus

const JiraMapProject = properties.JiraMapProject

// Load properties

const JiraRedmineRef = properties.JiraRedmineRef
const JiraBugType = properties.JiraBugType
const JiraTitle = properties.JiraTitle
const JiraDescription = properties.JiraDescription

const JiraSpecifique = properties.JiraSpecifique
const JiraGenerique = properties.JiraGenerique

const RedmineJiraRef = properties.RedmineJiraRef
const RedmineSupportDev = properties.RedmineSupportDev

// Méthode pour récupérer un attachment Jira
const getAttachmentJira = async (attachment) => {
  const reqAtt = await getRequest(attachment.content, JiraLogin, JiraPassword)
  const req = await postRequest(`${RedmineUrlInternal}/uploads.json`, RedmineApi, '', reqAtt.body, 'octet-stream')
  return {token: req.body.upload.token, filename: attachment.filename, filetype: attachment.mimetype}
}

const RedmineJiraIssue = (issue) => {
  const custom = issue.custom_fields
  for (const idField in custom) {
    if (custom[idField].id === RedmineJiraRef) {
      return custom[idField].value
    }
  }
}

// Change custom_field_10056 => Bug Type (Specific or Generic)

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
          data.fields[`customfield_${JiraBugType}`] = {id: RedmineMapProject[detail.value]}
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
  const keyTab = issue.fields[`customfield_${JiraRedmineRef}`].split('/')
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
          uploads.push(await getAttachmentJira(issue.fields.attachment[maxAttId]))
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
  if (issue.fields[`customfield_${JiraBugType}`] && payload.changelog && payload.user.emailAddress !== properties.botAddress) {
    const data = {}
    const keyTab = issue.fields[`customfield_${JiraRedmineRef}`].split('/')
    const key = keyTab[keyTab.length - 1]
    const bugType = issue.fields[`customfield_${JiraBugType}`].id
    data['status_id'] = JiraMapStatus[issue.fields.status.id]
    if (bugType === JiraGenerique) {
      data['project_id'] = parseInt(RedmineSupportDev)
      console.log("enerique")
    } else if (bugType === JiraSpecifique) {
      data['project_id'] = JiraMapProject[issue.fields.project.id]
      data['custom_fields'] = [{'value': 50, 'id': 21}] 
    }
    return {data, key}
  }
}

const JiraCreate = async (issue) => {
  const uploads = []

  // Get attachment then load it on Redmine
  for (const idAtt in issue.fields.attachment) {
    uploads.push(await getAttachmentJira(issue.fields.attachment[idAtt]))
  }

  const data = {'issue': {}}
  let project = JiraMapProject[issue.fields.project.id]
  let description = issue.fields.description
  let subject = issue.fields.summary
  let coog
  const comments = []
  // Change custom_field_10054-55 to english title and description if field on Jira
  if (issue.fields[`customfield_${JiraBugType}`] && issue.fields[`customfield_${JiraBugType}`] === JiraGenerique) {
    project = RedmineSupportDev
    subject = issue.fields[`customfield_${JiraTitle}`]
    description = issue.fields[`customfield_${JiraDescription}`]
  }
  data.issue.category_id = 150
  data.issue.priority_id = JiraMapPriority[issue.fields.priority.id]
  data.issue['description'] = description
  data.issue['project_id'] = project
  data.issue['subject'] = subject
  data.issue.tracker_id = JiraMapTracker[issue.fields.issuetype.id]
  data.issue.status_id = '1'
  // Redmine field (Jira issue)
  data.issue.custom_fields = [
    {'value': 50, 'id': 21},
    {'value': issue.key, 'id': RedmineJiraRef}
  ]
  if (uploads.length > 0) {
    data.issue.uploads = uploads
  }
  if (issue.fields[`customfield_${JiraBugType}`] && issue.fields[`customfield_${JiraBugType}`].id === JiraGenerique) {
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
