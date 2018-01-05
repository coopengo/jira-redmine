const request = require('superagent')

const postRequest = (path, login, pass, data, type) => {
  return request.post(path)
        .auth(login, pass)
        .send(data)
        .type(type)
}

const putRequest = (path, login, pass, data, type) => {
  return request.put(path)
        .auth(login, pass)
        .send(data)
        .type(type)
}

const getRequest = (path, login, pass) => {
  return request.get(path)
    .auth(login, pass)
}

module.exports = {
  postRequest,
  putRequest,
  getRequest
}
