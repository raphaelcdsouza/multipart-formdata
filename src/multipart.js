/**
 * Provide file properties when a file is present in the multipart form
 * @callback onFileCallback
 * @param {Object} props
 * @param {string} props.fieldName
 * @param {string} props.filename
 * @param {string} props.contentType
 * @return {void}
 */

/**
 * Provide field properties when field is present in the multipart form
 * @callback onFieldCallback
 * @param {Object} props
 * @param {string} props.fieldName
 * @param {string} props.value
 * @return {void}
 */

/**
 * Provide parsed data chunks of files in the multipart form
 * @callback onDataCallback
 * @param {Array<byte>} data
 * @param {Object} props
 * @param {string} props.fieldName
 * @param {string} props.filename
 * @param {string} props.contentType
 * @return {void}
 */

/**
 * @typedef {Object} ExtractContentDispositionInfoReturnType
 * @property {string} ExtractContentDispositionInfoReturnType.subpart
 * @property {string} ExtractContentDispositionInfoReturnType.fieldName
 * @property {string} ExtractContentDispositionInfoReturnType.filename
 */

const STATES = {
  INIT: 0,
  READING_HEADERS: 1,
  READING_DATA: 2,
}

const PART_TYPES = {
  FIELD: 'field',
  FILE: 'file',
}

const NEW_LINE_CHARS_HEX = {
  CARRIAGE_RETURN: 0x0d, // \r
  NEW_LINE_FEED: 0x0a, // \n
}

const MANDATORY_HEADERS = {
  CONTENT_DISPOSITION: 'content-disposition',
}

const OPTIONAL_HEADERS = {
  CONTENT_TYPE: 'content-type',
}

/*
 * Private properties keys
 */
const KProps = Symbol('KProps')
const KRawHeaders = Symbol('KRawHeaders')
const K_STATE = Symbol('K_STATE')
const K_PART_TYPE = Symbol('K_PART_TYPE')
const K_PART_PROPS = Symbol('K_PART_PROPS')
const K_DATA_BUFFER = Symbol('K_DATA_BUFFER')

/*
 * Private methods keys
 */
const KGetBoundary = Symbol('KGetBoundary')
const KIsNewLineChar = Symbol('KIsNewLineChar')
const KIsNewLine = Symbol('KIsNewLine')
const KCheckMandatoryHeaders = Symbol('KCheckMandatoryHeaders')
const KExtractContentDispositionInfo = Symbol('KExtractContentDispositionInfo')

/**
 * @constructor
 * @param {Object} properties
 * @param {Object} properties.headers
 */
export class Multipart {
  constructor({ headers }) {
    this[KProps] = {}
    this[KRawHeaders]= headers

    this[K_STATE] = STATES.INIT
    this[K_PART_TYPE] = PART_TYPES.FIELD
    this[K_PART_PROPS] = {}
    this[K_DATA_BUFFER] = []

    this[KGetBoundary]()
  }

  /**
   * Get boundary from content-type header
   * @return {void}
   * @private
   */
  [KGetBoundary]() {
    const [,boundary] = this[KRawHeaders]['content-type'].split(';')
    const [,boundaryValue] = boundary.split('=')

    Object.assign(this[KProps], {
      boundaryBuffer: Buffer.from(`--${boundaryValue}`),
      finalBoundaryBuffer: Buffer.from(`--${boundaryValue}--`),
    })
  }

  /**
   * Check if byte is a new line char
   * @param {byte} byte 
   * @returns {boolean} true if byte is a new line
   * @private
   */
  [KIsNewLineChar](byte) {
    return Object.values(NEW_LINE_CHARS_HEX).includes(byte)
  }

  /**
   * Check if current byte and previous byte are new line chars
   * @param {byte} currentByte
   * @param {byte} previousByte
   * @returns {boolean} true if current and previous byte are new line chars
   * @private
   */
  [KIsNewLine](currentByte, previousByte) {
    return NEW_LINE_CHARS_HEX.CARRIAGE_RETURN === previousByte && NEW_LINE_CHARS_HEX.NEW_LINE_FEED === currentByte
  }

