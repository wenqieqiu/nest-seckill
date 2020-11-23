const config = {
  database: {
    ip: 'mysql', //docker-compose的link里指定的mysql容器主机名
    port: 3306,
    username: 'root',
    password: 'password',
    database: 'seckill',
  },
  redisCache: {
    host: 'redis',
    port: 6379,
    duration: 30 * 1000, //数据库查询缓存时间30s
  },
  redisSeckill: {
    seckillCounterKey: 'secKillCounter', //库存计数器key
    seckillHashKey: 'seckill-temp',
    seckillTempLockKey: 'lock-seckill-update', //同步锁的键
    name: 'seckill',
    host: 'redis',
    port: 6379,
    db: 1,
  },
  kafkaConfig: {
    kafkaHost: 'kafka:9092',
    topic: 'PHONE_NUMBER',
    partitionMaxIndex: 0, //Producer发送数据时分区范围 [0,partitionCount]
  },
  logger: ['error', 'warn', 'log'],
}

export default config
