import express from 'express'
import { Writable } from 'stream'
import { pipeline } from 'stream/promises'
import { writeFile } from 'fs/promises'

class MyStream extends Writable {
  constructor() {
    super()
    this._write = (chunk, encoding, next) => {
      this.emit('myEvent', chunk.toString())
      next()
    }

    this._flush = () => {
      console.log('flush')
    }
  }
}

const app = express()

const NEW_LINE_CHARS_HEX = {
  CARRIAGE_RETURN: 0x0d,
  NEW_LINE_FEED: 0x0a,
}

const STATES = {
  INIT: 0,
  READING_HEADERS: 1,
  READING_DATA: 2,
}

const isNewLineChar = (byte) => Object.values(NEW_LINE_CHARS_HEX).includes(byte)

const isNewLine = (currentByte, previousByte) => NEW_LINE_CHARS_HEX.CARRIAGE_RETURN === previousByte && NEW_LINE_CHARS_HEX.NEW_LINE_FEED === currentByte

const createBufferFromArray = (array) => Buffer.from(array)

// app.post('/', (req, res) => {
//   console.log('GET /', req.headers)

//   const contentTypeHeaders = req.headers['content-type']

//   const [,boundary] = contentTypeHeaders.split(';')

//   const [,boundaryValue] = boundary.split('=')

//   const boundaryBuffer = Buffer.from(`--${boundaryValue}`)
//   const finalBoundaryBuffer = Buffer.from(`--${boundaryValue}--`)

//   const files = []
//   let dataBuffer = []
//   let headers = {}

//   let state = STATES.INIT

//   req.on('data', (chunk) => {
//     let lineBuffer = []

//     for (let i = 0; i < chunk.length; i++) {
//       const currentByte = chunk[i]
//       const prevByte = i === 0 ? null : chunk[i -1]

//       if (state === STATES.INIT) {
//         if (!isNewLineChar(currentByte)) {
//           lineBuffer.push(currentByte)
//           continue
//         }
  
//         if(isNewLine(currentByte, prevByte) && boundaryBuffer.equals(Buffer.from(lineBuffer))) {
//           state = STATES.READING_HEADERS
//           lineBuffer = []
//           continue
//         }
//       }

//       if (state === STATES.READING_HEADERS) {
//         if (!isNewLineChar(currentByte)) {
//           lineBuffer.push(currentByte)
//           continue
//         }

//         if (isNewLine(currentByte, prevByte) && lineBuffer.length > 0) {
//           const line = Buffer.from(lineBuffer).toString()
//           const [key, value] = line.split(':')

//           headers[key.trim()] = value.trim()
//           lineBuffer = []
//           continue
//         }

//         if (isNewLine(currentByte, prevByte) && lineBuffer.length === 0) {
//           state = STATES.READING_DATA
//           lineBuffer = []
//           continue
//         }
//       }

//       if (state === STATES.READING_DATA) {
//         if (isNewLine(currentByte, prevByte)) {
//           if (lineBuffer.length < boundaryBuffer.length) {
//             dataBuffer.push(currentByte)
//             lineBuffer = []
//             continue
//           }

//           const line = Buffer.from(lineBuffer.slice(0, -1))

//           if (!boundaryBuffer.equals(line) && !finalBoundaryBuffer.equals(line)) {
//             dataBuffer.push(currentByte)
//             lineBuffer = []
//             continue
//           }

//           const splitterLength = boundaryBuffer.equals(line) ? boundaryBuffer.length : finalBoundaryBuffer.length

//           const splitter = dataBuffer.length - splitterLength - 3

//           const data = Buffer.from(dataBuffer.slice(0, splitter))

//           state = STATES.READING_HEADERS
//           files.push({
//             headers,
//             data,
//           })
//           lineBuffer = []
//           dataBuffer = []
//           headers = {}
//           continue
//         }

//         dataBuffer.push(currentByte)
//         lineBuffer.push(currentByte)
//       }
//     }
//   })

//   req.on('end', () => {
//     console.log({
//       state,
//       files,
//       headers: files[1].headers,
//     })

//     console.log('data length', files[0].data.length)
//     console.log('data buffer length -->', dataBuffer.length)

//     writeFile('uploaded.pdf', files[0].data)
//     writeFile('uploaded.png', files[1].data)
//     writeFile('uploaded.csv', files[2].data)
//   })

//   res.send({ ok: true })
// })

app.post('/', async (req, res) => {
  async function* pipe(data) {
    for await (const chunk of data) {
      yield chunk
    }
  }

  const myStream = new MyStream()
  myStream.on('myEvent', (chunk) => {
    console.log('chunk on myEvent', chunk)
  })

  await pipeline(req, pipe, myStream)

  res.json({ ok: true })
})

app.listen(3000, () => console.log('App listen on port 3000!'))