  /**
   * Extracts and returns the subpart of multipart form data, fieldname and filename if exists
   * @returns {ExtractContentDispositionInfoReturnType} props
   * @private
   */
  [KExtractContentDispositionInfo]() {
    const [subpart, fieldName, filename] = this[KProps].partHeaders[MANDATORY_HEADERS.CONTENT_DISPOSITION].split(';')

    return {
      subpart,
      fieldName: fieldName.split('=')[1].replace(/"/g, ''),
      filename: filename !== undefined ? filename.split('=')[1].replace(/"/g, '') : undefined,
    }
  }

  /**
   * Check if mandatory headers are present
   * @returns {void}
   * @private
   */
  [KCheckMandatoryHeaders]() {
    const headersKeys = Object.keys(this[KProps].partHeaders)

    if (!headersKeys.includes(MANDATORY_HEADERS.CONTENT_DISPOSITION)) {
      throw new Error('Missing "Content-Disposition" header')
    }
  }

  /**
   * Process the received chunk of data
   * @param {Array<byte>} chunk chunk of data to process
   * @param {Object} callbacks
   * @param {onFieldCallback} callbacks.onField
   * @param {onFileCallback} callbacks.onFile
   * @param {onDataCallback} callbacks.onData
   */
  parseChunk(chunk, { onFile, onField, onData }) {
    let lineBuffer = []

    for (let i = 0; i < chunk.length; i++) {
      const currentByte = chunk[i]
      const prevByte = i === 0 ? null : chunk[i -1]

      if (this[K_STATE] === STATES.INIT) {
        if (!this[KIsNewLineChar](currentByte)) {
          lineBuffer.push(currentByte)
          continue
        }
  
        if(this[KIsNewLine](currentByte, prevByte) && this[KProps].boundaryBuffer.equals(Buffer.from(lineBuffer))) {
          this[K_STATE] = STATES.READING_HEADERS
          lineBuffer = []
          continue
        }
      }

      if (this[K_STATE] === STATES.READING_HEADERS) {
        if (!this[KIsNewLineChar](currentByte)) {
          lineBuffer.push(currentByte)
          continue
        }

        if (this[KIsNewLine](currentByte, prevByte) && lineBuffer.length > 0) {
          const line = Buffer.from(lineBuffer).toString()
          const [key, value] = line.split(':')

          if (this[KProps].partHeaders === undefined) {
            Object.assign(this[KProps], { partHeaders: {} })
          }
          
          Object.assign(this[KProps].partHeaders, { [key.trim().toLowerCase()]: value.trim() })

          lineBuffer = []
          continue
        }

        if (this[KIsNewLine](currentByte, prevByte) && lineBuffer.length === 0) {
          this[KCheckMandatoryHeaders]()

          const { fieldName, filename } = this[KExtractContentDispositionInfo]()

          if (this[KProps].partHeaders[OPTIONAL_HEADERS.CONTENT_TYPE] !== undefined) {
            Object.assign(this[K_PART_PROPS], {
              contentType: this[KProps].partHeaders[OPTIONAL_HEADERS.CONTENT_TYPE],
            })
          }

          Object.assign(this[K_PART_PROPS], {
            fieldName,
          })
          
          if (filename !== undefined) {
            this[K_PART_TYPE] = PART_TYPES.FILE
            Object.assign(this[K_PART_PROPS], {
              filename,
            })
            onFile !== undefined && onFile(this[K_PART_PROPS])
          } else {
            this[K_PART_TYPE] = PART_TYPES.FIELD
          }

          this[K_STATE] = STATES.READING_DATA
          lineBuffer = []
          continue
        }
      }

      if (this[K_STATE] === STATES.READING_DATA) {
        if (this[KIsNewLine](currentByte, prevByte)) {
          if (lineBuffer.length < this[KProps].boundaryBuffer.length) {
            this[K_DATA_BUFFER].push(currentByte)
            lineBuffer = []
            continue
          }

          const line = Buffer.from(lineBuffer.slice(0, -1))

          if (!this[KProps].boundaryBuffer.equals(line) && !this[KProps].finalBoundaryBuffer.equals(line)) {
            this[K_DATA_BUFFER].push(currentByte)
            lineBuffer = []
            continue
          }

          const splitterLength = this[KProps].boundaryBuffer.equals(line)
            ? this[KProps].boundaryBuffer.length
            : this[KProps].finalBoundaryBuffer.length

          const splitter = this[K_DATA_BUFFER].length - splitterLength - 3

          const data = Buffer.from(this[K_DATA_BUFFER].slice(0, splitter))

          if (this[K_PART_TYPE] === PART_TYPES.FILE) {
            onData !== undefined && onData(data, this[K_PART_PROPS])
          } else {
            this[K_PART_PROPS].value = data.toString()
            onField !== undefined && onField(this[K_PART_PROPS])
          }

          this[K_STATE] = STATES.READING_HEADERS
          this[KProps].partHeaders = {}
          lineBuffer = []
          this[K_DATA_BUFFER] = []
          this[K_PART_PROPS] = {}
          continue
        }

        this[K_DATA_BUFFER].push(currentByte)
        lineBuffer.push(currentByte)
      }
    }
  }
}
