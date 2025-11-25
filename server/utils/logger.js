import log4js from 'log4js'

log4js.configure({
  appenders: {
    out: {
      type: 'stdout', // 输出到控制台
      layout: {
        type: 'colored' // 使用带颜色的布局
      }
    },
    file: {
      type: 'file', // 输出到文件
      filename: './logs/server.log', // 指定日志文件路径和名称
    }
  },
  categories: {
    default: {
      appenders: ['out', 'file'], // 使用 out 和 file 输出器
      level: 'debug' // 设置日志级别为 debug
    }
  }
});

const logger = log4js.getLogger()

const loggerMiddleware = (req, res, next) => {
  logger.info(`${req.method} ${req.url} ${JSON.stringify(req.body)}`)
  next()
}

const errorLoggerMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.url} ${JSON.stringify(req.body)} ${err.message} ${JSON.stringify(err.stack)}`)
  next(err)
}

export { logger, loggerMiddleware, errorLoggerMiddleware }
