import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common'
import * as Redis from 'ioredis'
import { awaitWrap } from '@/utils'
import { CreateOrderDTO } from '../order/order.dto'
import { OrderModule } from '../order/order.module'
import { OrderService } from '../order/order.service'
import { RedisClientService } from '../redis/redis.service'
import { getKafkaConsumer } from './kafka-utils'
import { SeckillController } from './seckill.controller'
import { SeckillService } from './seckill.service'
@Module({
  imports: [OrderModule],
  providers: [RedisClientService, SeckillService],
  controllers: [SeckillController],
})
export class SeckillModule implements OnApplicationBootstrap {
  logger = new Logger('SeckillModule')

  seckillRedisClient!: Redis.Redis

  constructor(
    private readonly orderService: OrderService,
    private readonly seckillService: SeckillService,
    private readonly redisClientService: RedisClientService
  ) {
    this.redisClientService.getSeckillRedisClient().then(client => {
      this.seckillRedisClient = client
    })
  }

  async handleListenerKafkaMessage() {
    const kafkaConsumer = getKafkaConsumer()

    kafkaConsumer.on('message', async message => {
      this.logger.log('得到的生产者的数据为：')
      this.logger.verbose(message)

      let value!: CreateOrderDTO

      if (typeof message.value === 'string') {
        value = JSON.parse(message.value)
      } else {
        value = JSON.parse(message.value.toString())
      }
      value.kafkaRawMessage = JSON.stringify(message)

      const [err, order] = await awaitWrap(this.orderService.saveOne(value))
      if (err) {
        this.logger.error(err)
        return
      }
      this.logger.log(`订单【${order.id}】信息已存入数据库`)
    })
  }

  async onApplicationBootstrap() {
    this.logger.log('onApplicationBootstrap: ')
    await this.seckillService.initCount()
    // await initKafkaTopic();
    this.handleListenerKafkaMessage()
  }
}
