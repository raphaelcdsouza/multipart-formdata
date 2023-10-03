import express from 'express'

const app = express()

app.post('/', (req, res) => {
  console.log('GET /', req.headers)

  const contentTypeHeaders = req.headers['content-type']

  const [contentType, boundary] = contentTypeHeaders.split(';')

  console.log('content type + boundary', {
    contentType,
    boundary
  })

  let data = ''

  req.on('data', (chunk) => {
    data += chunk
  })
  // req.on('end', () => {
  //   console.log('data -->', data)
  // })

  res.send({ ok: true })
})

app.listen(3000, () => console.log('App listen on port 3000!'))