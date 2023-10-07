import express from 'express'
import { writeFile } from 'fs/promises'

const app = express()

const NEW_LINE_CHARS_HEX = {
  CARRIAGE_RETURN: 0x0d,
  NEW_LINE_FEED: 0x0a,
}

const STAGES = {
  INIT: 0,
  READING_HEADERS: 1,
}

const isNewLineChar = (byte) => Object.values(NEW_LINE_CHARS_HEX).includes(byte)

const isNewLine = (currentByte, previousByte) => NEW_LINE_CHARS_HEX.CARRIAGE_RETURN === previousByte && NEW_LINE_CHARS_HEX.NEW_LINE_FEED === currentByte

app.post('/', (req, res) => {
  console.log('GET /', req.headers)

  const contentTypeHeaders = req.headers['content-type']

  const [,boundary] = contentTypeHeaders.split(';')

  const [,boundaryValue] = boundary.split('=')

  const boundaryBuffer = Buffer.from(`--${boundaryValue}`)

  const files = []

  console.log({
    boundaryBuffer: boundaryBuffer.toString(),
  })

  let state = STAGES.INIT

  req.on('data', (chunk) => {
    let lineBuffer = []
    let line = ''

    for (let i = 0; i < 70; i++) {
      const currentByte = chunk[i]
      const prevByte = i === 0 ? null : chunk[i -1]

      if (state === STAGES.INIT) {
        if (!isNewLineChar(currentByte)) {
          lineBuffer.push(currentByte)
        }
  
        if(isNewLine(currentByte, prevByte) && boundaryBuffer.equals(Buffer.from(lineBuffer))) {
          state = STAGES.READING_HEADERS
          // lineBuffer = []
        }
      }
    }

    state = STAGES.INIT

    console.log({
      state,
      lineBuffer: Buffer.from(lineBuffer).toString(),
    })
  })

  res.send({ ok: true })
})

app.listen(3000, () => console.log('App listen on port 3000!'))