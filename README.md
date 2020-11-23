---
# 主题列表：juejin, github, smartblue, cyanosis, channing-cyan, fancy, hydrogen, condensed-night-purple, greenwillow, v-green
theme: v-green
highlight:
---

> 使用 NestJS + Redis + Kafka 实现简单秒杀系统

#### 技术栈：我们的老伙计`NestJS`，以及`ioredis`，`kafka-node`

最近在研究 kafka 消息队列，所以想写个秒杀来试试手，看了好几篇博客都没有具体的项目示例，所以参考了一下各种实现用 nestjs 写了一个可运行的项目。

### 第一步，创建项目

> 这里使用了 nest cli 命令快速生成项目模板；</br>

1. #### 安装@nest/cli 脚手架用于生成项目；

```bash
npm i -g @nest/cli   #安装nest-cli
```

<br>

2. #### 生成项目

```bash
nest new nest-seckill   #使用nest cli生成项目
cd ./nest-seckill
yarn                    #安装依赖
```

---

### 第二步，生成 seckill 模块

> 这里使用了 nest cli 命令快速生成模板代码；了解详情可以查看官方文档：[nest-cli 文档](https://docs.nestjs.com/cli/usages#nest-generate) </br>

1.  #### 生成 `seckill.module.ts`文件；

        用于创建kafka消费者，接收kafka消息，写入订单信息；

    ```bash
    nest generate module seckill
    # 可以简写为 `nest g mo seckill`
    ```

    </br>

2.  #### 生成 `seckill.controller.ts`；

         用于实现秒杀的RESTful接口；

    ```bash
    nest g co seckill
    ```

    </br>

3.  #### 生成 `seckill.service.ts`;

        在`service`里使用redis`乐观锁(watch)`与`事务(mult)`实现秒杀逻辑，
        再使用kafka的`Producer`生产一条消费数据；

    ```bash
    nest g service seckill
    ```

    </br>

4.  #### 生成 `redis.service.ts`;

    用于连接 redis;

    ```bash
    nest g service redis
    ```

    修改内容：

    ```ts
    import { Injectable } from '@nestjs/common'
    import { RedisService } from 'nestjs-redis'

    @Injectable()
    export class RedisClientService {
      constructor(private readonly redisService: RedisService) {}

      // 连接配置已在app.module设置
      async getSeckillRedisClient() {
        return await this.redisService.getClient('seckill')
      }
    }
    ```

---

### 第三步，编写秒杀逻辑；

</br>

1. #### 定义秒杀接口：

   在`seckill.controller.ts`里新增一个 Post 接口：

   ```ts
   import { Body, Controller, Post } from '@nestjs/common'
   import * as uuid from 'uuid-random' // 使用uuid生成订单号
   import { CreateOrderDTO } from '../order/order.dto' // 新增订单字段定义
   import { SeckillService } from './seckill.service' // 秒杀逻辑具体实现
   import { awaitWrap } from '@/utils/index' // async返回值简化方法

   @Controller('seckill')
   export class SeckillController {
     constructor(private readonly seckillService: SeckillService) {}

     @Post('/add')
     async addOrder(@Body() order: CreateOrderDTO) {
       const params: CreateOrderDTO = {
         ...order,
         openid: `${uuid()}-${new Date().valueOf()}`,
       }

       // 调用service的secKill方法，并等待完成
       const [error, result] = await awaitWrap(this.seckillService.secKill(params))
       return error || result
     }
   }
   ```

  </br>

2. #### 实现秒杀逻辑：

   在`seckill.service.ts`里新增一个`secKill`方法；

   使用 redis`乐观锁(watch)`和`事务(mult)`，实现并发下修改数据，详情可参
   考[node redis 文档](https://www.npmjs.com/package/redis#multiexec_atomiccallback)；

   ```ts
   import { Injectable, Logger } from '@nestjs/common'
   import * as kafka from 'kafka-node'
   import * as Redis from 'ioredis'
   import { RedisClientService } from '../redis/redis.service'
   import { getConfig } from '@root/config/index' // redis和 kafka的连接配置
   import { awaitWrap } from '@/utils'

   const { redisSeckill, kafkaConfig } = getConfig()

   // 创建kafka Client
   const kafkaClient = new kafka.KafkaClient({ kafkaHost: kafkaConfig.kafkaHost })
   // 创建kafka生产者
   const producer = new kafka.Producer(kafkaClient, {
     // Configuration for when to consider a message as acknowledged, default 1
     requireAcks: 1,
     // The amount of time in milliseconds to wait for all acks before considered, default 100ms
     ackTimeoutMs: 100,
     // Partitioner type (default = 0, random = 1, cyclic = 2, keyed = 3, custom = 4), default 0
     partitionerType: 2,
   })

   @Injectable()
   export class SeckillService {
     logger = new Logger('SeckillService') // 创建nest自带的日志实例
     seckillRedisClient!: Redis.Redis // redis连接实例
     count = 0 // 当前请求的次数

     constructor(private readonly redisClientService: RedisClientService) {
       // service 创建时异步初始化redis连接
       this.redisClientService.getSeckillRedisClient().then(client => {
         this.seckillRedisClient = client
       })
     }

     /*
      * ***********************
      * @desc 秒杀具体实现
      * ***********************
      */
     async secKill(params) {
       const { seckillCounterKey } = redisSeckill
       this.logger.log(`当前请求count：${this.count++}`)

       // tips:使用乐观锁解决并发
       const [watchError] = await awaitWrap(this.seckillRedisClient.watch(seckillCounterKey)) //监听'counter'字段更改
       watchError && this.logger.error(watchError)
       if (watchError) return watchError

       // 获取当前当前订单剩余数量
       const [getError, reply] = await awaitWrap(this.seckillRedisClient.get(seckillCounterKey))
       getError && this.logger.error(getError)
       if (getError) return getError
       if (parseInt(reply) <= 0) {
         this.logger.warn('已经卖光了')
         return '已经卖光了'
       }

       //tips: 使用redis事务修改redis的counter数量减一
       const [execError, replies] = await awaitWrap(this.seckillRedisClient.multi().decr(seckillCounterKey).exec())
       execError && this.logger.error(execError)
       if (execError) return execError

       // counter字段正在操作中，等待counter被其他释放
       if (!replies) {
         this.logger.warn('counter被使用')
         this.secKill(params) // 自动重试
         return
       }

       // kafka消费数据的内容
       const payload = [
         {
           topic: kafkaConfig.topic,
           partition: 0,
           messages: [JSON.stringify(params)],
         },
       ]

       this.logger.log('生产数据payload:')
       this.logger.verbose(payload)

       // 异步等待发送kafka消费数据
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
   }
   ```

  <br>
  
  
3. #### 监听kafka消息，消费订单队列消息;
    在`seckill.module.ts`内新增`handleListenerKafkaMessage()`方法，用于处理kafka消息；
    
    同时需要在`seckill`模块挂载`(onApplicationBootstrap)`时调用此方法，开始订阅kafka消息；
  
    ```ts
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
    import { getConfig } from '@root/config'

    const { kafkaConfig } = getConfig()

    @Module({
      imports: [OrderModule],
      providers: [RedisClientService, SeckillService],
      controllers: [SeckillController],
    })
    export class SeckillModule implements OnApplicationBootstrap {
      logger = new Logger('SeckillModule')
      seckillRedisClient!: Redis.Redis

      constructor(
        private readonly orderService: OrderService, //处理订单的Service
        private readonly seckillService: SeckillService, //秒杀相关实现
        private readonly redisClientService: RedisClientService //redis连接
      ) {
        this.redisClientService.getSeckillRedisClient().then(client => {
          this.seckillRedisClient = client
        })
      }

      async handleListenerKafkaMessage() {
        const kafkaConsumer = getKafkaConsumer() //抽取出创建消费者实现方法为函数

        kafkaConsumer.on('message', async message => {
          this.logger.log('得到的生产者的数据为：')
          this.logger.verbose(message)

          let order!: CreateOrderDTO // 从kafka队列得到的订单数据，即service里producer.send的messages内容

          if (typeof message.value === 'string') {
            order = JSON.parse(message.value)
          } else {
            order = JSON.parse(message.value.toString())
          }

          // 写入数据库，完成订单创建
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
        await this.seckillService.initCount()         //重置redis里商品剩余库存数
        this.handleListenerKafkaMessage()
      }
    }

    ```

  <br>
  
  5. #### kafka消费者`getKafkaConsumer`方法实现如下:

      在seckill模块文件夹下新增`kafka-utils.ts`文件：

      ```ts
      import * as kafka from 'kafka-node'
      import * as Redis from 'ioredis'
      import { getConfig } from '@root/config/index'
      import { awaitWrap } from '@/utils'

      const { kafkaConfig } = getConfig()
      let kafkaConsumer!: kafka.Consumer

      // 获取kafka client
      function getKafkaClient() {
        let kafkaClient!: kafka.KafkaClient

        return () => {
          if (!kafkaClient) {
            kafkaClient = new kafka.KafkaClient({
              kafkaHost: kafkaConfig.kafkaHost,
            })
          }

          return kafkaClient
        }
      }

          /**
         * @desc 获取消费者实例
         */
        export function getKafkaConsumer() {
          // consumer要订阅的topics配置
          const topics = [
            {
              topic: kafkaConfig.topic,
              partition: 0,
              offset: 0,
            },
          ]

          const options = {
            //  自动提交配置   (false 不会提交偏移量，每次都从头开始读取)
            autoCommit: true,
            autoCommitIntervalMs: 5000,
            //  如果设置为true，则consumer将从有效负载中的给定偏移量中获取消息
            fromOffset: false,
          }
          const kafkaClient = getKafkaClient()()

          if (!kafkaConsumer) {
            kafkaConsumer = new kafka.Consumer(kafkaClient, topics, options)
          }

          return kafkaConsumer
        }
      ```

  <br>
  
  ### 一些说明
  <br>
 
  1. 至此我们的主要秒杀逻辑就写的差不多了。由于我们主要为了实现秒杀逻辑，所有订单模块的代码就没有在这里展开了。我们只需要像第二步那样几行命令就可以简单创建Order模块，用于订单curd；
  
   2. 关于redis,mysql,kafka等服务的话可以编写`docker-compose.yaml`快速启动起来，具体可以参考本项目代码；
       ##### kafka容器可能会由于centos的防火墙导致启动失败,解决办法是：先关闭宿主机防火墙再重启docker；
   
   3. kafka容器创建后，需要我们在打开浏览器访问`kafka-manager`容器映射的`9000`端口上kafka管理页面，创建cluster和我们的Topic,具体初始化操作较为简单，可自行搜索`kafka-manager`；
   
       ###### 例如[Kafka集群管理工具kafka-manager的安装使用](https://www.cnblogs.com/frankdeng/p/9584870.html)
   
  > 项目github地址: [https://github.com/wenqieqiu/nest-seckill](https://github.com/wenqieqiu/nest-seckill)
