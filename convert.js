const config = require('./config')

const j2rFormatComment = (comment) => {
  const author = comment.author.displayName
  const body = comment.body
  return `**Message from ${author} on Jira**\n${body}`
}

const j2rGetJiraType = (issue) => {
  return issue.fields[`customfield_${config.JiraBugType}`].id
}

const j2rGetRedmineIssue = (issue) => {
  const redmineURL = issue.fields[`customfield_${config.JiraRedmineRef}`]
  return redmineURL.split('/').pop()
}

const j2rGetRedmineProject = (issue) => {
  return config.JiraMapProject[issue.fields.project.id]
}

const j2rCreateIssue = async ({issue}) => {
  // TODO: stream attachments
  const create = {
    category_id: 150,
    tracker_id: config.JiraMapTracker[issue.fields.issuetype.id],
    status_id: 1,
    priority_id: config.JiraMapPriority[issue.fields.priority.id],
    custom_fields: [
      {id: 21, value: 50}, // TODO: hard coded?
      {id: config.RedmineJiraRef, value: issue.key}
    ],
    notes: []
  }

  const type = j2rGetJiraType(issue)
  if (type === config.JiraGenerique) {
    create.project_id = config.RedmineSupportDev
    create.subject = issue.fields[`customfield_${config.JiraTitle}`]
    create.description = issue.fields[`customfield_${config.JiraDescription}`]
  } else {
    create.project_id = j2rGetRedmineProject(issue)
    create.subject = issue.fields.summary
    create.description = issue.fields.description
  }

  Object.entries(issue.fields.comment.comments, (p) => {
    create.notes.push(j2rFormatComment(p[1]))
  })

  return create
}

const j2rUpdateIssue = async ({issue, user, changelog}) => {
  let key
  let update
  if (changelog && user.emailAddress !== config.botAddress) {
    // TODO: stream attachments
    key = j2rGetRedmineIssue(issue)

    update = {
      status_id: config.JiraMapStatus[issue.fields.status.id],
      custom_fields: []
    }

    // TODO: why?
    const type = j2rGetJiraType(issue)
    if (type === config.JiraGenerique) {
      update.project_id = config.RedmineSupportDev
    } else if (type === config.JiraSpecifique) {
      update.project_id = j2rGetRedmineProject(issue)
      update.custom_fields.push({id: 21, value: 50}) // TODO: hard coded?
    }
  }
  return {key, update}
}

const j2rComment = async ({issue, user, comment}) => {
  let key, update
  if (!comment.body.match(/^\*Message transféré de /)) {
    key = j2rGetRedmineIssue(issue)

    // TODO: stream attachments
    update = {
      notes: j2rFormatComment(comment)
    }

  }
  return {key, update}
}

const r2jKey = (issue) => {
  let i;
  for (i = 0; i<issue.custom_fields.length; i++ ){
    if (issue.custom_fields[i].id === config.RedmineJiraRef) {
        return issue.custom_fields[i].value
    }
  }
}

// Change custom_field_10056 => Bug Type (Specific or Generic)

const r2j = ({action, issue, journal}) => {
  let key, update, path
  if (action === 'updated' && parseInt(journal.author.id) !== config.RedmineBotId) {
    key = r2jKey(issue)
    update = {fields: {}}
    path = ''
    if (journal.details.length) {
      for (let i = 0; i < journal.details.length;i ++){
        const detail = journal.details[i]
        if (detail.prop_key === 'status_id') {
          update.transition = {id: config.RedmineMapStatus[detail.value]}
        } else if (detail.prop_key === 'project_id') {
          update.fields[`customfield_${config.JiraBugType}`] = {id: config.RedmineMapProject[detail.value]}
        }
      }
      if (update.transition) {
        path = 'transitions'
      }
    } else {
      if (journal.private_notes) return
      path = 'comment'
      update.body = `*Message transféré de ${journal.author.firstname} ${journal.author.lastname}* : ${journal.notes}`
    }
  }
  return {key, update, path}
}

module.exports = {
  j2rCreateIssue,
  j2rUpdateIssue,
  j2rComment,
  r2j
}
