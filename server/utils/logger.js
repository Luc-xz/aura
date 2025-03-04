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
  // console.log(`${req.method} ${req.url}`)
  logger.info(`${req.method} ${req.url}`)
  next()
}

export { logger, loggerMiddleware }

