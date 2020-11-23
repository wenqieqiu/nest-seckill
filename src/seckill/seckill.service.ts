import { Injectable, Logger } from '@nestjs/common'
import * as kafka from 'kafka-node'
import * as Redis from 'ioredis'
import { set } from 'lodash'
import { RedisClientService } from '../redis/redis.service'
import { getConfig } from '@root/config/index'
import { awaitWrap } from '@/utils'

const { redisSeckill, kafkaConfig } = getConfig()

const Producer = kafka.Producer
const kafkaClient = new kafka.KafkaClient({ kafkaHost: kafkaConfig.kafkaHost })
const producer = new Producer(kafkaClient, {
  // Configuration for when to consider a message as acknowledged, default 1
  requireAcks: 1,
  // The amount of time in milliseconds to wait for all acks before considered, default 100ms
  ackTimeoutMs: 100,
  // Partitioner type (default = 0, random = 1, cyclic = 2, keyed = 3, custom = 4), default 0
  partitionerType: 2,
})

@Injectable()
export class SeckillService {
  logger = new Logger('SeckillService')

  seckillRedisClient!: Redis.Redis

  count = 0

  constructor(private readonly redisClientService: RedisClientService) {
    this.redisClientService.getSeckillRedisClient().then(client => {
      this.seckillRedisClient = client
    })
  }

  async initCount() {
    const { seckillCounterKey } = redisSeckill

    return await this.seckillRedisClient.set(seckillCounterKey, 100)
  }

  async secKill(params) {
    const { seckillCounterKey } = redisSeckill

    this.logger.log(`当前请求count：${this.count++}`)

    //TIPS:使用乐观锁解决高并发
    const [watchError] = await awaitWrap(this.seckillRedisClient.watch(seckillCounterKey)) //监听counter字段
    watchError && this.logger.error(watchError)
    if (watchError) return watchError

    const [getError, reply] = await awaitWrap(this.seckillRedisClient.get(seckillCounterKey))
    getError && this.logger.error(getError)
    if (getError) return getError

    if (parseInt(reply) <= 0) {
      this.logger.warn('已经卖光了')
      return '已经卖光了'
    }

    //更新redis的counter数量减一
    const [execError, replies] = await awaitWrap(this.seckillRedisClient.multi().decr(seckillCounterKey).exec())
    execError && this.logger.error(execError)
    if (execError) return execError

    //counter字段正在操作中，等待counter被其他释放
    if (!replies) {
      this.logger.warn('counter被使用')
      this.secKill(params)
      return
    }

    // this.logger.log('replies: ')
    // this.logger.verbose(replies)
    set(params, 'remainCount', replies[0]?.[1])

    const payload = [
      {
        topic: kafkaConfig.topic,
        partition: 0,
        messages: [JSON.stringify(params)],
      },
    ]

    this.logger.log('生产数据payload:')
    this.logger.verbose(payload)

    return new Promise((resolve, reject) => {
      producer.send(payload, (err, kafkaProducerResponse) => {
        if (err) {
          this.logger.error(err)
          reject(err)
          return err
        }

        this.logger.verbose(kafkaProducerResponse)
        resolve({ payload, kafkaProducerResponse })
      })
    })
  }

  // 设置剩余库存
  async setRemainCount(remainCount: number) {
    const { seckillCounterKey } = redisSeckill

    //TIPS:使用乐观锁解决高并发
    const [watchError] = await awaitWrap(this.seckillRedisClient.watch(seckillCounterKey)) //监听counter字段
    watchError && this.logger.error(watchError)
    if (watchError) return watchError

    //更新redis的counter数量
    const [execError, replies] = await awaitWrap(this.seckillRedisClient.multi().set(seckillCounterKey, remainCount).get(seckillCounterKey).exec())
    execError && this.logger.error(execError)
    if (execError) return execError

    //counter字段正在操作中，等待counter被其他释放
    if (!replies) {
      this.logger.warn('counter被使用')
      return this.setRemainCount(remainCount)
    }

    console.log('replies: ', replies)
    return `更新剩余商品数成功！现在剩余：${replies?.[1]?.[1]}`
  }
}
