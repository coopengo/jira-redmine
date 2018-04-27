module.exports = {
// Jira Fields
  JiraRedmineRef: '10026',
  JiraBugType: '10027',
  JiraTtle: '10028',
  JiraDescription: '10029',

  // Jira Mapping
  JiraSpecifique: '10004',
  JiraGenerique: '10003',

  JiraMapPriority: {
    '1': '5',
    '2': '3',
    '3': '2',
    '4': '1',
    '5': '10'
  },
  JiraMapTracker: {
    '10006': 1,
    '10007': 2
  },
  JiraMapStatus: {
    '1': 1, // New
    '3': 2, // In Progress
    '5': 10, // Livré
    '10000': 6, // Rejected
    '10001': 4, // FeedBack
    '10002': 4, // FeedBack
    '10004': 6, // Rejected
    '10008': 5, // Clos
    '10009': 3// Review
  },
  JiraDelivered: 5,
  JiraDeliveredField: '10043',
  JiraMapProject: {
    '10000': 30
  },

  botAddress: 'billing@coopengo.com',
  // Redmine Field
  RedmineJiraRef: 36,

  // Redmine Mapping

  RedmineMapStatus: {
    '2': 11,
    '3': 51,
    '4': 31,
    '5': 71,
    '6': 21,
    '10': 61
  },

  RedmineMapProject: {
    '30': '10004',
    '31': '10003'
  },

  RedmineBotId: 106,
  RedmineSupportDev: 31
}
