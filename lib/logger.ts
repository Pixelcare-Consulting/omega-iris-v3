import pino from 'pino'

//* DEFAULT PINO LOGGER LEVEL
//* trace - 10
//* debug - 20
//* info - 30
//* warn - 40
//* error - 50
//* fatal - 60
//* silent - infinity

export const logger = pino({
  level: 'trace',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:mm-dd-yyyy HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  })
})

export default logger
