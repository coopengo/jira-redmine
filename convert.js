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
  // TODO: stream attachments
  let key
  const update = {
    status_id: config.JiraMapStatus[issue.fields.status.id],
    custom_fields: []
  }
  if (changelog && user.emailAddress === config.botAddress) {
    key = j2rGetRedmineIssue(issue)
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
  if (!comment.body.match(/^\*Message transféré de /)) {
    const key = j2rGetRedmineIssue(issue)

    // TODO: stream attachments
    const update = {
      notes: j2rFormatComment(comment)
    }

    return {key, update}
  }
}

const RedmineJiraIssue = (issue) => {
  const custom = issue.custom_fields
  for (const idField in custom) {
    if (custom[idField].id === config.RedmineJiraRef) {
      return custom[idField].value
    }
  }
}

// Change custom_field_10056 => Bug Type (Specific or Generic)

const RedmineTreatment = (payload) => {
  if (payload.action === 'updated' && parseInt(payload.journal.author.id) !== config.RedmineBotId) {
    const issue = payload.issue

    const comment = payload.journal
    const key = RedmineJiraIssue(issue)
    const data = {fields: {}}
    let path = ''
    if (comment.details.length) {
      for (const i in comment.details) {
        const detail = comment.details[i]
        if (detail.prop_key === 'status_id') {
          data.transition = {id: config.RedmineMapStatus[detail.value]}
        } else if (detail.prop_key === 'project_id') {
          data.fields[`customfield_${config.JiraBugType}`] = {id: config.RedmineMapProject[detail.value]}
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

module.exports = {
  j2rCreateIssue,
  j2rUpdateIssue,
  j2rComment,
  RedmineTreatment
}
