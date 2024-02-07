import express from 'express'
import { writeFile } from 'fs/promises'

import { Multipart } from './multipart.js'


const app = express()

app.post('/', (req, res, next) => {
  const multipart = new Multipart({ headers: req.headers })

  const files = new Map()

  /**
   * @type {import('./multipart.js').onFieldCallback}
   */
  function onField({ fieldName, value }) {
    console.log('onField', {
      fieldName,
      value,
    })
  }

  /**
   * @type {import('./multipart.js').onFileCallback} 
   */
  function onFile(fileProps) {
    files.set(fileProps.filename, {
      ...fileProps,
      data: []
    })
  }

  /**
   * @type {import('./multipart.js').onDataCallback} 
   */
  function onData(data, fileProps) {
    const file = files.get(fileProps.filename)
    file.data.push(data)
    files.set(fileProps.filename, file)
  }

  req.on('data', function (chunk) {
    multipart.parseChunk.call(multipart, chunk, { onField, onFile, onData })
  })

  req.on('end', async function () {
    req.files = Array.from(files.values())
    next()
  })
}, (req, res) => {
  console.log('files on req -->', req.files)

  res.send({ ok: true })
})

app.listen(3000, () => console.log('App listen on port 3000!'))